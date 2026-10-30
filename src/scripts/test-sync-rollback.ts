
import "dotenv/config";

import { prisma } from "../config/database.js";
import {
  SyncLockRepository,
} from "../repositories/sync-lock.repository.js";
import {
  SyncRepository,
} from "../repositories/sync.repository.js";

async function main() {
  console.log("\nSUNSET — TESTE DE ROLLBACK");

  const repository = new SyncRepository();

  // Selecionar um registro real somente
  // para verificar a reversão da transação.
  const iphone = await prisma.iphone.findFirst({
    where: {
      disponivel: true,
      quantidade: { gt: 0 },
    },
    orderBy: { id: "asc" },
  });

  if (!iphone) {
    throw new Error(
      "Nenhum iPhone disponível para testar."
    );
  }

  const pontoAnterior = await repository.buscarPonto();

  if (pontoAnterior === null) {
    throw new Error(
      "Checkpoint não encontrado."
    );
  }

  const estadoAnterior = {
    hiperId: iphone.hiperId,
    disponivel: iphone.disponivel,
    quantidade: iphone.quantidade,
    ponto: pontoAnterior,
  };

  console.log("[1/4] Estado inicial");
  console.table({
    disponivel: estadoAnterior.disponivel,
    quantidade: estadoAnterior.quantidade,
    ponto: estadoAnterior.ponto,
  });

  console.log("[2/4] Simulando falha na transação...");

  let falhaCapturada = false;
const lockRepository = new SyncLockRepository();

const lockToken = await lockRepository.adquirir();

if (!lockToken) {
  throw new Error(
    "Não foi possível adquirir o bloqueio para o teste."
  );
}

try {
  await repository.aplicarLoteAtomico({
    lockToken,
    sincronizacaoId: -1,
    pontoAnterior,
    pontoNovo: pontoAnterior + 1,
    produtosRecebidos: 1,
    unidades: [],
    idsIndisponiveis: [iphone.hiperId],
    tipo: "teste rollback",
  });
} catch (erro) {
  falhaCapturada = true;

  console.log("Falha provocada foi capturada.");

  console.log(
    "Tipo:",
    erro instanceof Error
      ? erro.constructor.name
      : "desconhecido"
  );
} finally {
  await lockRepository.liberar(lockToken);
}


  console.log("[3/4] Consultando MySQL novamente...");

  const [iphoneDepois, pontoDepois] =
    await Promise.all([
      prisma.iphone.findUnique({
        where: { hiperId: iphone.hiperId },
      }),
      repository.buscarPonto(),
    ]);

  if (!iphoneDepois) {
    throw new Error(
      "Registro de teste não encontrado."
    );
  }

  const produtoPreservado =
    iphoneDepois.disponivel === estadoAnterior.disponivel &&
    iphoneDepois.quantidade === estadoAnterior.quantidade;

  const checkpointPreservado =
    pontoDepois === estadoAnterior.ponto;

  console.log("[4/4] Resultado");

  console.table({
    falhaCapturada,
    produtoPreservado,
    checkpointPreservado,
  });

  if (
    !falhaCapturada ||
    !produtoPreservado ||
    !checkpointPreservado
  ) {
    throw new Error(
      "TESTE REPROVADO: rollback não confirmado."
    );
  }

  console.log(
    "\nTESTE APROVADO — Transação revertida."
  );

  console.log(
    "O iPhone e o checkpoint foram preservados."
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
