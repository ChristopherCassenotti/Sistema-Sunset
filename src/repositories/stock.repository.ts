
import { prisma } from "../config/database.js";

import type {
  EstoqueHiper,
} from "../integrations/hiper/hiper-stock.client.js";

type AplicarEstoqueParams = {
  lockToken: string;
  pontoAnterior: number | null;
  pontoNovo: number;
  localDeEstoqueId: string;
  registros: EstoqueHiper[];
};

export class StockRepository {
  async buscarCursor() {
    const cursor = await prisma.stockCursor.findUnique({
      where: { id: 1 },
    });

    if (!cursor) {
      return null;
    }

    const ponto = Number(cursor.ponto);

    if (!Number.isSafeInteger(ponto)) {
      throw new Error("Checkpoint de estoque inválido.");
    }

    return {
      ponto,
      localDeEstoqueId: cursor.localDeEstoqueId,
    };
  }

  async buscarCorrespondentes(ids: string[]) {
    return prisma.iphone.findMany({
      where: {
        hiperId: { in: ids },
      },
      select: {
        hiperId: true,
        quantidade: true,
        disponivel: true,
      },
    });
  }

  async aplicarLoteAtomico(params: AplicarEstoqueParams) {
    const {
      lockToken,
      pontoAnterior,
      pontoNovo,
      localDeEstoqueId,
      registros,
    } = params;

    if (
      !Number.isSafeInteger(pontoNovo) ||
      pontoNovo < 0 ||
      (pontoAnterior !== null && pontoNovo < pontoAnterior)
    ) {
      throw new Error("Checkpoint de estoque inválido.");
    }

    if (!localDeEstoqueId) {
      throw new Error("Local de estoque não informado.");
    }

    return prisma.$transaction(
      async (tx) => {
        // Protege contra outra execução durante o commit.
        const bloqueios = await tx.$queryRaw<
          Array<{
            token: string | null;
            expiraEm: Date;
          }>
        >`
          SELECT token, expiraEm
          FROM SyncLock
          WHERE id = 1
          FOR UPDATE
        `;

        const bloqueio = bloqueios[0];

        if (
          !bloqueio ||
          bloqueio.token !== lockToken ||
          bloqueio.expiraEm <= new Date()
        ) {
          throw new Error(
            "Bloqueio de sincronização inválido."
          );
        }

        const cursor = await tx.stockCursor.findUnique({
          where: { id: 1 },
        });

        const pontoBanco = cursor
          ? Number(cursor.ponto)
          : null;

        if (pontoBanco !== pontoAnterior) {
          throw new Error(
            "Checkpoint alterado por outra execução."
          );
        }

        if (
          cursor?.localDeEstoqueId &&
          cursor.localDeEstoqueId !== localDeEstoqueId
        ) {
          throw new Error(
            "Local de estoque diferente do configurado."
          );
        }

        let atualizados = 0;
        let zerados = 0;

        // Atualizar somente iPhones que existem no banco.
        for (const item of registros) {
          const quantidade = item.quantidadeEmEstoque;

          if (
            !Number.isSafeInteger(quantidade) ||
            quantidade < 0
          ) {
            throw new Error(
              "Quantidade de estoque inválida."
            );
          }


const resultado = await tx.iphone.updateMany({
  where: {
    hiperId: item.produtoId,
    ativoCadastro: true,
  },
  data: {
    quantidade,
    disponivel: quantidade > 0,
  },
});

// Cadastros inativos podem receber seu saldo,
// mas não devem voltar a aparecer no catálogo.
await tx.iphone.updateMany({
  where: {
    hiperId: item.produtoId,
    ativoCadastro: false,
  },
  data: {
    quantidade,
    disponivel: false,
  },
});


          atualizados += resultado.count;

          if (quantidade === 0) {
            zerados += resultado.count;
          }
        }

        // Produtos e checkpoint na mesma transação.
        await tx.stockCursor.upsert({
          where: { id: 1 },
          create: {
            id: 1,
            ponto: BigInt(pontoNovo),
            localDeEstoqueId,
          },
          update: {
            ponto: BigInt(pontoNovo),
            localDeEstoqueId,
          },
        });

        return {
          atualizados,
          zerados,
        };
      },
      {
        maxWait: 10_000,
        timeout: 120_000,
      }
    );
  }
  
async reconciliarCompleto(params: {
  lockToken: string;
  pontoEsperado: number;
  pontoSnapshot: number;
  localDeEstoqueId: string;
  registros: EstoqueHiper[];
}) {
  const {
    lockToken,
    pontoEsperado,
    pontoSnapshot,
    localDeEstoqueId,
    registros,
  } = params;

  if (
    !Number.isSafeInteger(pontoSnapshot) ||
    pontoSnapshot < pontoEsperado ||
    !localDeEstoqueId
  ) {
    throw new Error(
      "Snapshot de estoque inválido ou antigo."
    );
  }

  const saldos = new Map<string, number>();

  for (const item of registros) {
    if (
      !item.produtoId ||
      !Number.isSafeInteger(item.quantidadeEmEstoque) ||
      item.quantidadeEmEstoque < 0 ||
      saldos.has(item.produtoId)
    ) {
      throw new Error(
        "Registro duplicado ou saldo inválido."
      );
    }

    saldos.set(
      item.produtoId,
      item.quantidadeEmEstoque
    );
  }

  return prisma.$transaction(
    async (tx) => {
      // Verificar propriedade do bloqueio
      // e impedir sua transferência durante o commit.
      const locks = await tx.$queryRaw<
        Array<{ token: string | null; expiraEm: Date }>
      >`
        SELECT token, expiraEm
        FROM SyncLock
        WHERE id = 1
        FOR UPDATE
      `;

      const lock = locks[0];

      if (
        !lock ||
        lock.token !== lockToken ||
        lock.expiraEm <= new Date()
      ) {
        throw new Error(
          "Bloqueio de sincronização inválido."
        );
      }

      const cursor =
        await tx.stockCursor.findUnique({
          where: { id: 1 },
        });

      if (
        !cursor ||
        Number(cursor.ponto) !== pontoEsperado ||
        cursor.localDeEstoqueId !== localDeEstoqueId
      ) {
        throw new Error(
          "Checkpoint ou local de estoque mudou."
        );
      }

      const iphones = await tx.iphone.findMany({
        select: {
          hiperId: true,
          quantidade: true,
          disponivel: true,
          ativoCadastro: true,
        },
      });

      let atualizados = 0;
      let semRegistro = 0;

      for (const iphone of iphones) {
        const saldo = saldos.get(iphone.hiperId);

        // Não presumir estoque zero se o
        // Hiper não retornou o produto.
        if (saldo === undefined) {
          semRegistro++;
          continue;
        }

        const disponivel = saldo > 0 && iphone.ativoCadastro;

        if (
          iphone.quantidade === saldo &&
          iphone.disponivel === disponivel
        ) {
          continue;
        }

        await tx.iphone.update({
          where: { hiperId: iphone.hiperId },
          data: {
            quantidade: saldo,
            disponivel,
          },
        });

        atualizados++;
      }

      // Reconciliação NÃO avança StockCursor.
      // A sincronização incremental continuará
      // processando os eventos pendentes.
      return {
        iphonesVerificados: iphones.length,
        iphonesAtualizados: atualizados,
        semRegistroEstoque: semRegistro,
        pontoPreservado: pontoEsperado,
      };
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    }
  );
}

}
