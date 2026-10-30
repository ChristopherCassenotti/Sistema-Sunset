
import "dotenv/config";

import { prisma } from "../config/database.js";

async function main() {
  const [cursor, ultimaSync, total, disponiveis, indisponiveis] =
    await Promise.all([
      prisma.syncCursor.findUnique({
        where: { id: 1 },
      }),
      prisma.sincronizacao.findFirst({
        orderBy: { id: "desc" },
      }),
      prisma.iphone.count(),
      prisma.iphone.count({
        where: {
          disponivel: true,
          quantidade: { gt: 0 },
        },
      }),
      prisma.iphone.count({
        where: {
          disponivel: false,
        },
      }),
    ]);

  console.log("\nSUNSET — ESTADO DA SINCRONIZAÇÃO");

  console.table({
    pontoAtual: cursor?.ponto.toString() ?? "não definido",
    ultimaSincronizacao: ultimaSync?.status ?? "nenhuma",
    dataUltimaExecucao:
      ultimaSync?.finalizadaEm?.toISOString() ?? "não definida",
    totalCadastros: total,
    disponiveis,
    indisponiveis,
  });

  if (!cursor) {
    throw new Error("Checkpoint não encontrado.");
  }

  if (ultimaSync?.status !== "concluido") {
    console.warn(
      "A última sincronização não foi concluída."
    );
  }

  console.log("\nVerificação somente de leitura concluída.");
}

main()
  .catch((erro: unknown) => {
    console.error(
      "Falha:",
      erro instanceof Error ? erro.message : "Erro desconhecido"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
