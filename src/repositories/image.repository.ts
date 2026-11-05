
import { prisma } from "../config/database.js";

import {
  chaveImagem,
  modeloChaveImagem,
  corChaveImagem,
} from "../utils/image-keys.js";

export { chaveImagem } from "../utils/image-keys.js";

type ProdutoParaImagem = {
  modelo: string;
  cor: string;
};

export class ImageRepository {
  async buscarPorProdutos(produtos: ProdutoParaImagem[]) {
    const resultado = new Map<string, string[]>();

    if (produtos.length === 0) {
      return resultado;
    }

    const combinacoes = new Map<
      string,
      { modeloKey: string; corKey: string }
    >();

    for (const produto of produtos) {
      const modeloKey = modeloChaveImagem(
        produto.modelo
      );

      const corKey = corChaveImagem(
        produto.modelo,
        produto.cor
      );

      combinacoes.set(
        chaveImagem(produto.modelo, produto.cor),
        { modeloKey, corKey }
      );
    }

    const imagens = await prisma.imagemIphone.findMany({
      where: {
        ativo: true,
        OR: [...combinacoes.values()],
      },
      select: {
        modeloKey: true,
        corKey: true,
        caminho: true,
      },
      orderBy: [
        { ordem: "asc" },
        { id: "asc" },
      ],
    });

    for (const imagem of imagens) {
      const chave = chaveImagem(
        imagem.modeloKey,
        imagem.corKey
      );

      const lista = resultado.get(chave) ?? [];

      if (!lista.includes(imagem.caminho)) {
        lista.push(imagem.caminho);
      }

      resultado.set(chave, lista);
    }

    return resultado;
  }
}
