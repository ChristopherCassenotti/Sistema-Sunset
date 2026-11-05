
import "dotenv/config";

import { prisma } from "../config/database.js";

import {
  consultarEstoqueHiper,
} from "../integrations/hiper/hiper-stock.client.js";

async function main() {
  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error("Chave do Hiper não configurada.");
  }

  console.log("\nSUNSET — ESTOQUE LIVRE PARA VENDA");

  // Consulta completa, sem alterar o checkpoint.
  const lote = await consultarEstoqueHiper(chave, 0);

  const iphones = await prisma.iphone.findMany({
    select: {
      hiperId: true,
      modelo: true,
      cor: true,
      quantidade: true,
      quantidadeReservada: true,
      ativoCadastro: true,
    },
  });

  const saldos = new Map(
    lote.registros.map((item) => [
      item.produtoId,
      item,
    ])
  );

  const resultado = iphones.map((iphone) => {
    const estoque = saldos.get(iphone.hiperId);

    const bruto = estoque?.quantidadeEmEstoque;
    const reservado =
      estoque?.quantidadeEmEstoqueReservado;

    const livre =
      bruto !== undefined &&
      reservado !== undefined
        ? Math.max(0, bruto - reservado)
        : null;

    return {
      modelo: iphone.modelo,
      cor: iphone.cor,
      estoqueHiper: bruto ?? "sem registro",
      reservadoHiper: reservado ?? "sem registro",
      livreHiper: livre ?? "desconhecido",
      reservadoMySQL: iphone.quantidadeReservada,
      publicar:
        livre !== null &&
        livre > 0 &&
        iphone.ativoCadastro,
    };
  });

  console.table(resultado);

  console.log("\nRESUMO");

  console.table({
    iphonesCadastrados: iphones.length,
    aparelhosSemEstoque:
      resultado.filter(
        (item) => item.livreHiper === "desconhecido"
      ).length,
    aparelhosParaPublicar:
      resultado.filter((item) => item.publicar).length,
    aparelhosOcultos:
      resultado.filter(
        (item) =>
          item.livreHiper !== "desconhecido" &&
          !item.publicar
      ).length,
    pontoEstoqueHiper: lote.pontoAtual,
  });

  console.log(
    "\nConsulta concluída. Nenhum dado foi alterado."
  );
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
