
import "dotenv/config";

import { prisma } from "../config/database.js";
import { consultarEstoqueHiper } from
  "../integrations/hiper/hiper-stock.client.js";
import { StockRepository } from
  "../repositories/stock.repository.js";
import { SyncLockRepository } from
  "../repositories/sync-lock.repository.js";

async function main() {
  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error("Chave Hiper não configurada.");
  }

  const aplicar = process.argv.includes("--aplicar");

  const repository = new StockRepository();
  const lockRepository = new SyncLockRepository();

  const token = await lockRepository.adquirir();

  if (!token) {
    throw new Error(
      "Outra sincronização está em andamento."
    );
  }

  try {
    console.log("\nSUNSET — RECONCILIAÇÃO COMPLETA");

    const cursor = await repository.buscarCursor();

    if (!cursor || !cursor.localDeEstoqueId) {
      throw new Error(
        "Checkpoint ou local de estoque não configurado."
      );
    }

    const lote = await consultarEstoqueHiper(chave, 0);

    if (
      lote.semAlteracoes ||
      !lote.localDeEstoqueId ||
      lote.localDeEstoqueId !== cursor.localDeEstoqueId
    ) {
      throw new Error(
        "Snapshot vazio ou local de estoque diferente."
      );
    }

    if (lote.pontoAtual < cursor.ponto) {
      throw new Error(
        "Snapshot mais antigo que o checkpoint salvo."
      );
    }

    const ids = lote.registros.map(
      (item) => item.produtoId
    );

    if (new Set(ids).size !== ids.length) {
      throw new Error(
        "Produtos duplicados no snapshot."
      );
    }

    const cadastrados =
      await repository.buscarCorrespondentes(ids);

    const correspondentes = new Set(
      cadastrados.map((item) => item.hiperId)
    );

    const registrosValidos = lote.registros.filter(
      (item) => correspondentes.has(item.produtoId)
    );

    const livres = registrosValidos.filter(
      (item) =>
        item.quantidadeEmEstoque >
        item.quantidadeEmEstoqueReservado
    ).length;

    console.table({
      pontoSalvo: cursor.ponto,
      pontoSnapshot: lote.pontoAtual,
      registrosHiper: lote.registros.length,
      iphonesCorrespondentes: registrosValidos.length,
      aparelhosComSaldoLivre: livres,
      modo: aplicar ? "GRAVACAO" : "SIMULACAO",
    });

    if (!aplicar) {
      console.log(
        "\nSimulação concluída. Nenhum dado alterado."
      );
      return;
    }

    if (!(await lockRepository.validar(token))) {
      throw new Error("Bloqueio expirado.");
    }

    const resultado =
      await repository.reconciliarCompleto({
        lockToken: token,
        pontoEsperado: cursor.ponto,
        pontoSnapshot: lote.pontoAtual,
        localDeEstoqueId: lote.localDeEstoqueId,
        registros: registrosValidos,
      });

    console.log("\nRECONCILIAÇÃO CONCLUÍDA");
    console.table(resultado);
  } finally {
    await lockRepository.liberar(token);
  }
}

main()
  .catch((erro: unknown) => {
    console.error(
      "ERRO:",
      erro instanceof Error
        ? erro.message
        : "Erro desconhecido"
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
