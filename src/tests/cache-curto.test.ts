import { test } from "node:test";
import assert from "node:assert/strict";

import { criarCacheCurto } from "../utils/cache-curto.js";

test("reutiliza o resultado dentro do prazo", async () => {
  let consultas = 0;
  let relogio = 0;
  const obter = criarCacheCurto(async () => ++consultas, 1000, () => relogio);

  assert.equal(await obter(), 1);
  relogio = 999;
  assert.equal(await obter(), 1);
  assert.equal(consultas, 1);
});

test("consulta de novo quando o prazo termina", async () => {
  let consultas = 0;
  let relogio = 0;
  const obter = criarCacheCurto(async () => ++consultas, 1000, () => relogio);

  await obter();
  relogio = 1000;
  assert.equal(await obter(), 2);
});

test("une chamadas simultâneas em uma consulta", async () => {
  let consultas = 0;
  const obter = criarCacheCurto(async () => ++consultas, 1000);

  const resultados = await Promise.all([obter(), obter(), obter()]);

  assert.deepEqual(resultados, [1, 1, 1]);
  assert.equal(consultas, 1);
});

test("não guarda falhas", async () => {
  let consultas = 0;
  const obter = criarCacheCurto(async () => {
    consultas += 1;
    if (consultas === 1) throw new Error("banco indisponível");
    return "ok";
  }, 1000);

  await assert.rejects(obter());
  assert.equal(await obter(), "ok");
});
