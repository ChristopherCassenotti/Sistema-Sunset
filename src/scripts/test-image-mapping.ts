
import "dotenv/config";

import { prisma } from "../config/database.js";
import { ImageRepository } from "../repositories/image.repository.js";

const casos = [
  {
    modelo: "iPhone XS Max",
    cor: "Dourado",
    arquivo: "iphone-xs-dourado.jpg",
  },
  {
    modelo: "iPhone 12",
    cor: "Azul",
    arquivo: "iphone-12-mini-azul.jpg",
  },
  {
    modelo: "iPhone 13 mini",
    cor: "Rosa",
    arquivo: "iphone-13-rosa.jpg",
  },
  {
    modelo: "iPhone 14 Plus",
    cor: "Meia-noite",
    arquivo: "iphone-14-meia-noite.jpg",
  },
  {
    modelo: "iPhone 16 Pro Max",
    cor: "Titânio Natural",
    arquivo: "iphone-16-pro-natural.jpg",
  },
  {
    modelo: "iPhone 17 Pro Max",
    cor: "COSMIC ORANGE",
    arquivo: "iphone-17-pro-laranja.jpg",
  },
  {
    modelo: "iPhone 17 Pro Max",
    cor: "LARANJA-CÓSMICO",
    arquivo: "iphone-17-pro-laranja.jpg",
  },
  {
    modelo: "iPhone 18 Pro Max",
    cor: "GLACIER",
    arquivo: "iphone-18-glacial.jpg",
  },
];

async function main() {
  const repository = new ImageRepository();

  const imagens = await repository.buscarPorProdutos(
    casos.map(({ modelo, cor }) => ({
      modelo,
      cor,
    }))
  );

  // Usamos a mesma chave do sistema.
  const { chaveImagem } = await import(
    "../utils/image-keys.js"
  );

  const resultados = casos.map((caso) => {
    const chave = chaveImagem(
      caso.modelo,
      caso.cor
    );

    const encontrados = imagens.get(chave) ?? [];

    return {
      produto: `${caso.modelo} ${caso.cor}`,
      imagemEsperada: caso.arquivo,
      encontrado: encontrados.some((caminho) =>
        caminho.endsWith("/" + caso.arquivo)
      ),
    };
  });

  console.log(
    "\nSUNSET — TESTE DE REUTILIZAÇÃO DE IMAGENS"
  );

  console.table(resultados);

  const aprovados = resultados.filter(
    (resultado) => resultado.encontrado
  ).length;

  console.log(
    `\nResultado: ${aprovados}/${casos.length} aprovados`
  );

  if (aprovados !== casos.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((erro: unknown) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
