
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

import {
  buscarAlteracoesHiper,
} from "../integrations/hiper/hiper-sync.client.js";

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

  const registro = await this.repository.iniciar();

  try {
    // 1. Consultar último ponto confirmado
    const pontoSalvo = await this.repository.buscarPonto();
    const pontoInicial = pontoSalvo ?? 0;

    const tipo = pontoSalvo === null
      ? "completa inicial"
      : "incremental";

    console.log(
      `Sincronização ${tipo} — ponto ${pontoInicial}`
    );

    // 2. Consultar somente alterações
    const lote = await buscarAlteracoesHiper(
      chave,
      pontoInicial
    );

    if (lote.semAlteracoes) {
      await this.repository.concluir(
        registro.id,
        0,
        0,
        "Nenhuma alteração encontrada."
      );

      return {
        tipo,
        pontoAnterior: pontoInicial,
        pontoAtual: pontoInicial,
        produtosRecebidos: 0,
        iphonesAtualizados: 0,
        indisponibilizados: 0,
        semAlteracoes: true,
      };
    }

    // 3. Validar estrutura
    const produtos = localizarProdutos({
      produtos: lote.produtos,
    });

    if (!produtos) {
      throw new Error(
        "Formato dos produtos não reconhecido."
      );
    }

    console.log(
      `Alterações recebidas: ${produtos.length}`
    );

    // 4. Normalizar registros disponíveis
    const resultado = montarCatalogo(produtos);

    const unidades = resultado.grupos.flatMap(
      (grupo) => grupo.unidades
    );

    // 5. Identificar apenas indisponibilidades explícitas
    const idsDisponiveis = new Set(
      unidades.map((u) => u.hiperId)
    );

    const idsIndisponiveis = produtos
      .filter((produto) => {
        if (
          !produto.id ||
          idsDisponiveis.has(produto.id)
        ) {
          return false;
        }

        const estoqueZerado =
          typeof produto.quantidadeEmEstoque === "number" &&
          Number.isFinite(produto.quantidadeEmEstoque) &&
          produto.quantidadeEmEstoque <= 0;

        return (
          estoqueZerado ||
          produto.ativo === false ||
          produto.removido === true
        );
      })
      .map((produto) => produto.id)
      .filter(
        (id): id is string => typeof id === "string"
      );

    // 6. Gravar alterações
    const atualizados =
      await this.repository.salvarUnidades(unidades);

    const indisponibilizados =
      await this.repository.indisponibilizar(
        [...new Set(idsIndisponiveis)]
      );

    // 7. Avançar somente após gravar os produtos
    await this.repository.salvarPonto(lote.ponto);

    // 8. Registrar conclusão
    await this.repository.concluir(
      registro.id,
      produtos.length,
      unidades.length,
      `Sincronização ${tipo}. ` +
      `Ponto: ${pontoInicial} -> ${lote.ponto}.`
    );

    return {
      tipo,
      pontoAnterior: pontoInicial,
      pontoAtual: lote.ponto,
      produtosRecebidos: produtos.length,
      iphonesAtualizados: atualizados,
      indisponibilizados,
      semAlteracoes: false,
    };

  } catch (erro) {
    await this.repository
      .registrarErro(registro.id)
      .catch(() => {});

    throw erro;
  }
}

}
