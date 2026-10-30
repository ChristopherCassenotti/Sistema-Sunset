
import "dotenv/config";

import { randomInt } from "node:crypto";

import {
  SyncLockRepository,
} from "../repositories/sync-lock.repository.js";

import {
  prisma,
} from "../config/database.js";

const TEST_LOCK_ID = randomInt(
  1_000_000,
  2_000_000_000
);

const TEMPO_TESTE_MS = 75_000;
const INTERVALO_RENOVACAO_MS = 60_000;

async function main() {
  console.log("\nSUNSET — TESTE DE RENOVAÇÃO");

  const repository =
    new SyncLockRepository(TEST_LOCK_ID);

  const token = await repository.adquirir();

  if (!token) {
    throw new Error(
      "Não foi possível adquirir o bloqueio de teste."
    );
  }

  let renovacoes = 0;
  let falha: Error | null = null;
  let renovacaoPendente:
    Promise<void> | null = null;

  const renovar = () => {
    if (renovacaoPendente) return;

    renovacaoPendente = (async () => {
      try {
        const renovado =
          await repository.renovar(token);

        if (!renovado) {
          throw new Error(
            "A renovação foi recusada."
          );
        }

        renovacoes++;

        console.log(
          `Renovação ${renovacoes}: OK`
        );
      } catch (erro) {
        falha =
          erro instanceof Error
            ? erro
            : new Error("Falha desconhecida");
      }
    })().finally(() => {
      renovacaoPendente = null;
    });
  };

  const intervalo = setInterval(
    renovar,
    INTERVALO_RENOVACAO_MS
  );

  try {
    console.log(
      "[1/3] Bloqueio de teste adquirido."
    );

    console.log(
      "[2/3] Simulando operação de 75 segundos..."
    );

    await new Promise<void>((resolve) =>
      setTimeout(resolve, TEMPO_TESTE_MS)
    );

    if (renovacaoPendente) {
      await renovacaoPendente;
    }

    if (falha !== null) {
      throw new Error(
        "Falha durante a renovação automática."
      );
    }

    const valido = await repository.validar(token);

    if (!valido || renovacoes < 1) {
      throw new Error(
        "Renovação automática não foi confirmada."
      );
    }

    console.log(
      "[3/3] Bloqueio continua válido."
    );

    console.log(
      "\nTESTE APROVADO — Renovação automática."
    );

  } finally {
    clearInterval(intervalo);

    if (renovacaoPendente) {
      await renovacaoPendente;
    }

    await repository.liberar(token);

    // Limpa somente o bloqueio de teste
    // depois de liberado.
    await prisma.syncLock.deleteMany({
      where: {
        id: TEST_LOCK_ID,
        token: null,
      },
    });
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
