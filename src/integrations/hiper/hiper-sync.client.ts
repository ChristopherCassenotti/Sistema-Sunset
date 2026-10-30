
import { gerarToken } from "./client.js";

const BASE_URL =
  "https://ms-ecommerce.hiper.com.br/api/v1";

type RespostaHiper = {
  pontoDeSincronizacao?: number;
  produtos?: unknown[];
  errors?: unknown[];
  message?: string | null;
};

export type LoteHiper = {
  ponto: number;
  produtos: unknown[];
  semAlteracoes: boolean;
};

export async function buscarAlteracoesHiper(
  chave: string,
  pontoAtual: number
): Promise<LoteHiper> {
  const token = await gerarToken(chave);

  const url = new URL(
    `${BASE_URL}/produtos/pontoDeSincronizacao`
  );

  url.searchParams.set(
    "pontoDeSincronizacao",
    String(pontoAtual)
  );

  const resposta = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(60_000),
  });

  const dados: RespostaHiper = await resposta.json();

  // Comportamento observado na conta da Sunset:
  // 400 + "Nenhum produto encontrado" quando não há
  // registros retornados para o ponto solicitado.
  const erros = Array.isArray(dados.errors)
    ? dados.errors.filter(
        (e): e is string => typeof e === "string"
      )
    : [];

  const semProdutos =
    erros.length === 1 &&
    erros[0]?.trim().toLowerCase() ===
      "nenhum produto encontrado";

  if (resposta.status === 400 && semProdutos) {
    return {
      ponto: pontoAtual,
      produtos: [],
      semAlteracoes: true,
    };
  }

  if (!resposta.ok) {
    throw new Error(
      `Consulta incremental do Hiper: HTTP ${resposta.status}`
    );
  }

  if (erros.length > 0) {
    throw new Error(
      "Hiper retornou erros na consulta incremental."
    );
  }

  if (
    !Number.isSafeInteger(dados.pontoDeSincronizacao) ||
    dados.pontoDeSincronizacao! < pontoAtual ||
    !Array.isArray(dados.produtos)
  ) {
    throw new Error(
      "Estrutura ou ponto de sincronização inválido."
    );
  }

  return {
    ponto: dados.pontoDeSincronizacao!,
    produtos: dados.produtos,
    semAlteracoes: dados.produtos.length === 0,
  };
}
