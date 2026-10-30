
import "dotenv/config";

import {
  gerarToken,
} from "../integrations/hiper/client.js";

const BASE_URL =
  "https://ms-ecommerce.hiper.com.br/api/v1";

type RespostaHiper = {
  pontoDeSincronizacao?: number;
  produtos?: unknown[];
  errors?: unknown[];
  message?: string | null;
};

async function main() {
  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error("Chave do Hiper não configurada.");
  }

  console.log("[1/3] Autenticando...");

  const token = await gerarToken(chave);

  // Ponto obtido no teste anterior.
  // Apenas para validação; não será salvo no banco.
  const pontoInicial = 17200;

  console.log(
    `[2/3] Consultando alterações após ${pontoInicial}...`
  );

  const url = new URL(
    `${BASE_URL}/produtos/pontoDeSincronizacao`
  );

  url.searchParams.set(
    "pontoDeSincronizacao",
    String(pontoInicial)
  );

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30000),
  });

  console.log("HTTP:", response.status);

  const texto = await response.text();

  let dados: RespostaHiper;

  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(
      "O Hiper não retornou um JSON válido."
    );
  }


if (!response.ok) {
  console.log("HTTP:", response.status);

  console.log(
    "Mensagem:",
    typeof dados.message === "string"
      ? dados.message.slice(0, 150)
      : "Sem mensagem"
  );

  const erros = Array.isArray(dados.errors)
    ? dados.errors
    : [];

  console.log(
    "Erros:",
    erros
      .filter((erro): erro is string =>
        typeof erro === "string"
      )
      .slice(0, 3)
      .map((erro) => erro.slice(0, 150))
  );

  console.log(
    "Ponto retornado:",
    dados.pontoDeSincronizacao ?? "não informado"
  );

  console.log(
    "Produtos retornados:",
    Array.isArray(dados.produtos)
      ? dados.produtos.length
      : "não informado"
  );

  console.log(
    "Consulta não concluída com sucesso."
  );

  return;
}


  console.log("[3/3] Analisando resposta...");

  console.table({
    pontoAnterior: pontoInicial,
    pontoRetornado:
      dados.pontoDeSincronizacao ?? "não informado",
    produtosRecebidos:
      Array.isArray(dados.produtos)
        ? dados.produtos.length
        : "não informado",
    quantidadeErros:
      Array.isArray(dados.errors)
        ? dados.errors.length
        : "não informado",
  });

  console.log(
    "Teste concluído. Nenhum dado foi alterado."
  );
}

main().catch((erro: unknown) => {
  console.error(
    "Falha:",
    erro instanceof Error
      ? erro.message
      : "Erro desconhecido"
  );

  process.exitCode = 1;
});
