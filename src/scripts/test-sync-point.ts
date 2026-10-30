
import "dotenv/config";

import {
  gerarToken,
  consultarProdutos,
  localizarProdutos,
} from "../integrations/hiper/client.js";

function objeto(
  valor: unknown
): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

function procurarPontos(
  valor: unknown,
  caminho = "resposta",
  profundidade = 0
): Array<{ campo: string; valor: unknown }> {
  if (profundidade > 3 || !objeto(valor)) {
    return [];
  }

  const encontrados: Array<{
    campo: string;
    valor: unknown;
  }> = [];

  for (const [chave, conteudo] of Object.entries(valor)) {
    const caminhoAtual = `${caminho}.${chave}`;

    if (/sincroniza|pagin|totalpagina/i.test(chave)) {
      encontrados.push({
        campo: caminhoAtual,
        valor:
          typeof conteudo === "string" ||
          typeof conteudo === "number" ||
          typeof conteudo === "boolean" ||
          conteudo === null
            ? conteudo
            : `[${Array.isArray(conteudo) ? "array" : "objeto"}]`,
      });
    }

    if (objeto(conteudo)) {
      encontrados.push(
        ...procurarPontos(
          conteudo,
          caminhoAtual,
          profundidade + 1
        )
      );
    }
  }

  return encontrados;
}

async function main() {
  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error("Chave do Hiper não configurada.");
  }

  console.log("[1/3] Autenticando...");
  const token = await gerarToken(chave);

  console.log("[2/3] Consultando produtos...");
  const resposta = await consultarProdutos(token);

  console.log("[3/3] Analisando metadados...");

  console.log(
    "Tipo da resposta:",
    Array.isArray(resposta) ? "array" : typeof resposta
  );

  if (objeto(resposta)) {
    console.log(
      "Campos principais:",
      Object.keys(resposta)
    );
  }

  const pontos = procurarPontos(resposta);

  console.log("\nCampos de sincronização/paginação:");
  console.table(pontos.slice(0, 20));

  const produtos = localizarProdutos(resposta);

  console.log(
    "\nProdutos localizados:",
    produtos?.length ?? 0
  );

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
