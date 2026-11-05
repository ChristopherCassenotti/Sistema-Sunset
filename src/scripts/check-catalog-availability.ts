
import "dotenv/config";

import { prisma } from "../config/database.js";

async function main() {
  console.log(
    "\nSUNSET — AUDITORIA DE DISPONIBILIDADE"
  );

  const iphones = await prisma.iphone.findMany({
    select: {
      hiperId: true,
      ativoCadastro: true,
      quantidade: true,
      quantidadeReservada: true,
      disponivel: true,
    },
  });

  const inconsistentes = iphones.filter((iphone) => {
    const quantidadeLivre = Math.max(
      0,
      iphone.quantidade - iphone.quantidadeReservada
    );

    const deveriaEstarDisponivel =
      iphone.ativoCadastro && quantidadeLivre > 0;

    return iphone.disponivel !== deveriaEstarDisponivel;
  });

  const livres = iphones.filter((iphone) => {
    return (
      iphone.ativoCadastro &&
      iphone.quantidade - iphone.quantidadeReservada > 0
    );
  });

  const reservados = iphones.filter(
    (iphone) =>
      iphone.quantidade > 0 &&
      iphone.quantidade -
        iphone.quantidadeReservada <= 0
  );

  console.table({
    totalIphones: iphones.length,
    cadastrosAtivos: iphones.filter(
      (iphone) => iphone.ativoCadastro
    ).length,
    aparelhosLivres: livres.length,
    totalmenteReservados: reservados.length,
    disponiveisNoBanco: iphones.filter(
      (iphone) => iphone.disponivel
    ).length,
    inconsistencias: inconsistentes.length,
  });

  if (inconsistentes.length > 0) {
    console.log("\nINCONSISTÊNCIAS");

    console.table(
      inconsistentes.map((iphone) => ({
        idFinal: iphone.hiperId.slice(-8),
        quantidade: iphone.quantidade,
        reservada: iphone.quantidadeReservada,
        ativoCadastro: iphone.ativoCadastro,
        disponivel: iphone.disponivel,
      }))
    );

    process.exitCode = 1;
  } else {
    console.log(
      "\nAPROVADO — Disponibilidade consistente."
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
