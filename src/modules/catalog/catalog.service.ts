
import {
  gerarToken,
  consultarProdutos,
  localizarProdutos,
} from "../../integrations/hiper/client.js";

import {
  montarCatalogo,
} from "./normalizer.js";

// Cache temporário de 5 minutos durante o desenvolvimento.
// Depois será substituído pela leitura do MySQL.
const TEMPO_CACHE = 5 * 60 * 1000;

let cache: {
  dados: Awaited<ReturnType<typeof buscarCatalogo>>;
  expiraEm: number;
} | null = null;

let consultaEmAndamento:
  Promise<Awaited<ReturnType<typeof buscarCatalogo>>> | null = null;

async function buscarCatalogo() {
  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error("Chave do Hiper não configurada.");
  }

  // Autenticação no Hiper
  const token = await gerarToken(chave);

  // Consulta dos produtos
  const resposta = await consultarProdutos(token);

  const produtos = localizarProdutos(resposta);

  if (!produtos) {
    throw new Error("Formato dos produtos não reconhecido.");
  }

  // Aplica os filtros e agrupamentos existentes
  const resultado = montarCatalogo(produtos);

  // Converte para o formato público do catálogo.
  // Não expõe IDs internos do Hiper nem códigos individuais.
  const catalogo = resultado.grupos.map((grupo) => ({
    id: grupo.chave,
    nome: [
      grupo.modelo,
      grupo.armazenamento,
      grupo.cor,
    ].join(" "),

    modelo: grupo.modelo,
    armazenamento: grupo.armazenamento,
    cor: grupo.cor,
    condicao: grupo.condicao,

    precoAVista: grupo.precoMinimo,
    precoMaximo: grupo.precoMaximo,

    quantidadeDisponivel: grupo.quantidadeTotal,

    disponivel: grupo.quantidadeTotal > 0,

    // Mantém diferentes preços e baterias.
    // Os IDs originais ficam restritos ao backend.
    opcoes: grupo.unidades.map((unidade) => ({
      preco: unidade.preco,
      bateria: unidade.bateria,
      quantidade: unidade.quantidade,
    })),
  }));

  return {
    loja: "Sunset Importados",
    consultadoEm: new Date().toISOString(),

    totalProdutos: catalogo.length,
    totalUnidades: resultado.diagnostico.unidadesDisponiveis,

    produtos: catalogo,
  };
}

export async function obterCatalogo() {
  // Reutiliza os dados se ainda estiverem atualizados
  if (cache && Date.now() < cache.expiraEm) {
    return cache.dados;
  }

  // Evita consultas simultâneas desnecessárias
  if (!consultaEmAndamento) {
    consultaEmAndamento = buscarCatalogo()
      .then((dados) => {
        cache = {
          dados,
          expiraEm: Date.now() + TEMPO_CACHE,
        };

        return dados;
      })
      .finally(() => {
        consultaEmAndamento = null;
      });
  }

  return consultaEmAndamento;
}
