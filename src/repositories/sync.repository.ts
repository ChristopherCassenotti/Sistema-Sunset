
import { prisma } from "../config/database.js";

import type {
  UnidadeIphone,
} from "../modules/catalog/normalizer.js";

export class SyncRepository {
  async iniciar() {
    return prisma.sincronizacao.create({
      data: { status: "executando" },
    });
  }

  async salvarUnidades(unidades: UnidadeIphone[]) {
    const TAMANHO_LOTE = 30;
    let total = 0;

    for (
      let i = 0;
      i < unidades.length;
      i += TAMANHO_LOTE
    ) {
      const lote = unidades.slice(i, i + TAMANHO_LOTE);

      await prisma.$transaction(
        lote.map((unidade) => {
          const dados = {
            codigo: unidade.codigo,
            nomeOriginal: unidade.nomeOriginal,
            modelo: unidade.modelo,
            armazenamento: unidade.armazenamento,
            cor: unidade.cor,
            condicao: unidade.condicao,
            bateria: unidade.bateria,
            preco: unidade.preco,
            quantidade: unidade.quantidade,
            disponivel: unidade.quantidade > 0,
          };

          return prisma.iphone.upsert({
            where: { hiperId: unidade.hiperId },
            create: {
              hiperId: unidade.hiperId,
              ...dados,
            },
            update: dados,
          });
        })
      );

      total += lote.length;
    }

    return total;
  }

  async indisponibilizar(ids: string[]) {
    let total = 0;

    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100);

      const resultado = await prisma.iphone.updateMany({
        where: {
          hiperId: { in: lote },
          disponivel: true,
        },
        data: {
          disponivel: false,
          quantidade: 0,
        },
      });

      total += resultado.count;
    }

    return total;
  }

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


async buscarPonto(): Promise<number | null> {
  const cursor = await prisma.syncCursor.findUnique({
    where: { id: 1 },
  });

  // null indica que ainda não fizemos a primeira
  // sincronização com checkpoint.
  return cursor ? Number(cursor.ponto) : null;
}

async salvarPonto(ponto: number): Promise<void> {
  if (!Number.isSafeInteger(ponto) || ponto < 0) {
    throw new Error("Ponto de sincronização inválido.");
  }

  await prisma.$transaction(async (tx) => {
    const atual = await tx.syncCursor.findUnique({
      where: { id: 1 },
    });

    if (atual && BigInt(ponto) < atual.ponto) {
      throw new Error(
        "O novo ponto é anterior ao ponto armazenado."
      );
    }

    await tx.syncCursor.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ponto: BigInt(ponto),
      },
      update: {
        ponto: BigInt(ponto),
      },
    });
  });
}

}
