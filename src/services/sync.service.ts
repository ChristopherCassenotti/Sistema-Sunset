
import {
  gerarToken,
  consultarProdutos,
  localizarProdutos,
} from "../integrations/hiper/client.js";

import {
  montarCatalogo,
} from "../modules/catalog/normalizer.js";

import {
  SyncRepository,
} from "../repositories/sync.repository.js";

import { SyncLockRepository } from
  "../repositories/sync-lock.repository.js";

export class SyncService {
  private repository = new SyncRepository();
  private lockRepository = new SyncLockRepository();

  
async executar() {
  const token = await this.lockRepository.adquirir();

  if (!token) {
    console.log(
      "Já existe uma sincronização em andamento."
    );

    return {
      status: "ignorada",
      motivo: "SINCRONIZACAO_EM_ANDAMENTO",
    };
  }

  try {
    const resultado =
      await this.executarSincronizacao();

    return {
      status: "concluida",
      ...resultado,
    };

  } finally {
    await this.lockRepository.liberar(token);
  }
}


  private async executarSincronizacao() {
    const chave = process.env.HIPER_CHAVE_SEGURANCA;

    if (!chave) {
      throw new Error("Chave do Hiper não configurada.");
    }

    console.log("[1/5] Iniciando sincronização...");

    const registro = await this.repository.iniciar();

    try {
      console.log("[2/5] Consultando Hiper...");

      const token = await gerarToken(chave);
      const resposta = await consultarProdutos(token);
      const produtos = localizarProdutos(resposta);

      if (!produtos || produtos.length === 0) {
        throw new Error(
          "Hiper não retornou produtos válidos."
        );
      }

      console.log(
        `Produtos recebidos: ${produtos.length}`
      );

      console.log("[3/5] Normalizando iPhones...");

      const resultado = montarCatalogo(produtos);

      const unidades = resultado.grupos.flatMap(
        (grupo) => grupo.unidades
      );

      // IDs informados explicitamente pelo Hiper.
      const idsRecebidos = new Set(
        produtos
          .map((produto) => produto.id)
          .filter(
            (id): id is string =>
              typeof id === "string" && id.length > 0
          )
      );

      const idsDisponiveis = new Set(
        unidades.map((unidade) => unidade.hiperId)
      );

      console.log("[4/5] Gravando produtos no MySQL...");

      const atualizados =
        await this.repository.salvarUnidades(unidades);

      // Não indisponibiliza produtos ausentes
      // da resposta, pois ela pode ser parcial.
      
const idsIndisponiveis = produtos
  .filter((produto) => {
    if (!produto.id || idsDisponiveis.has(produto.id)) {
      return false;
    }

    // Apenas condições explícitas do Hiper.
    const estoqueZerado =
      typeof produto.quantidadeEmEstoque === "number" &&
      Number.isFinite(produto.quantidadeEmEstoque) &&
      produto.quantidadeEmEstoque <= 0;

    const inativo = produto.ativo === false;
    const removido = produto.removido === true;

    return estoqueZerado || inativo || removido;
  })
  .map((produto) => produto.id)
  .filter((id): id is string => typeof id === "string");


      console.log("[5/5] Atualizando indisponíveis...");

      const indisponibilizados =
        await this.repository.indisponibilizar(
          idsIndisponiveis
        );

      await this.repository.concluir(
        registro.id,
        produtos.length,
        unidades.length,
        `Atualizados: ${atualizados}. ` +
        `Indisponibilizados: ${indisponibilizados}.`
      );

      return {
        produtosRecebidos: produtos.length,
        iphonesAtualizados: atualizados,
        indisponibilizados,
        gruposVisuais: resultado.grupos.length,
        unidadesDisponiveis:
          resultado.diagnostico.unidadesDisponiveis,
      };

    } catch (erro) {
      await this.repository
        .registrarErro(registro.id)
        .catch(() => {});

      throw erro;
    }
  }
}
