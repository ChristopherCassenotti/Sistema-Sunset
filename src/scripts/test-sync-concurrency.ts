
import "dotenv/config";

import { SyncLockRepository } from
  "../repositories/sync-lock.repository.js";

import { desconectarBanco } from
  "../config/database.js";

import { randomInt } from "node:crypto";

async function main() {
  console.log("\nSUNSET — TESTE DE CONCORRÊNCIA");

// ID reservado exclusivamente para testes.
// Não interfere no bloqueio principal (ID 1).
const TEST_LOCK_ID = randomInt(
  1_000_000,
  2_000_000_000
);

const primeiro = new SyncLockRepository(TEST_LOCK_ID);
const segundo = new SyncLockRepository(TEST_LOCK_ID);

  console.log("[1/4] Executando duas aquisições simultâneas...");

  const [token1, token2] = await Promise.all([
    primeiro.adquirir(),
    segundo.adquirir(),
  ]);

  try {
    console.table({
      primeiraExecucao: token1 ? "ADQUIRIU" : "NEGADO",
      segundaExecucao: token2 ? "ADQUIRIU" : "NEGADO",
    });

    const adquiridos =
      Number(token1 !== null) +
      Number(token2 !== null);

    if (adquiridos !== 1) {
      throw new Error(
        `TESTE REPROVADO: ${adquiridos} execuções adquiriram o bloqueio.`
      );
    }

    console.log("[2/4] Validando proprietário...");

    const tokenValido = token1 ?? token2!;

    const proprietario = token1
      ? primeiro
      : segundo;

    const valido =
      await proprietario.validar(tokenValido);

    if (!valido) {
      throw new Error("Bloqueio adquirido não é válido.");
    }

    console.log("[3/4] Testando renovação...");

    const renovado =
      await proprietario.renovar(tokenValido);

    if (!renovado) {
      throw new Error("Renovação falhou.");
    }

    console.log("Renovação aprovada.");

  } finally {
    console.log("[4/4] Liberando bloqueios...");

    if (token1) {
      await primeiro.liberar(token1);
    }

    if (token2) {
      await segundo.liberar(token2);
    }
  }

  console.log(
    "\nTESTE APROVADO — Somente uma execução adquiriu o bloqueio."
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
