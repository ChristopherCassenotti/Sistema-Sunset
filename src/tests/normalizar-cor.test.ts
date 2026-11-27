
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

test("unifica as variações de titânio branco", () => {
  for (const cor of [
    "White Titanium",
    "TITANIO-BRANCO",
    "Titânio Branco",
    "Branco",
  ]) {
    assert.equal(normalizarCor(cor), "BRANCO");
  }
});

test("unifica as variações de preto espacial", () => {
  for (const cor of [
    "SPACE BLACK",
    "Space-Black",
    "PRETO-ESPACIAL",
    "Preto",
  ]) {
    assert.equal(normalizarCor(cor), "PRETO");
  }
});

test("iPhone 13 e 14: branco, creme e starlight viram Estelar", () => {
  for (const modelo of ["iPhone 13", "iPhone 13 Mini", "iPhone 14", "iPhone 14 Plus"]) {
    for (const cor of ["Branco", "Creme", "Starlight", "ESTELAR"]) {
      assert.equal(normalizarCor(cor, modelo), "ESTELAR");
    }
  }
});

test("iPhone 13 e 14: meia-noite e preto viram Preto", () => {
  assert.equal(normalizarCor("MEIA-NOITE", "iPhone 13"), "PRETO");
  assert.equal(normalizarCor("Preto", "iPhone 14"), "PRETO");
});

test("iPhone 13 Pro: preto vira Grafite e branco vira Prateado", () => {
  for (const modelo of ["iPhone 13 Pro", "iPhone 13 Pro Max"]) {
    assert.equal(normalizarCor("PRETO-ESPACIAL", modelo), "GRAFITE");
    assert.equal(normalizarCor("Preto", modelo), "GRAFITE");
    assert.equal(normalizarCor("Branco", modelo), "PRATEADO");
    assert.equal(normalizarCor("AZUL-SIERRA", modelo), "AZUL");
    assert.equal(normalizarCor("VERDE-ALPINO", modelo), "VERDE");
  }
});

test("regras por modelo não afetam outros modelos", () => {
  assert.equal(normalizarCor("Branco", "iPhone 16"), "BRANCO");
  assert.equal(normalizarCor("Preto", "iPhone 14 Pro Max"), "PRETO");
  assert.equal(normalizarCor("Branco", "iPhone 13 Pro Max", ), "PRATEADO");
});
