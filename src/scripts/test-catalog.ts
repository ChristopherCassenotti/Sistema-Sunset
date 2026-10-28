
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import {
  gerarToken,
  consultarProdutos,
  localizarProdutos
} from "../integrations/hiper/client.js";

import {
  montarCatalogo
} from "../modules/catalog/normalizer.js";

async function main() {

  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error(
      "Falta HIPER_CHAVE_SEGURANCA no arquivo .env"
    );
  }

  console.log("[1/3] Autenticando no Hiper...");

  const token = await gerarToken(chave);

  console.log("[2/3] Buscando produtos...");

  const resposta = await consultarProdutos(token);

  const produtos = localizarProdutos(resposta);

  if (!produtos) {
    throw new Error(
      "Formato da resposta do Hiper não reconhecido."
    );
  }

  console.log("[3/3] Filtrando e agrupando iPhones...");

  const resultado = montarCatalogo(produtos);
  const d = resultado.diagnostico;

  console.log(`Registros recebidos: ${d.recebidos}`);
  console.log(`Cadastros válidos de iPhone: ${d.registrosValidos}`);
  console.log(`Unidades disponíveis: ${d.unidadesDisponiveis}`);
  console.log(`Grupos visuais: ${resultado.grupos.length}`);

  console.log("Exclusões:");

  console.table(
    Object.entries(d.exclusoes).map(
      ([motivo, quantidade]) => ({ motivo, quantidade })
    )
  );

  console.log("Grupos com mais de uma unidade (amostra):");

  console.table(
    resultado.grupos
      .filter((g) => g.unidades.length > 1)
      .sort((a, b) => b.unidades.length - a.unidades.length)
      .slice(0, 10)
      .map((g) => ({
        modelo: g.modelo,
        capacidade: g.armazenamento,
        cor: g.cor,
        condicao: g.condicao,
        cadastros: g.unidades.length,
        estoque: g.quantidadeTotal,
        menorPreco: g.precoMinimo,
        maiorPreco: g.precoMaximo,
      }))
  );

  if (d.exemplosParaRevisao.length) {
    console.log("Nomes que precisam de revisão (amostra):");
    console.table(d.exemplosParaRevisao);
  }

  // Salvar JSON somente no computador
  await mkdir("tmp", { recursive: true });

  await writeFile(
    "tmp/catalogo-preview.json",
    JSON.stringify(resultado, null, 2),
    "utf8"
  );

  console.log("Prévia salva em tmp/catalogo-preview.json");
  console.log("Teste somente de leitura: nada foi modificado no Hiper.");
}

main().catch((erro: unknown) => {
  console.error(
    "Falha:",
    erro instanceof Error ? erro.message : "Erro desconhecido"
  );

  process.exitCode = 1;
});
