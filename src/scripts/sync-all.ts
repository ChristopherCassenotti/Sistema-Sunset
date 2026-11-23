
import "dotenv/config";

import { SyncService } from "../services/sync.service.js";
import { StockService } from "../services/stock.service.js";

import {
  desconectarBanco,
} from "../config/database.js";

async function main() {
  const inicioGeral = Date.now();

  console.log(
    "\n========================================"
  );
  console.log(
    "SUNSET IMPORTADOS — SINCRONIZAÇÃO GERAL"
  );
  console.log(
    "========================================"
  );

  // ETAPA 1 — Produtos e preços
  console.log(
    "\n[1/2] Sincronizando produtos e preços..."
  );

  const inicioProdutos = Date.now();

  const syncService = new SyncService();

  const resultadoProdutos =
    await syncService.executar();
  
  if (resultadoProdutos.status !== "concluida") {
  throw new Error(
    "Sincronização de produtos não foi concluída."
  );
}

  console.log(
    "\nRESULTADO — PRODUTOS E PREÇOS"
  );

  console.table(resultadoProdutos);

  console.log(
    `Duração: ${(
      (Date.now() - inicioProdutos) / 1000
    ).toFixed(2)} segundos`
  );

  // ETAPA 2 — Estoque e reservas
  // Só inicia quando a etapa anterior termina.
  console.log(
    "\n[2/2] Sincronizando estoque e reservas..."
  );

  const inicioEstoque = Date.now();

  const stockService = new StockService();

  // false = sincronização real
  const resultadoEstoque =
    await stockService.executar(false);

  console.log(
    "\nRESULTADO — ESTOQUE E RESERVAS"
  );

  console.table(resultadoEstoque);

  if (resultadoEstoque.status !== "concluida") {
    throw new Error(
      "Sincronização de estoque não concluída."
    );
  }

  console.log(
    `Duração: ${(
      (Date.now() - inicioEstoque) / 1000
    ).toFixed(2)} segundos`
  );

  console.log(
    "\n========================================"
  );
  console.log(
    "SINCRONIZAÇÃO GERAL CONCLUÍDA!"
  );
  console.log(
    `Duração total: ${(
      (Date.now() - inicioGeral) / 1000
    ).toFixed(2)} segundos`
  );
  console.log(
    "========================================\n"
  );
}

main()
  .catch((erro: unknown) => {
    console.error(
      "\nFALHA NA SINCRONIZAÇÃO GERAL:",
      erro instanceof Error
        ? erro.message
        : String(erro)
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await desconectarBanco();
  });
