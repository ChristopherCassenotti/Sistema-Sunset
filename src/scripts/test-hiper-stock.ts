
import "dotenv/config";

import {
  gerarToken,
} from "../integrations/hiper/client.js";

const BASE_URL =
  "https://ms-ecommerce.hiper.com.br/api/v1";

type Objeto = Record<string, unknown>;

function ehObjeto(valor: unknown): valor is Objeto {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

async function main() {
  console.log(
    "\nSUNSET — TESTE DE ESTOQUE PAGINADO"
  );

  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error(
      "Chave do Hiper não configurada."
    );
  }

  console.log("[1/3] Autenticando...");
  const token = await gerarToken(chave);

  const url = new URL(
    `${BASE_URL}/estoques/estoquesDeProdutos`
  );

  url.searchParams.set(
    "pontoDeSincronizacao",
    "0"
  );

  url.searchParams.set("pagina", "1");

  console.log(
    "[2/3] Consultando primeira página de estoques..."
  );

  const resposta = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(60_000),
  });

  const texto = await resposta.text();

  let dados: unknown;

  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(
      `HTTP ${resposta.status}: resposta não é JSON.`
    );
  }

  console.log("HTTP:", resposta.status);

  if (!ehObjeto(dados)) {
    console.log(
      "Resposta não é objeto JSON."
    );
    return;
  }

  console.log("[3/3] Estrutura retornada:");

  console.log(
    "Campos principais:",
    Object.keys(dados)
  );

  console.log(
    "Ponto retornado:",
    dados.pontoDeSincronizacao ??
      "não informado"
  );

  for (const [campo, valor] of Object.entries(dados)) {
    if (Array.isArray(valor)) {
      console.log(
        `Array "${campo}": ${valor.length} registros`
      );

      if (
        valor.length > 0 &&
        ehObjeto(valor[0])
      ) {
        console.log(
          `Campos do primeiro item de "${campo}":`,
          Object.keys(valor[0])
        );
      }
    }
  }

  if (!resposta.ok) {
    const erros = Array.isArray(dados.errors)
      ? dados.errors.filter(
          (erro): erro is string =>
            typeof erro === "string"
        )
      : [];

    console.log(
      "Erros:",
      erros.slice(0, 3).map(
        (erro) => erro.slice(0, 150)
      )
    );
  }

  console.log(
    "\nTeste concluído. Nenhum dado foi alterado."
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
