
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

  console.log("\nSUNSET — RECONCILIAÇÃO DE ESTOQUE");

  // Consulta completa sem usar o checkpoint salvo.
  const lote = await consultarEstoqueHiper(chave, 0);

  const iphones = await prisma.iphone.findMany({
    select: {
      hiperId: true,
      quantidade: true,
      disponivel: true,
    },
  });

  const estoquePorProduto = new Map<
    string,
    number
  >();

  for (const item of lote.registros) {
    if (estoquePorProduto.has(item.produtoId)) {
      throw new Error(
        "Produto duplicado no estoque. " +
        "Verificar locais ou registros antes de reconciliar."
      );
    }

    estoquePorProduto.set(
      item.produtoId,
      item.quantidadeEmEstoque
    );
  }

  const divergencias = iphones
    .filter((iphone) => {
      const saldo = estoquePorProduto.get(
        iphone.hiperId
      );

      if (saldo === undefined) return false;

      return (
        iphone.quantidade !== saldo ||
        iphone.disponivel !== (saldo > 0)
      );
    })
    .map((iphone) => ({
      produtoIdFinal: iphone.hiperId.slice(-8),
      quantidadeMySQL: iphone.quantidade,
      quantidadeHiper:
        estoquePorProduto.get(iphone.hiperId),
      disponivelMySQL: iphone.disponivel,
    }));

  const semRegistroEstoque = iphones.filter(
    (iphone) =>
      !estoquePorProduto.has(iphone.hiperId)
  ).length;

  console.table({
    pontoHiper: lote.pontoAtual,
    registrosHiper: lote.registros.length,
    iphonesMySQL: iphones.length,
    divergencias: divergencias.length,
    semRegistroEstoque,
    localIdentificado:
      lote.localDeEstoqueId !== null,
  });

  if (divergencias.length > 0) {
    console.log("\nDIVERGÊNCIAS ENCONTRADAS");
    console.table(divergencias);
  } else {
    console.log(
      "\nNenhuma divergência encontrada."
    );
  }

  console.log(
    "\nAuditoria concluída. Nenhum dado alterado."
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
