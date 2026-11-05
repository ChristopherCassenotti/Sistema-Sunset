
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizarCor,
} from "../utils/normalizar-cor.js";

test("padroniza Cosmic Orange", () => {
  assert.equal(
    normalizarCor("COSMIC ORANGE"),
    "LARANJA CÓSMICO"
  );
});

test("padroniza Laranja-Cósmico", () => {
  assert.equal(
    normalizarCor("LARANJA-CÓSMICO"),
    "LARANJA CÓSMICO"
  );
});

test("mantém laranja isolado", () => {
  assert.equal(
    normalizarCor("LARANJA"),
    "LARANJA"
  );
});

test("padroniza inglês e português", () => {
  assert.equal(
    normalizarCor("BLACK"),
    "PRETO"
  );
});

test("remove diferenças de espaçamento", () => {
  assert.equal(
    normalizarCor("  laranja   cosmico "),
    "LARANJA CÓSMICO"
  );
});
