import assert from "node:assert/strict";
import { test } from "node:test";
import { localizarProdutos, resumoSeguro } from "../integrations/hiper/client.js";

test("localiza produtos quando a API devolve array", () => {
  const resposta = [{ id: "abc", nome: "iPhone 13", preco: 2000 }];
  assert.deepEqual(localizarProdutos(resposta), resposta);
});

test("localiza produtos num objeto de listagem", () => {
  const resposta = { dados: { produtos: [{ id: "abc", nome: "iPhone 13" }] } };
  assert.equal(localizarProdutos(resposta)?.[0]?.nome, "iPhone 13");
});

test("não presume produto em formato desconhecido", () => {
  assert.equal(localizarProdutos({ errors: [], message: "ok" }), null);
});

test("resumo não exibe informações não selecionadas", () => {
  const resumo = resumoSeguro({ id: "p1", nome: "iPhone", dadoSecreto: "nao mostrar" });
  assert.equal("dadoSecreto" in resumo, false);
  assert.equal(resumo.nome, "iPhone");
});
