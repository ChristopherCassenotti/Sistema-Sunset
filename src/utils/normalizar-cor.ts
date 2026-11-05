
export function normalizarCor(cor: string): string {
  const texto = cor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const equivalencias: Record<string, string> = {
    "COSMIC ORANGE": "LARANJA CÓSMICO",
    "LARANJA COSMICO": "LARANJA CÓSMICO",
    "ORANGE COSMIC": "LARANJA CÓSMICO",
    "NATURAL TITANIUM": "TITÂNIO NATURAL",
    "TITANIO NATURAL": "TITÂNIO NATURAL",
    "BLACK": "PRETO",
    "WHITE": "BRANCO",
  };

  return equivalencias[texto] ?? texto;
}
