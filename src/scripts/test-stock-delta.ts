
import "dotenv/config";
import { gerarToken } from "../integrations/hiper/client.js";

const BASE_URL =
  "https://ms-ecommerce.hiper.com.br/api/v1";

type Resposta = {
  pontoDeSituacao?: number;
  pagina?: number;
  estoquesDeProdutos?: Array<{
    produtoId?: string;
    pontoDeSincronizacao?: number;
    quantidadeEmEstoque?: number;
    quantidadeEmEstoqueReservado?: number;
  }>;
  errors?: string[];
};

async function main() {
  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error("Chave do Hiper não configurada.");
  }

  console.log("\nSUNSET — ESTOQUE INCREMENTAL");

  const token = await gerarToken(chave);
  const pontoAnterior = 15600;

  const url = new URL(
    `${BASE_URL}/estoques/estoquesDeProdutos`
  );

  url.searchParams.set(
    "pontoDeSincronizacao",
    String(pontoAnterior)
  );
  url.searchParams.set("pagina", "1");

  const resposta = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(60000),
  });

  const dados = (await resposta.json()) as Resposta;
  const registros = Array.isArray(dados.estoquesDeProdutos)
    ? dados.estoquesDeProdutos
    : [];

  console.table({
    http: resposta.status,
    pontoAnterior,
    pontoDeSituacao:
      dados.pontoDeSituacao ?? "não informado",
    pagina: dados.pagina ?? "não informado",
    registrosRecebidos: registros.length,
  });

  console.log(
    "Erros:",
    Array.isArray(dados.errors)
      ? dados.errors
          .filter((e) => typeof e === "string")
          .slice(0, 3)
      : []
  );

  console.log(
    "\nTeste concluído. Nenhum dado foi alterado."
  );
}

main().catch((erro: unknown) => {
  console.error(
    erro instanceof Error
      ? erro.message
      : "Erro desconhecido"
  );
  process.exitCode = 1;
});
