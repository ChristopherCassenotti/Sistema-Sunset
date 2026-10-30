
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

  console.log("\nSUNSET — CLIENTE DE ESTOQUE");

  const lote = await consultarEstoqueHiper(
    chave,
    0
  );

  const iphones = await prisma.iphone.findMany({
    select: { hiperId: true },
  });

  const ids = new Set(
    iphones.map((iphone) => iphone.hiperId)
  );

  const correspondentes = lote.registros.filter(
    (registro) => ids.has(registro.produtoId)
  );

  console.table({
    pontoAnterior: lote.pontoAnterior,
    pontoAtual: lote.pontoAtual,
    registrosRecebidos: lote.registros.length,
    iphonesCorrespondentes: correspondentes.length,
    localDeEstoqueIdentificado:
      lote.localDeEstoqueId !== null,
    semAlteracoes: lote.semAlteracoes,
  });

  console.log(
    "\nDiagnóstico concluído. Nenhum dado alterado."
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
