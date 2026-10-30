
import "dotenv/config";

import { gerarToken } from
  "../integrations/hiper/client.js";

import { prisma } from
  "../config/database.js";

const BASE_URL =
  "https://ms-ecommerce.hiper.com.br/api/v1";

type Json = Record<string, unknown>;

function objeto(v: unknown): v is Json {
  return typeof v === "object" &&
    v !== null && !Array.isArray(v);
}

async function consultarPagina(
  token: string,
  pagina: number
) {
  const url = new URL(
    `${BASE_URL}/estoques/estoquesDeProdutos`
  );

  url.searchParams.set(
    "pontoDeSincronizacao", "0"
  );
  url.searchParams.set(
    "pagina", String(pagina)
  );

  const resposta = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(60_000),
  });

  const dados: unknown = await resposta.json();

  if (!objeto(dados)) {
    throw new Error("Resposta inválida do Hiper.");
  }

  const itens = Array.isArray(dados.estoquesDeProdutos)
    ? dados.estoquesDeProdutos.filter(objeto)
    : [];

  const erros = Array.isArray(dados.errors)
    ? dados.errors.filter(
        (e): e is string => typeof e === "string"
      )
    : [];

  return {
    http: resposta.status,
    paginaRetornada: dados.pagina,
    pontoDeSituacao: dados.pontoDeSituacao,
    localDeEstoqueId: dados.localDeEstoqueId,
    itens,
    erros,
  };
}

async function main() {
  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error("Chave Hiper não configurada.");
  }

  console.log("\nSUNSET — CONFERÊNCIA DE ESTOQUE");

  const token = await gerarToken(chave);

  const iphones = await prisma.iphone.findMany({
    select: {
      hiperId: true,
      quantidade: true,
      disponivel: true,
    },
  });

  const ids = new Set(
    iphones.map((i) => i.hiperId)
  );

  for (const pagina of [1, 2]) {
    const lote = await consultarPagina(
      token, pagina
    );

    const correspondentes = lote.itens.filter(
      (item) =>
        typeof item.produtoId === "string" &&
        ids.has(item.produtoId)
    );

    const pontos = lote.itens
      .map((item) => item.pontoDeSincronizacao)
      .filter(
        (v): v is number =>
          typeof v === "number" &&
          Number.isSafeInteger(v)
      );

    console.log(`\nPÁGINA ${pagina}`);

    console.table({
      http: lote.http,
      paginaRetornada: String(
        lote.paginaRetornada ?? "não informado"
      ),
      localDeEstoqueIdPresente:
        lote.localDeEstoqueId != null,
      pontoDeSituacao: String(
        lote.pontoDeSituacao ?? "não informado"
      ),
      registrosEstoque: lote.itens.length,
      iphonesCorrespondentes:
        correspondentes.length,
      menorPonto: pontos.length
        ? Math.min(...pontos)
        : "não informado",
      maiorPonto: pontos.length
        ? Math.max(...pontos)
        : "não informado",
    });

    if (lote.erros.length) {
      console.log(
        "Erros:",
        lote.erros.slice(0, 3)
      );
    }

    if (correspondentes.length) {
      console.table(
        correspondentes.map((item) => {
          const iphone = iphones.find(
            (i) => i.hiperId === item.produtoId
          );

          return {
            estoqueHiper:
              item.quantidadeEmEstoque,
            reservadoHiper:
              item.quantidadeEmEstoqueReservado,
            estoqueMySQL:
              iphone?.quantidade,
            disponivelMySQL:
              iphone?.disponivel,
          };
        })
      );
    }

    // Não presumir que um HTTP 400 significa
    // fim da paginação.
    if (lote.http !== 200) {
      break;
    }
  }

  console.log(
    "\nDiagnóstico concluído. Nenhum dado alterado."
  );
}

main()
  .catch((erro: unknown) => {
    console.error(
      erro instanceof Error
        ? erro.message
        : "Erro desconhecido"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
