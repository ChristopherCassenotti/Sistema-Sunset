
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
            },
            data: {
              quantidade,
              disponivel: quantidade > 0,
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
}
