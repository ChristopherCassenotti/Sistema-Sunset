
import {
  consultarEstoqueHiper,
} from "../integrations/hiper/hiper-stock.client.js";

import {
  StockRepository,
} from "../repositories/stock.repository.js";

import {
  SyncLockRepository,
} from "../repositories/sync-lock.repository.js";

export class StockService {
  private repository = new StockRepository();
  private lockRepository = new SyncLockRepository();

  async executar(simular = true) {
    const chave = process.env.HIPER_CHAVE_SEGURANCA;

    if (!chave) {
      throw new Error("Chave do Hiper não configurada.");
    }

    const token = await this.lockRepository.adquirir();

    if (!token) {
      return {
        status: "ignorada",
        motivo: "SINCRONIZACAO_EM_ANDAMENTO",
      };
    }

    let bloqueioPerdido = false;
    let renovacao: Promise<void> | null = null;

    const renovar = () => {
      if (renovacao) return;

      renovacao = (async () => {
        try {
          const ok = await this.lockRepository.renovar(token);

          if (!ok) {
            bloqueioPerdido = true;
          }
        } catch {
          bloqueioPerdido = true;
        }
      })().finally(() => {
        renovacao = null;
      });
    };

    const intervalo = setInterval(renovar, 60_000);

    try {
      const cursor = await this.repository.buscarCursor();
      const pontoAnterior = cursor?.ponto ?? 0;

      console.log(
        `Estoque — ponto anterior: ${pontoAnterior}`
      );

      const lote = await consultarEstoqueHiper(
        chave,
        pontoAnterior
      );

      // Não estabelecer um checkpoint inicial
      // se o Hiper não devolveu registros.
      if (lote.semAlteracoes && cursor === null) {
        throw new Error(
          "Carga inicial de estoque sem registros."
        );
      }

      const local = lote.localDeEstoqueId;

      if (
        cursor?.localDeEstoqueId &&
        local &&
        cursor.localDeEstoqueId !== local
      ) {
        throw new Error(
          "Local de estoque mudou entre execuções."
        );
      }

      if (lote.semAlteracoes) {
        return {
          status: "concluida",
          simulado: simular,
          pontoAnterior,
          pontoAtual: pontoAnterior,
          registrosRecebidos: 0,
          semAlteracoes: true,
        };
      }

      if (!local) {
        throw new Error(
          "Local de estoque não identificado."
        );
      }

      // Evita aplicar resultados contraditórios
      // para o mesmo produto.
      const ids = new Set<string>();

      for (const item of lote.registros) {
        if (ids.has(item.produtoId)) {
          throw new Error(
            "Produto duplicado no lote de estoque."
          );
        }

        ids.add(item.produtoId);
      }

      const correspondentes =
        await this.repository.buscarCorrespondentes(
          [...ids]
        );

      const idsCadastrados = new Set(
        correspondentes.map((item) => item.hiperId)
      );

      const registrosValidos = lote.registros.filter(
        (item) => idsCadastrados.has(item.produtoId)
      );

      const quantidadesZeradas =
        registrosValidos.filter(
          (item) => item.quantidadeEmEstoque === 0
        ).length;

      console.log(
        `Registros recebidos: ${lote.registros.length}`
      );

      console.log(
        `iPhones correspondentes: ${registrosValidos.length}`
      );

      if (simular) {
        return {
          status: "simulacao",
          simulado: true,
          pontoAnterior,
          pontoAtual: lote.pontoAtual,
          registrosRecebidos: lote.registros.length,
          iphonesCorrespondentes: registrosValidos.length,
          quantidadesZeradas,
          localDeEstoqueIdPresente: true,
          semAlteracoes: false,
        };
      }

      if (bloqueioPerdido) {
        throw new Error("Bloqueio perdido.");
      }

      if (!(await this.lockRepository.validar(token))) {
        throw new Error("Bloqueio inválido.");
      }

      const resultado =
        await this.repository.aplicarLoteAtomico({
          lockToken: token,
          pontoAnterior: cursor?.ponto ?? null,
          pontoNovo: lote.pontoAtual,
          localDeEstoqueId: local,
          registros: registrosValidos,
        });

      return {
        status: "concluida",
        simulado: false,
        pontoAnterior,
        pontoAtual: lote.pontoAtual,
        registrosRecebidos: lote.registros.length,
        iphonesAtualizados: resultado.atualizados,
        iphonesZerados: resultado.zerados,
        semAlteracoes: false,
      };
    } finally {
      clearInterval(intervalo);

      if (renovacao) {
        await renovacao;
      }

      await this.lockRepository.liberar(token);
    }
  }
}
