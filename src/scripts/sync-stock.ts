
import "dotenv/config";

import {
  StockService,
} from "../services/stock.service.js";

import {
  desconectarBanco,
} from "../config/database.js";

async function main() {
  console.log(
    "\nSUNSET — SINCRONIZAÇÃO REAL DE ESTOQUE"
  );

  const inicio = Date.now();

  const service = new StockService();

  // false = gravação real no MySQL
  const resultado = await service.executar(false);

  console.table(resultado);

  if (resultado.status !== "concluida") {
    throw new Error(
      "Sincronização de estoque não foi concluída."
    );
  }

  console.log(
    `Duração: ${(
      (Date.now() - inicio) / 1000
    ).toFixed(2)} segundos`
  );
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
    await desconectarBanco();
  });
