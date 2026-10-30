
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[1/2] Conectando ao MySQL...");

  await prisma.$connect();

  console.log("Conexão estabelecida!");

  console.log("[2/2] Consultando tabelas...");

  const totalIphones = await prisma.iphone.count();
  const totalSincronizacoes =
    await prisma.sincronizacao.count();

  console.table({
    iphones: totalIphones,
    sincronizacoes: totalSincronizacoes,
  });

  console.log("Banco de dados funcionando!");
}

main()
  .catch((erro) => {
    console.error(
      "Falha ao conectar ao MySQL:",
      erro instanceof Error
        ? erro.message.split("\n")[0]
        : "Erro desconhecido"
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
