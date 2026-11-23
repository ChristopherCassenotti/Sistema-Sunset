/**
 * Guarda o último resultado por pouco tempo e une chamadas simultâneas em uma só,
 * para que um pico de acessos gere uma única consulta. Falhas não são guardadas.
 */
export function criarCacheCurto<T>(
  buscar: () => Promise<T>,
  duracaoMs: number,
  agora: () => number = Date.now
) {
  let valor: { dados: T; expiraEm: number } | null = null;
  let emAndamento: Promise<T> | null = null;

  return function obter(): Promise<T> {
    if (valor && agora() < valor.expiraEm) {
      return Promise.resolve(valor.dados);
    }

    emAndamento ??= buscar()
      .then((dados) => {
        valor = { dados, expiraEm: agora() + duracaoMs };
        return dados;
      })
      .finally(() => {
        emAndamento = null;
      });

    return emAndamento;
  };
}
