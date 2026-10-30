
import { prisma } from "../config/database.js";

import type {
  UnidadeIphone,
} from "../modules/catalog/normalizer.js";

type AplicarLoteParams = {
  lockToken: string;
  sincronizacaoId: number;
  pontoAnterior: number | null;
  pontoNovo: number;
  produtosRecebidos: number;
  unidades: UnidadeIphone[];
  idsCadastroInativos: string[];
  idsCadastroAtivos: string[];
  tipo: string;
};

export class SyncRepository {
  async iniciar() {
    return prisma.sincronizacao.create({
      data: { status: "executando" },
    });
  }

  async buscarPonto(): Promise<number | null> {
    const cursor = await prisma.syncCursor.findUnique({
      where: { id: 1 },
    });

    if (!cursor) {
      return null;
    }

    const ponto = Number(cursor.ponto);

    if (!Number.isSafeInteger(ponto)) {
      throw new Error(
        "Checkpoint salvo excede o limite seguro."
      );
    }

    return ponto;
  }

  /**
   * Grava produtos, indisponibilidades, checkpoint
   * e confirmação na mesma transação MySQL.
   */
  async aplicarLoteAtomico(params: AplicarLoteParams) {
    const {
      lockToken,
      sincronizacaoId,
      pontoAnterior,
      pontoNovo,
      produtosRecebidos,
      unidades,
      idsCadastroInativos,
      idsCadastroAtivos,
      tipo,
    } = params;

    if (
      !Number.isSafeInteger(pontoNovo) ||
      pontoNovo < 0
    ) {
      throw new Error(
        "Novo ponto de sincronização inválido."
      );
    }

    if (
      pontoAnterior !== null &&
      pontoNovo < pontoAnterior
    ) {
      throw new Error(
        "O checkpoint não pode retroceder."
      );
    }



return prisma.$transaction(
  async (tx) => {
    // Reserva a linha do bloqueio durante a transação.
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
        "Bloqueio inválido ou expirado. " +
        "Transação cancelada."
      );
    }

    // 1. Conferir checkpoint dentro da transação.

        // 1. Conferir checkpoint dentro da transação.
        const cursorAtual =
          await tx.syncCursor.findUnique({
            where: { id: 1 },
          });

        const pontoNoBanco =
          cursorAtual === null
            ? null
            : Number(cursorAtual.ponto);

        if (pontoNoBanco !== pontoAnterior) {
          throw new Error(
            "Checkpoint alterado por outra execução."
          );
        }

        // 2. Atualizar os aparelhos recebidos.
        let atualizados = 0;

        for (const unidade of unidades) {

const dadosCadastrais = {
  codigo: unidade.codigo,
  nomeOriginal: unidade.nomeOriginal,
  modelo: unidade.modelo,
  armazenamento: unidade.armazenamento,
  cor: unidade.cor,
  condicao: unidade.condicao,
  bateria: unidade.bateria,
  preco: unidade.preco,
};



await tx.iphone.upsert({
  where: {
    hiperId: unidade.hiperId,
  },
  create: {
    hiperId: unidade.hiperId,
    ...dadosCadastrais,

    // Cadastro novo começa indisponível
    // até receber o saldo confirmado pelo estoque.
    quantidade: 0,
    disponivel: false,
  },
  update: dadosCadastrais,
});


          atualizados++;
        }


// 3. Atualizar situação cadastral,
// sem sobrescrever as quantidades de estoque.

let indisponibilizados = 0;

const idsInativos: string[] = [
  ...new Set<string>(idsCadastroInativos),
];

const idsAtivos: string[] = [
  ...new Set<string>(idsCadastroAtivos),
];

const conflito = idsAtivos.some(
  (id) => idsInativos.includes(id)
);

if (conflito) {
  throw new Error(
    "Cadastro com estados contraditórios no lote."
  );
}

// Desativar somente cadastros explicitamente
// inativos ou removidos.
for (let i = 0; i < idsInativos.length; i += 100) {
  const lote = idsInativos.slice(i, i + 100);

  const resultado = await tx.iphone.updateMany({
    where: {
      hiperId: { in: lote },
      disponivel: true,
    },
    data: {
      ativoCadastro: false,
      disponivel: false,
    },
  });

  indisponibilizados += resultado.count;

  await tx.iphone.updateMany({
    where: {
      hiperId: { in: lote },
      ativoCadastro: true,
    },
    data: {
      ativoCadastro: false,
      disponivel: false,
    },
  });
}

// Reativar somente cadastros confirmados
// como ativos pelo Hiper.
for (let i = 0; i < idsAtivos.length; i += 100) {
  const lote = idsAtivos.slice(i, i + 100);

  await tx.iphone.updateMany({
    where: {
      hiperId: { in: lote },
    },
    data: {
      ativoCadastro: true,
    },
  });

  // Usa o saldo já confirmado pelo StockService.
  await tx.iphone.updateMany({
    where: {
      hiperId: { in: lote },
      quantidade: { gt: 0 },
    },
    data: {
      disponivel: true,
    },
  });

  await tx.iphone.updateMany({
    where: {
      hiperId: { in: lote },
      quantidade: { lte: 0 },
    },
    data: {
      disponivel: false,
    },
  });
}

        // 4. Salvar novo ponto apenas depois dos
        // produtos e indisponibilidades.
        await tx.syncCursor.upsert({
          where: { id: 1 },
          create: {
            id: 1,
            ponto: BigInt(pontoNovo),
          },
          update: {
            ponto: BigInt(pontoNovo),
          },
        });

        // 5. Confirmar execução na mesma transação.
        await tx.sincronizacao.update({
          where: { id: sincronizacaoId },
          data: {
            status: "concluido",
            finalizadaEm: new Date(),
            produtosRecebidos,
            produtosValidos: unidades.length,
            mensagem:
              `Sincronização ${tipo}. ` +
              `Ponto: ${pontoAnterior ?? 0} -> ${pontoNovo}.`,
          },
        });

        return {
          atualizados,
          indisponibilizados,
        };
      },
      {
        maxWait: 10_000,
        timeout: 120_000,
      }
    );
  }

  /**
   * Usado quando não há novas alterações.
   */
  async concluir(
    id: number,
    recebidos: number,
    validos: number,
    mensagem: string
  ) {
    await prisma.sincronizacao.update({
      where: { id },
      data: {
        status: "concluido",
        finalizadaEm: new Date(),
        produtosRecebidos: recebidos,
        produtosValidos: validos,
        mensagem,
      },
    });
  }

  async registrarErro(id: number) {
    await prisma.sincronizacao.update({
      where: { id },
      data: {
        status: "erro",
        finalizadaEm: new Date(),
        mensagem: "Falha na sincronização.",
      },
    });
  }
}
