/**
 * Cliente de leitura para a API de e-commerce do Hiper.
 * Fonte: Documentação técnica API - Loja Virtual - Integração com Hiper via API Personalizada.
 * Nenhuma rota de escrita (POST/PUT) é utilizada nesta etapa.
 */
const BASE_URL = "https://ms-ecommerce.hiper.com.br/api/v1";

export type HiperProduto = {
  id?: string;
  codigo?: string | number;
  codigoDeBarras?: string;
  nome?: string;
  categoria?: string;
  marca?: string;
  preco?: number;
  quantidadeEmEstoque?: number;
  quantidadeEmEstoqueReservado?: number;
  ativo?: boolean;
  removido?: boolean;
  grade?: boolean;
  variacao?: unknown;
  imagem?: string | null;
  [key: string]: unknown;
};

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function detalheSeguroDeErro(
  valor: unknown,
  token?: string
): string | null {
  if (!objeto(valor)) return null;

  const mensagens: string[] = [];

  for (const campo of ["message", "mensagem", "detail", "title"] as const) {
    if (typeof valor[campo] === "string" && valor[campo].trim()) {
      mensagens.push(valor[campo]);
    }
  }

  if (Array.isArray(valor.errors)) {
    for (const erro of valor.errors.slice(0, 3)) {
      if (typeof erro === "string" && erro.trim()) {
        mensagens.push(erro);
      } else if (objeto(erro)) {
        for (const campo of ["message", "mensagem", "description", "detail"] as const) {
          if (typeof erro[campo] === "string" && erro[campo].trim()) {
            mensagens.push(erro[campo]);
            break;
          }
        }
      }
    }
  }

  if (!mensagens.length) return null;

  let texto = mensagens.join(" | ");

  if (token) {
    texto = texto.replaceAll(token, "[TOKEN OCULTO]");
  }

  texto = texto
    .replace(/Bearer\s+\S+/gi, "Bearer [TOKEN OCULTO]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/g, "[TOKEN OCULTO]")
    .replace(/https?:\/\/\S*?\/auth\/gerar-token\/\S+/gi, "[URL DE AUTENTICAÇÃO OCULTA]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[CHAVE OCULTA]");

  return texto.slice(0, 350);
}


async function requisitarJson(
  url: URL,
  operacao: string,
  token?: string,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : undefined,
    signal: AbortSignal.timeout(20_000),
  });

  let resposta: unknown;

  try {
    resposta = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(
        `${operacao}: Hiper respondeu HTTP ${response.status} (sem detalhes JSON).`
      );
    }

    throw new Error(
      `${operacao}: Hiper retornou um corpo que não é JSON válido.`
    );
  }

  if (!response.ok) {
    const detalhe = detalheSeguroDeErro(resposta, token);

    throw new Error(
      `${operacao}: Hiper respondeu HTTP ${response.status}` +
      (detalhe
        ? ` — ${detalhe}`
        : " (sem mensagem de erro no JSON)") +
      "."
    );
  }

  return resposta;
}


export async function gerarToken(chave: string): Promise<string> {
  const valor = chave.trim();
  if (!valor || valor === "SUBSTITUA_PELA_CHAVE_DE_64_CARACTERES") {
    throw new Error("Configure HIPER_CHAVE_SEGURANCA no arquivo .env.");
  }

  const url = new URL(`${BASE_URL}/auth/gerar-token/${encodeURIComponent(valor)}`);
  const resposta = await requisitarJson(url, "Autenticação");
  if (!objeto(resposta) || typeof resposta.token !== "string" || !resposta.token) {
    throw new Error("Autenticação: a API não retornou um token válido.");
  }
  return resposta.token;
}

export async function consultarProdutos(
  token: string
): Promise<unknown> {
  const url = new URL(
    `${BASE_URL}/produtos/pontoDeSincronizacao`
  );

  url.searchParams.set("pontoDeSincronizacao", "0");

  return requisitarJson(
    url,
    "GET Produtos (sincronização)",
    token
  );
}

export async function listarProdutos(token: string, pagina = 1): Promise<unknown> {
  if (!Number.isSafeInteger(pagina) || pagina < 1) {
    throw new Error("Página deve ser um inteiro positivo.");
  }
  const url = new URL(`${BASE_URL}/produtos/listagemDeProdutos`);
  url.searchParams.set("pontoDeSincronizacao", "0");
  url.searchParams.set("pagina", String(pagina));
  return requisitarJson(url, "Listagem de produtos", token);
}

/**
 * Descobre produtos sem assumir a estrutura do envelope de resposta.
 * Confirmaremos o formato real após a primeira consulta da conta Sunset.
 */
export function localizarProdutos(resposta: unknown): HiperProduto[] | null {
  if (Array.isArray(resposta)) {
    return resposta.every(objeto) ? (resposta as HiperProduto[]) : null;
  }
  if (!objeto(resposta)) return null;

  for (const chave of ["produtos", "items", "itens", "dados", "data", "resultado", "results", "content", "lista"]) {
    const valor = resposta[chave];
    if (Array.isArray(valor) && valor.every(objeto)) {
      return valor as HiperProduto[];
    }
    if (objeto(valor)) {
      const internos = localizarProdutos(valor);
      if (internos !== null) return internos;
    }
  }

  // Em formatos diferentes, prefere arrays de objetos que parecem produtos.
  for (const valor of Object.values(resposta)) {
    if (Array.isArray(valor) && valor.length > 0 && valor.every(objeto)) {
      if (valor.some((item) => "nome" in item || "codigoDeBarras" in item)) {
        return valor as HiperProduto[];
      }
    }
  }
  return null;
}

export function resumoSeguro(produto: HiperProduto) {
  // Apenas os campos necessários para validar a integração. Sem JWT ou credenciais.
  return {
    id: produto.id ?? null,
    nome: produto.nome ?? null,
    codigo: produto.codigo ?? null,
    codigoDeBarras: produto.codigoDeBarras ?? null,
    categoria: produto.categoria ?? null,
    preco: produto.preco ?? null,
    estoque: produto.quantidadeEmEstoque ?? null,
    estoqueReservado: produto.quantidadeEmEstoqueReservado ?? null,
    ativo: produto.ativo ?? null,
    removido: produto.removido ?? null,
    grade: produto.grade ?? null,
    quantidadeVariacoes: Array.isArray(produto.variacao) ? produto.variacao.length : null,
    temImagem: Boolean(produto.imagem),
  };
}
