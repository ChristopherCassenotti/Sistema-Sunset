
import type {
  HiperProduto,
} from "../integrations/hiper/client.js";

import {
  montarCatalogo,
  type UnidadeIphone,
} from "../modules/catalog/normalizer.js";

export type PlanoSincronizacao = {
  unidades: UnidadeIphone[];
  idsCadastroInativos: string[];
  idsCadastroAtivos: string[];
  gruposVisuais: number;
};

export function prepararSincronizacao(
  produtos: HiperProduto[]
): PlanoSincronizacao {
  const resultado = montarCatalogo(produtos);

  const unidades = resultado.grupos.flatMap(
    (grupo) => grupo.unidades
  );

  const idsCadastroInativos = new Set<string>();
  const idsCadastroAtivos = new Set<string>();

  for (const produto of produtos) {
    if (
      typeof produto.id !== "string" ||
      !produto.id
    ) {
      continue;
    }

    // Inatividade cadastral explícita.
    if (
      produto.ativo === false ||
      produto.removido === true
    ) {
      idsCadastroInativos.add(produto.id);
      continue;
    }

    // Somente uma confirmação explícita de
    // cadastro ativo permite reativação.
if (produto.ativo === true) {
  idsCadastroAtivos.add(produto.id);
}
  }

  return {
    unidades,
    idsCadastroInativos: [
      ...idsCadastroInativos,
    ],
    idsCadastroAtivos: [
      ...idsCadastroAtivos,
    ],
    gruposVisuais: resultado.grupos.length,
  };
}
