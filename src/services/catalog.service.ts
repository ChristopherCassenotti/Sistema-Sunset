
import { CatalogRepository } from "../repositories/catalog.repository.js";
import {
  ImageRepository,
  chaveImagem,
} from "../repositories/image.repository.js";
import type {
  ProdutoCatalogo,
  RespostaCatalogo,
} from "../models/catalog.model.js";

import { normalizarCor } from "../utils/normalizar-cor.js";

export class CatalogService {
  private repository = new CatalogRepository();
  private imageRepository = new ImageRepository();
  
  async listar(): Promise<RespostaCatalogo> {
    const iphones =
      await this.repository.buscarDisponiveis();

    const grupos = new Map<string, ProdutoCatalogo>();

    for (const iphone of iphones) {
      // Apenas unidades livres para venda.
      const quantidadeLivre = Math.max(
        0,
        iphone.quantidade - iphone.quantidadeReservada
      );

      if (quantidadeLivre === 0) {
        continue;
      }

      const corPadronizada = normalizarCor(
        iphone.cor,
        iphone.modelo
      );

      const chave = [
        iphone.modelo.trim().toUpperCase(),
        iphone.armazenamento.trim().toUpperCase(),
        corPadronizada,
        iphone.condicao.trim().toUpperCase(),
      ].join("|");

      const preco = Number(iphone.preco);

      // Não publicar preços inválidos.
      if (!Number.isFinite(preco) || preco <= 0) {
        continue;
      }

      let grupo = grupos.get(chave);

      if (!grupo) {
        grupo = {
          id: chave,

          nome: [
            iphone.modelo,
            iphone.armazenamento,
            corPadronizada,
          ].join(" "),

          modelo: iphone.modelo,
          armazenamento: iphone.armazenamento,
          cor: corPadronizada,
          condicao: iphone.condicao,

          precoAVista: preco,
          precoMaximo: preco,

          quantidadeDisponivel: 0,
          disponivel: true,

          opcoes: [],
          imagens: [],
        };

        grupos.set(chave, grupo);
      }

      grupo.quantidadeDisponivel += quantidadeLivre;

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
        quantidade: quantidadeLivre,
      });
    }

    
const imagensPorProduto =
  await this.imageRepository.buscarPorProdutos(
    [...grupos.values()].map((grupo) => ({
      modelo: grupo.modelo,
      cor: grupo.cor,
    }))
  );

for (const grupo of grupos.values()) {
  const chave = chaveImagem(
    grupo.modelo,
    grupo.cor
  );

  grupo.imagens = imagensPorProduto.get(chave) ?? [];
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
        a.cor.localeCompare(b.cor, "pt-BR")
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
