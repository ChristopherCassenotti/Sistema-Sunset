
import {
  localizarProdutos,
} from "../integrations/hiper/client.js";

import {
  buscarAlteracoesHiper,
} from "../integrations/hiper/hiper-sync.client.js";

import {
  prepararSincronizacao,
} from "./sync-rules.service.js";

import {
  SyncRepository,
} from "../repositories/sync.repository.js";

import {
  SyncLockRepository,
} from "../repositories/sync-lock.repository.js";

export class SyncService {
  private repository = new SyncRepository();

  private lockRepository = new SyncLockRepository();

  /**
   * Entrada principal da sincronização.
   * Impede execuções simultâneas.
   */

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

  let bloqueioPerdido = false;
  let renovacaoEmAndamento:
    Promise<void> | null = null;

  const renovarBloqueio = () => {
    if (renovacaoEmAndamento) return;

    renovacaoEmAndamento = (async () => {
      try {
        const renovado =
          await this.lockRepository.renovar(token);

        if (!renovado) {
          bloqueioPerdido = true;
          console.error(
            "Bloqueio perdido durante a sincronização."
          );
        }
      } catch (erro) {
        // Na dúvida, não permitimos nova gravação.
        bloqueioPerdido = true;
        console.error(
          "Falha ao renovar bloqueio:",
          erro instanceof Error
            ? erro.message
            : "Erro desconhecido"
        );
      }
    })().finally(() => {
      renovacaoEmAndamento = null;
    });
  };

  const intervalo = setInterval(
    renovarBloqueio,
    60_000
  );

  try {
    const resultado =
      await this.executarSincronizacao(
        token,
        () => bloqueioPerdido
      );

    if (bloqueioPerdido) {
      throw new Error(
        "Sincronização interrompida: bloqueio perdido."
      );
    }

    return {
      status: "concluida",
      ...resultado,
    };
  } finally {
    clearInterval(intervalo);

    if (renovacaoEmAndamento) {
      await renovacaoEmAndamento;
    }

    await this.lockRepository.liberar(token);
  }
}


  /**
   * Busca alterações no Hiper e delega
   * a gravação atômica ao Repository.
   */
  private async executarSincronizacao(
    lockToken: string,
    bloqueioPerdido: () => boolean
    ) {
    const chave =
      process.env.HIPER_CHAVE_SEGURANCA;

    if (!chave) {
      throw new Error(
        "Chave do Hiper não configurada."
      );
    }

    const registro =
      await this.repository.iniciar();

    try {
      // 1. Ler último checkpoint confirmado.
      const pontoSalvo =
        await this.repository.buscarPonto();

      const pontoInicial = pontoSalvo ?? 0;

      const tipo = pontoSalvo === null
        ? "completa inicial"
        : "incremental";

      console.log(
        `Sincronização ${tipo} — ponto ${pontoInicial}`
      );

      // 2. Consultar Hiper.
      const lote = await buscarAlteracoesHiper(
        chave,
        pontoInicial
      );

      // 3. Tratar ausência de alterações.
      if (lote.semAlteracoes) {
        if (lote.ponto !== pontoInicial) {
          throw new Error(
            "Lote vazio retornou avanço de checkpoint. " +
            "É necessário validar esse comportamento."
          );
        }

        console.log(
          "Nenhuma alteração encontrada."
        );

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

      // 4. Validar produtos recebidos.
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

      // 5. Preparar atualizações sem acessar o banco.
      const plano =
        prepararSincronizacao(produtos);

      console.log(
        `iPhones para atualizar: ${plano.unidades.length}`
      );

      console.log(
        `Indisponibilidades: ${plano.idsCadastroInativos.length}`
      );

      // 6. Aplicar tudo na mesma transação.
      console.log(
        "Gravando alterações e checkpoint..."
      );

if (bloqueioPerdido()) {
  throw new Error(
    "Sincronização cancelada: bloqueio perdido."
  );
}

const bloqueioValido =
  await this.lockRepository.validar(lockToken);

if (!bloqueioValido) {
  throw new Error(
    "Sincronização cancelada: bloqueio expirado."
  );
}

const resultado =
  await this.repository.aplicarLoteAtomico({
    lockToken,
    sincronizacaoId: registro.id,
    pontoAnterior: pontoSalvo,
    pontoNovo: lote.ponto,
    produtosRecebidos: produtos.length,
    unidades: plano.unidades,
    idsCadastroInativos: plano.idsCadastroInativos,
idsCadastroAtivos: plano.idsCadastroAtivos,
    tipo,
  });

      console.log(
        "Transação confirmada no MySQL."
      );

      return {
        tipo,
        pontoAnterior: pontoInicial,
        pontoAtual: lote.ponto,
        produtosRecebidos: produtos.length,
        iphonesAtualizados:
          resultado.atualizados,
        indisponibilizados:
          resultado.indisponibilizados,
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
