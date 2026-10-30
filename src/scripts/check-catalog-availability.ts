
import "dotenv/config";

import { prisma } from "../config/database.js";

async function main() {
  console.log("\nSUNSET — AUDITORIA DE DISPONIBILIDADE");

  const iphones = await prisma.iphone.findMany({
    select: {
      hiperId: true,
      ativoCadastro: true,
      quantidade: true,
      disponivel: true,
    },
  });

  const inconsistentes = iphones.filter(
    (iphone) =>
      iphone.disponivel !==
      (iphone.ativoCadastro && iphone.quantidade > 0)
  );

  console.table({
    totalIphones: iphones.length,
    cadastrosAtivos: iphones.filter(
      (i) => i.ativoCadastro
    ).length,
    disponiveis: iphones.filter(
      (i) => i.disponivel
    ).length,
    inconsistencias: inconsistentes.length,
  });

  if (inconsistentes.length > 0) {
    console.log(
      "Existem registros com disponibilidade inconsistente."
    );
    process.exitCode = 1;
  } else {
    console.log(
      "APROVADO — Disponibilidade consistente."
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
