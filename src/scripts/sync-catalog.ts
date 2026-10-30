
import "dotenv/config";

import {
  SyncService,
} from "../services/sync.service.js";

import {
  desconectarBanco,
} from "../config/database.js";

const syncService = new SyncService();

async function main() {
  const inicio = Date.now();

  console.log("SUNSET IMPORTADOS — SINCRONIZAÇÃO");

  const resultado = await syncService.executar();

  console.log("\nSINCRONIZAÇÃO CONCLUÍDA!");

  console.table(resultado);

  console.log(
    `Duração: ${((Date.now() - inicio) / 1000)
      .toFixed(2)} segundos`
  );
}

main()
  .catch((erro: unknown) => {
    console.error(
      "Falha na sincronização:",
      erro instanceof Error
        ? erro.message
        : "Erro desconhecido"
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await desconectarBanco();
  });
