
import "dotenv/config";

import { readdir } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../config/database.js";
import {
  modeloChaveImagem,
  corChaveImagem,
} from "../utils/image-keys.js";

const raiz = path.resolve(
  process.cwd(),
  "uploads",
  "iphones"
);

const aplicar = process.argv.includes("--aplicar");

type ImagemImportada = {
  modeloKey: string;
  corKey: string;
  caminho: string;
  arquivo: string;
};

function prefixoEsperado(pasta: string): string {
  return pasta.toLowerCase();
}

function extrairCor(
  pasta: string,
  arquivo: string
): string {
  const nome = path.parse(arquivo).name.toLowerCase();

  const prefixos = [prefixoEsperado(pasta)];

  // O usuário renomeou apenas a pasta do 18 Pro.
  // Os arquivos podem continuar como iphone-18-...
  if (pasta.toUpperCase() === "IPHONE-18-PRO") {
    prefixos.push("iphone-18");
  }

  for (const prefixo of prefixos) {
    if (nome.startsWith(prefixo + "-")) {
      return nome.slice(prefixo.length + 1);
    }
  }

  throw new Error(
    `Nome incompatível com a pasta: ${pasta}/${arquivo}`
  );
}

async function lerBiblioteca(): Promise<ImagemImportada[]> {
  const pastas = await readdir(raiz, {
    withFileTypes: true,
  });

  const imagens: ImagemImportada[] = [];
  const chaves = new Set<string>();

  for (const pasta of pastas) {
    if (!pasta.isDirectory()) {
      continue;
    }

    if (!pasta.name.toUpperCase().startsWith("IPHONE-")) {
      continue;
    }

    const modeloKey = modeloChaveImagem(
      pasta.name.replace(/-/g, " ")
    );

    const arquivos = await readdir(
      path.join(raiz, pasta.name),
      { withFileTypes: true }
    );

    for (const arquivo of arquivos) {
      if (!arquivo.isFile()) {
        continue;
      }

      if (!/\.(jpe?g|png|webp)$/i.test(arquivo.name)) {
        continue;
      }

      const corArquivo = extrairCor(
        pasta.name,
        arquivo.name
      );

      const corKey = corChaveImagem(
        modeloKey,
        corArquivo
      );

      const chave = `${modeloKey}|${corKey}|0`;

      // Evita conflito entre duas imagens principais
      // para o mesmo modelo e cor.
      if (chaves.has(chave)) {
        throw new Error(
          `Imagem duplicada para ${chave}. ` +
          `Verifique ${pasta.name}/${arquivo.name}`
        );
      }

      chaves.add(chave);

      imagens.push({
        modeloKey,
        corKey,
        caminho: [
          "",
          "uploads",
          "iphones",
          pasta.name,
          arquivo.name,
        ].join("/"),
        arquivo: `${pasta.name}/${arquivo.name}`,
      });
    }
  }

  return imagens.sort((a, b) =>
    a.caminho.localeCompare(b.caminho, "pt-BR")
  );
}

async function main() {
  console.log("\nSUNSET — IMPORTADOR DE IMAGENS");

  const imagens = await lerBiblioteca();

  if (imagens.length === 0) {
    throw new Error(
      "Nenhuma imagem encontrada em uploads/iphones."
    );
  }

  console.table({
    imagensEncontradas: imagens.length,
    modelosDeReferencia: new Set(
      imagens.map((img) => img.modeloKey)
    ).size,
    modo: aplicar ? "GRAVACAO" : "SIMULACAO",
  });

  console.table(
    imagens.map((imagem) => ({
      modelo: imagem.modeloKey,
      cor: imagem.corKey,
      arquivo: imagem.arquivo,
    }))
  );

  if (!aplicar) {
    console.log(
      "\nSimulação concluída. Nada foi gravado."
    );
    return;
  }

  // Cada combinação de modelo e cor recebe
  // uma imagem principal na posição 0.
  // A operação pode ser repetida sem duplicar.
  await prisma.$transaction(
    async (tx) => {
      for (const imagem of imagens) {
        await tx.imagemIphone.upsert({
          where: {
            modeloKey_corKey_ordem: {
              modeloKey: imagem.modeloKey,
              corKey: imagem.corKey,
              ordem: 0,
            },
          },
          create: {
            modeloKey: imagem.modeloKey,
            corKey: imagem.corKey,
            caminho: imagem.caminho,
            alt: `${imagem.modeloKey} ${imagem.corKey}`,
            ordem: 0,
            ativo: true,
          },
          update: {
            caminho: imagem.caminho,
            alt: `${imagem.modeloKey} ${imagem.corKey}`,
            ativo: true,
          },
        });
      }
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    }
  );

  console.log(
    `\nImportação concluída: ${imagens.length} imagens processadas.`
  );
}

main()
  .catch((erro: unknown) => {
    console.error(
      "\nERRO:",
      erro instanceof Error
        ? erro.message
        : String(erro)
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
