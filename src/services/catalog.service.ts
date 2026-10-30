
import { CatalogRepository } from "../repositories/catalog.repository.js";

import type {
  ProdutoCatalogo,
  RespostaCatalogo,
} from "../models/catalog.model.js";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export class CatalogService {
  private repository = new CatalogRepository();

  async listar(): Promise<RespostaCatalogo> {
    const iphones =
      await this.repository.buscarDisponiveis();

    const grupos =
      new Map<string, ProdutoCatalogo>();

    for (const iphone of iphones) {
      const chave = [
        iphone.modelo,
        iphone.armazenamento,
        iphone.cor,
        iphone.condicao,
      ]
        .map(normalizar)
        .join("|");

      const preco = Number(iphone.preco);

      let grupo = grupos.get(chave);

      if (!grupo) {
        grupo = {
          id: chave,

          nome: [
            iphone.modelo,
            iphone.armazenamento,
            iphone.cor,
          ].join(" "),

          modelo: iphone.modelo,
          armazenamento: iphone.armazenamento,
          cor: iphone.cor,
          condicao: iphone.condicao,

          precoAVista: preco,
          precoMaximo: preco,

          quantidadeDisponivel: 0,
          disponivel: true,

          opcoes: [],
        };

        grupos.set(chave, grupo);
      }

      grupo.quantidadeDisponivel +=
        iphone.quantidade;

      grupo.precoAVista = Math.min(
        grupo.precoAVista,
        preco
      );

      grupo.precoMaximo = Math.max(
        grupo.precoMaximo,
        preco
      );

      grupo.opcoes.push({
        preco,
        bateria: iphone.bateria,
        quantidade: iphone.quantidade,
      });
    }

    const produtos = [...grupos.values()].sort(
      (a, b) =>
        a.modelo.localeCompare(
          b.modelo,
          "pt-BR",
          { numeric: true }
        ) ||
        a.armazenamento.localeCompare(
          b.armazenamento,
          "pt-BR",
          { numeric: true }
        ) ||
        a.cor.localeCompare(
          b.cor,
          "pt-BR"
        )
    );

    const ultimaSincronizacao =
      await this.repository.buscarUltimaSincronizacao();

    return {
      loja: "Sunset Importados",

      consultadoEm: new Date().toISOString(),

      atualizadoEm:
        ultimaSincronizacao?.finalizadaEm
          ?.toISOString() ?? null,

      totalProdutos: produtos.length,

      totalUnidades: produtos.reduce(
        (total, produto) =>
          total + produto.quantidadeDisponivel,
        0
      ),

      produtos,
    };
  }
}
