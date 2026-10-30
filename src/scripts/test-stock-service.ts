
import "dotenv/config";

import { StockService } from
  "../services/stock.service.js";

import { desconectarBanco } from
  "../config/database.js";

async function main() {
  console.log(
    "\nSUNSET — SIMULAÇÃO DE ESTOQUE"
  );

  const service = new StockService();

  // true = simulação sem gravações
  const resultado = await service.executar(true);

  console.table(resultado);

  console.log(
    "\nNenhum iPhone ou checkpoint foi alterado."
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
    await desconectarBanco();
  });
