
import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  HiperProduto,
} from "../integrations/hiper/client.js";

import {
  prepararSincronizacao,
} from "../services/sync-rules.service.js";

function produto(
  id: string,
  alteracoes: Record<string, unknown> = {}
): HiperProduto {
  return {
    id,
    nome: "IPHONE 13, PRETO, 128GB (USADO) - TESTE",
    categoria: "IPHONE",
    codigo: 100,
    preco: 2499,
    quantidadeEmEstoque: 1,
    ativo: true,
    removido: false,
    grade: false,
    ...alteracoes,
  } as HiperProduto;
}

test("mantém iPhone disponível com estoque positivo", () => {
  const plano = prepararSincronizacao([
    produto("iphone-1"),
  ]);

  assert.equal(plano.unidades.length, 1);
  assert.equal(plano.unidades[0]?.quantidade, 1);
  assert.deepEqual(plano.idsCadastroInativos, []);
});

test("reconhece alteração de preço", () => {
  const plano = prepararSincronizacao([
    produto("iphone-1", { preco: 2199 }),
  ]);

  assert.equal(plano.unidades[0]?.preco, 2199);
});

test("reconhece alteração de quantidade", () => {
  const plano = prepararSincronizacao([
    produto("iphone-1", {
      quantidadeEmEstoque: 3,
    }),
  ]);

  assert.equal(plano.unidades[0]?.quantidade, 3);
});


test("estoque zerado não desativa cadastro", () => {
  const plano = prepararSincronizacao([
    produto("iphone-1", {
      quantidadeEmEstoque: 0,
    }),
  ]);

  // Não há unidade disponível para publicação.
  assert.equal(plano.unidades.length, 0);

  // Estoque zerado não significa cadastro inativo.
  assert.deepEqual(
    plano.idsCadastroInativos,
    []
  );

  // O cadastro continua ativo no Hiper.
  assert.deepEqual(
    plano.idsCadastroAtivos,
    ["iphone-1"]
  );
});


test("marca produto desativado como indisponível", () => {
  const plano = prepararSincronizacao([
    produto("iphone-1", { ativo: false }),
  ]);

  assert.deepEqual(
    plano.idsCadastroInativos,
    ["iphone-1"]
  );
});

test("marca produto removido como indisponível", () => {
  const plano = prepararSincronizacao([
    produto("iphone-1", { removido: true }),
  ]);

  assert.deepEqual(
    plano.idsCadastroInativos,
    ["iphone-1"]
  );
});

test("permite reativação quando o estoque volta", () => {
  const plano = prepararSincronizacao([
    produto("iphone-1", {
      quantidadeEmEstoque: 1,
    }),
  ]);

  assert.equal(plano.unidades.length, 1);
  assert.deepEqual(plano.idsCadastroInativos, []);
});

test("não indisponibiliza produtos ausentes do lote", () => {
  const plano = prepararSincronizacao([
    produto("iphone-2"),
  ]);

  assert.equal(plano.unidades.length, 1);
  assert.equal(plano.unidades[0]?.hiperId, "iphone-2");

  assert.equal(
    plano.idsCadastroInativos.includes("iphone-1"),
    false
  );
});

test("não trata cadastro incompleto como vendido", () => {
  const plano = prepararSincronizacao([
    produto("iphone-1", {
      nome: "IPHONE SEM MODELO DEFINIDO",
      quantidadeEmEstoque: 1,
    }),
  ]);

  assert.equal(plano.unidades.length, 0);
  assert.deepEqual(plano.idsCadastroInativos, []);
});

test("exclui acessórios do catálogo", () => {
  const plano = prepararSincronizacao([
    produto("acessorio-1", {
      nome: "CAPINHA IPHONE 13",
      categoria: "ACESSORIOS",
    }),
  ]);

  assert.equal(plano.unidades.length, 0);
});
