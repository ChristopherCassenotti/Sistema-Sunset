
import { gerarToken } from "./client.js";

const BASE_URL =
  "https://ms-ecommerce.hiper.com.br/api/v1";

export type EstoqueHiper = {
  produtoId: string;
  pontoDeSincronizacao: number;
  quantidadeEmEstoque: number;
  quantidadeEmEstoqueReservado: number;
  quantidadeMinimaEmEstoque?: number;
};

type RespostaEstoque = {
  pontoDeSituacao?: number;
  pagina?: number;
  localDeEstoqueId?: string;
  estoquesDeProdutos?: EstoqueHiper[];
  errors?: string[];
};

export type LoteEstoque = {
  pontoAnterior: number;
  pontoAtual: number;
  registros: EstoqueHiper[];
  localDeEstoqueId: string | null;
  semAlteracoes: boolean;
};

export async function consultarEstoqueHiper(
  chave: string,
  pontoAnterior: number
): Promise<LoteEstoque> {
  const token = await gerarToken(chave);

  const registros: EstoqueHiper[] = [];

  let pagina = 1;
  let pontoAtual: number | null = null;
  let localDeEstoqueId: string | null = null;

  while (true) {
    if (pagina > 1000) {
      throw new Error(
        "Limite de segurança da paginação atingido."
      );
    }

    const url = new URL(
      `${BASE_URL}/estoques/estoquesDeProdutos`
    );

    url.searchParams.set(
      "pontoDeSincronizacao",
      String(pontoAnterior)
    );

    url.searchParams.set(
      "pagina",
      String(pagina)
    );

    const resposta = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(60_000),
    });

    const dados =
      (await resposta.json()) as RespostaEstoque;

    const erros = Array.isArray(dados.errors)
      ? dados.errors
      : [];

    const fimDaPagina =
      resposta.status === 400 &&
      erros.length === 1 &&
      erros[0]?.trim().toLowerCase() ===
        "dados de estoque não encontrados para esta consulta.";

    if (fimDaPagina) {
      break;
    }

    if (!resposta.ok) {
      throw new Error(
        `Hiper estoque: HTTP ${resposta.status}`
      );
    }

    if (
      !Array.isArray(dados.estoquesDeProdutos) ||
      !Number.isSafeInteger(dados.pontoDeSituacao) ||
      dados.pontoDeSituacao! < pontoAnterior ||
      dados.pagina !== pagina ||
      erros.length > 0
    ) {
      throw new Error(
        "Resposta de estoque inválida."
      );
    }

    const local =
      dados.localDeEstoqueId ?? null;

    if (pontoAtual === null) {
      pontoAtual = dados.pontoDeSituacao!;
      localDeEstoqueId = local;
    } else if (
      pontoAtual !== dados.pontoDeSituacao ||
      localDeEstoqueId !== local
    ) {
      throw new Error(
        "Inconsistência entre páginas de estoque."
      );
    }

    for (const item of dados.estoquesDeProdutos) {
      if (
        typeof item.produtoId !== "string" ||
        !Number.isFinite(item.quantidadeEmEstoque) ||
        !Number.isFinite(
          item.quantidadeEmEstoqueReservado
        ) ||
        !Number.isSafeInteger(
          item.pontoDeSincronizacao
        )
      ) {
        throw new Error(
          "Registro de estoque inválido."
        );
      }

      registros.push(item);
    }

    // Página 200 válida, mas vazia.
    if (dados.estoquesDeProdutos.length === 0) {
      break;
    }

    pagina++;
  }

  return {
    pontoAnterior,
    pontoAtual: pontoAtual ?? pontoAnterior,
    registros,
    localDeEstoqueId,
    semAlteracoes: registros.length === 0,
  };
}
