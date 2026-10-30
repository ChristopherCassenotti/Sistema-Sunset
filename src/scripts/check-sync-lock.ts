
import "dotenv/config";

import { prisma } from "../config/database.js";

async function main() {
  const lock = await prisma.syncLock.findUnique({
    where: { id: 1 },
  });

  const agora = new Date();

  console.log("\nSUNSET — DIAGNÓSTICO DO BLOQUEIO");

  if (!lock) {
    console.log("Nenhum bloqueio encontrado.");
    return;
  }

  const ativo =
    lock.token !== null &&
    lock.expiraEm.getTime() > agora.getTime();

  console.table({
    possuiToken: lock.token !== null,
    bloqueioAtivo: ativo,
    horarioAtual: agora.toISOString(),
    expiraEm: lock.expiraEm.toISOString(),
    segundosRestantes: Math.max(
      0,
      Math.ceil(
        (lock.expiraEm.getTime() - agora.getTime()) / 1000
      )
    ),
  });

  if (ativo) {
    console.log(
      "\nExiste um bloqueio válido no MySQL."
    );
  } else {
    console.log(
      "\nNão existe bloqueio ativo."
    );
  }
}

main()
  .catch((erro: unknown) => {
    console.error(
      erro instanceof Error
        ? erro.message
        : "Erro desconhecido"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
