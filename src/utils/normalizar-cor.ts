function limparTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Sinônimos válidos para qualquer modelo.
const equivalencias: Record<string, string> = {
  "COSMIC ORANGE": "LARANJA CÓSMICO",
  "LARANJA COSMICO": "LARANJA CÓSMICO",
  "ORANGE COSMIC": "LARANJA CÓSMICO",
  "NATURAL TITANIUM": "TITÂNIO NATURAL",
  "TITANIO NATURAL": "TITÂNIO NATURAL",
  "BLACK": "PRETO",
  "SPACE BLACK": "PRETO",
  "PRETO ESPACIAL": "PRETO",
  "MEIA NOITE": "PRETO",
  "MIDNIGHT": "PRETO",
  "WHITE": "BRANCO",
  "WHITE TITANIUM": "BRANCO",
  "TITANIUM WHITE": "BRANCO",
  "TITANIO BRANCO": "BRANCO",
  "BRANCO TITANIO": "BRANCO",
  "STARLIGHT": "ESTELAR",
  "ROSE": "ROSA",
  "AZUL SIERRA": "AZUL",
  "SIERRA BLUE": "AZUL",
  "VERDE ALPINO": "VERDE",
  "ALPINE GREEN": "VERDE",
};

// Cores que, em certos modelos, só podem ser outra cor oficial.
const porModelo: Array<{
  modelo: RegExp;
  cores: Record<string, string>;
}> = [
  {
    // iPhone 13 e 14 não têm branco: o claro é Estelar.
    modelo: /^IPHONE 1[34]( MINI| PLUS)?$/,
    cores: {
      "BRANCO": "ESTELAR",
      "CREME": "ESTELAR",
    },
  },
  {
    // 13 Pro: o escuro é Grafite e o claro é Prateado.
    modelo: /^IPHONE 13 PRO( MAX)?$/,
    cores: {
      "PRETO": "GRAFITE",
      "BRANCO": "PRATEADO",
    },
  },
];

export function normalizarCor(
  cor: string,
  modelo?: string
): string {
  const texto = limparTexto(cor);
  const geral = equivalencias[texto] ?? texto;

  if (!modelo) {
    return geral;
  }

  const modeloLimpo = limparTexto(modelo);
  const regra = porModelo.find((r) =>
    r.modelo.test(modeloLimpo)
  );

  return regra?.cores[geral] ?? geral;
}
