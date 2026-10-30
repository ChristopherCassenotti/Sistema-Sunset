
import type {
  HiperProduto,
} from "../integrations/hiper/client.js";

import {
  montarCatalogo,
  type UnidadeIphone,
} from "../modules/catalog/normalizer.js";

export type PlanoSincronizacao = {
  unidades: UnidadeIphone[];
  idsIndisponiveis: string[];
  gruposVisuais: number;
};

export function prepararSincronizacao(
  produtos: HiperProduto[]
): PlanoSincronizacao {
  const resultado = montarCatalogo(produtos);

  const unidades = resultado.grupos.flatMap(
    (grupo) => grupo.unidades
  );

  const idsDisponiveis = new Set(
    unidades.map((unidade) => unidade.hiperId)
  );

  const idsIndisponiveis = produtos
    .filter((produto) => {
      if (
        !produto.id ||
        idsDisponiveis.has(produto.id)
      ) {
        return false;
      }

      const saldo = produto.quantidadeEmEstoque;

      const estoqueZerado =
        typeof saldo === "number" &&
        Number.isFinite(saldo) &&
        saldo <= 0;

      return (
        estoqueZerado ||
        produto.ativo === false ||
        produto.removido === true
      );
    })
    .map((produto) => produto.id)
    .filter(
      (id): id is string => typeof id === "string"
    );

  return {
    unidades,
    idsIndisponiveis: [
      ...new Set(idsIndisponiveis)
    ],
    gruposVisuais: resultado.grupos.length,
  };
}
