
import "dotenv/config";
import assert from "node:assert/strict";

import {
  CatalogRepository,
} from "../repositories/catalog.repository.js";

import {
  prisma,
} from "../config/database.js";

async function main() {
  console.log("\nSUNSET — TESTE DO FILTRO DO CATÁLOGO");

  const repository = new CatalogRepository();

  const produtos = await repository.buscarDisponiveis();

  const ids = produtos.map((p) => p.hiperId);

  // Verificar no banco a situação completa
  // dos registros retornados pelo Repository.
  const registros = await prisma.iphone.findMany({
    where: {
      hiperId: { in: ids },
    },
    select: {
      hiperId: true,
      ativoCadastro: true,
      disponivel: true,
      quantidade: true,
    },
  });

  assert.equal(
    new Set(ids).size,
    ids.length,
    "O Repository retornou IDs duplicados."
  );

  assert.equal(
    registros.length,
    produtos.length,
    "Quantidade de registros divergente."
  );

  for (const iphone of registros) {
    assert.equal(iphone.ativoCadastro, true);
    assert.equal(iphone.disponivel, true);
    assert.ok(
      iphone.quantidade > 0,
      "iPhone sem estoque retornado pelo catálogo."
    );
  }

  // Garante que o Repository não esteja omitindo
  // produtos que satisfazem o filtro.
  const totalEsperado = await prisma.iphone.count({
    where: {
      ativoCadastro: true,
      disponivel: true,
      quantidade: { gt: 0 },
    },
  });

  assert.equal(produtos.length, totalEsperado);

  console.table({
    registrosRetornados: produtos.length,
    registrosEsperados: totalEsperado,
    inconsistencias: 0,
  });

  console.log(
    "\nAPROVADO — Filtro do catálogo consistente."
  );
}

main()
  .catch((erro: unknown) => {
    console.error(
      "TESTE REPROVADO:",
      erro instanceof Error
        ? erro.message
        : "Erro desconhecido"
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
