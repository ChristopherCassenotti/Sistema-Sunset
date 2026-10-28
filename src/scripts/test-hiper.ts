
import "dotenv/config";

import {
  gerarToken,
  consultarProdutos,
  listarProdutos,
  localizarProdutos,
  resumoSeguro
} from "../integrations/hiper/client.js";

async function main() {
  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error("Falta HIPER_CHAVE_SEGURANCA no .env.");
  }

  // ETAPA 1 - AUTENTICAÇÃO
  console.log("[1/2] Solicitando token ao Hiper...");

  const token = await gerarToken(chave);

  console.log("Autenticação concluída (token oculto).");

  // ETAPA 2 - CONSULTA DE PRODUTOS
  console.log(
    "[2/2] Consultando produtos via rota principal..."
  );

  let resposta: unknown;

  try {
    resposta = await consultarProdutos(token);

    console.log("GET Produtos: OK.");

  } catch (erro) {
    const mensagem = erro instanceof Error
      ? erro.message
      : "Erro desconhecido";

    console.error("Rota principal falhou:", mensagem);

    console.log(
      "Tentando a listagem paginada documentada..."
    );

    try {
      resposta = await listarProdutos(token, 1);

      console.log("Listagem paginada: OK.");

    } catch (erroAlternativo) {
      const mensagemAlternativa =
        erroAlternativo instanceof Error
          ? erroAlternativo.message
          : "Erro desconhecido";

      throw new Error(
        `As duas rotas de leitura falharam. ` +
        `Rota principal: ${mensagem} | ` +
        `Listagem paginada: ${mensagemAlternativa}`
      );
    }
  }

  // ETAPA 3 - ANALISAR PRODUTOS
  const produtos = localizarProdutos(resposta);

  if (produtos === null) {
    console.log(
      "A resposta chegou, mas precisamos mapear o formato."
    );

    console.log(
      "Tipo de retorno:",
      Array.isArray(resposta) ? "array" : typeof resposta
    );

    if (
      resposta &&
      typeof resposta === "object" &&
      !Array.isArray(resposta)
    ) {
      console.log(
        "Campos do nível principal:",
        Object.keys(resposta)
      );
    }

    console.log(
      "Não compartilhe a resposta completa."
    );

    return;
  }

  // FILTRAR IPHONES
  const iphones = produtos.filter(
    (p) => /iphone/i.test(p.nome ?? "")
  );

  console.log(
    `Produtos encontrados na resposta: ${produtos.length}`
  );

  console.log(
    `iPhones identificados na resposta: ${iphones.length}`
  );

  // EXIBIR AMOSTRA
  const amostra = (
    iphones.length ? iphones : produtos
  )
    .slice(0, 5)
    .map(resumoSeguro);

  console.log("Amostra de produtos:");
  console.table(amostra);

  if (!iphones.length) {
    console.log(
      "Nenhum iPhone nesta resposta; pode haver outras páginas."
    );
  }

  console.log(
    "Teste concluído. Nenhum produto foi alterado."
  );
}

main().catch((erro: unknown) => {
  const mensagem = erro instanceof Error
    ? erro.message
    : "Erro desconhecido.";

  console.error("Falha:", mensagem);

  console.error(
    "Não compartilhe chaves ou tokens."
  );

  process.exitCode = 1;
});
