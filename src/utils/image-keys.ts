
import { normalizarCor } from "./normalizar-cor.js";

function limpar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function modeloChaveImagem(modelo: string): string {
  let chave = limpar(modelo);

  // Modelos que compartilham a mesma aparência.
  chave = chave.replace(/^IPHONE XS MAX$/, "IPHONE XS");
  chave = chave.replace(/^IPHONE 12 MINI$/, "IPHONE 12");
  chave = chave.replace(/^IPHONE 13 MINI$/, "IPHONE 13");

  chave = chave.replace(
    /^IPHONE (\d+) PLUS$/,
    "IPHONE $1"
  );

  chave = chave.replace(
    /^IPHONE (\d+) PRO MAX$/,
    "IPHONE $1 PRO"
  );

  // Referências específicas da biblioteca.
  chave = chave.replace(/^IPHONE AIR$/, "IPHONE 17 AIR");
  chave = chave.replace(/^IPHONE 18$/, "IPHONE 18 PRO");

  // Variações de nomenclatura do SE.
  chave = chave.replace(
    /^IPHONE SE (?:2|2A|2 GERA[CÇ]AO|GEN2)$/,
    "IPHONE SE GEN2"
  );

  chave = chave.replace(
    /^IPHONE SE (?:3|3A|3 GERA[CÇ]AO|G3)$/,
    "IPHONE SE G3"
  );

  return chave;
}

export function corChaveImagem(
  modelo: string,
  cor: string
): string {
  const modeloKey = modeloChaveImagem(modelo);
  const corNormalizada = limpar(normalizarCor(cor));

  // Sinônimos gerais.
  const equivalencias: Record<string, string> = {
    "BLACK": "PRETO",
    "WHITE": "BRANCO",
    "SILVER": "PRATEADO",
    "GOLD": "DOURADO",
    "GLACIER": "GLACIAL",
    "TITANIO NATURAL": "NATURAL",
    "TITANIUM NATURAL": "NATURAL",
    "TITANIO PRETO": "PRETO",
    "TITANIO BRANCO": "BRANCO",
    "TITANIO AZUL": "AZUL",
    "TITANIO DESERTO": "DESERTO",
    "AZUL INTENSO": "AZUL",
    "AZUL SIERRA": "AZUL",
    "AZUL PACIFICO": "AZUL",
    "ROXO PROFUNDO": "ROXO",
    "PRETO ESPACIAL": "PRETO",
    "VERDE ALPINO": "VERDE",
    "VERDE MEIA NOITE": "VERDE",
    "CINZA ESPACIAL": "CINZA",
    "MEIA NOITE": "PRETO",
    "MIDNIGHT": "PRETO",
    "SPACE GRAY": "CINZA",
    "SPACE GREY": "CINZA",
    "CORAL": "LARANJA",
    "BORDO": "BORDO",
  };

  let chave =
    equivalencias[corNormalizada] ?? corNormalizada;

  // Na biblioteca, a cor do 17 Pro foi
  // salva como "laranja".
  if (
    modeloKey === "IPHONE 17 PRO" &&
    (chave === "LARANJA" ||
      chave === "LARANJA COSMICO")
  ) {
    chave = "LARANJA COSMICO";
  }

  return chave;
}

export function chaveImagem(
  modelo: string,
  cor: string
): string {
  return [
    modeloChaveImagem(modelo),
    corChaveImagem(modelo, cor),
  ].join("|");
}
