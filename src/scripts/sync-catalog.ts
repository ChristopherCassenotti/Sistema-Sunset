
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import {
  gerarToken,
  consultarProdutos,
  localizarProdutos,
} from "../integrations/hiper/client.js";

import {
  montarCatalogo,
} from "../modules/catalog/normalizer.js";

const prisma = new PrismaClient();

const TAMANHO_LOTE = 30;

function dividirEmLotes<T>(
  itens: T[],
  tamanho: number
): T[][] {
  const lotes: T[][] = [];

  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }

  return lotes;
}

async function sincronizar() {
  const chave = process.env.HIPER_CHAVE_SEGURANCA;

  if (!chave) {
    throw new Error("Chave do Hiper não configurada.");
  }

  console.log("[1/5] Iniciando sincronização...");

  const registro = await prisma.sincronizacao.create({
    data: { status: "executando" },
  });

  try {
    // 1. Buscar dados no Hiper
    console.log("[2/5] Consultando Hiper...");

    const token = await gerarToken(chave);
    const resposta = await consultarProdutos(token);
    const produtos = localizarProdutos(resposta);

    if (!produtos || produtos.length === 0) {
      throw new Error(
        "Hiper não retornou uma lista válida de produtos."
      );
    }

    console.log(
      `Produtos recebidos: ${produtos.length}`
    );

    // 2. Normalizar produtos disponíveis
    console.log("[3/5] Normalizando iPhones...");

    const resultado = montarCatalogo(produtos);

    const unidades = resultado.grupos.flatMap(
      (grupo) => grupo.unidades
    );

    console.log(
      `iPhones disponíveis: ${unidades.length}`
    );

    // IDs dos produtos que vieram nesta consulta
    const idsRecebidos = new Set(
      produtos
        .map((produto) => produto.id)
        .filter(
          (id): id is string =>
            typeof id === "string" && id.length > 0
        )
    );

    // IDs considerados disponíveis pelo normalizador
    const idsDisponiveis = new Set(
      unidades.map((unidade) => unidade.hiperId)
    );

    // 3. Cadastrar ou atualizar disponíveis
    console.log("[4/5] Atualizando produtos...");

    let atualizados = 0;

    for (
      const lote of dividirEmLotes(
        unidades,
        TAMANHO_LOTE
      )
    ) {
      await prisma.$transaction(
        lote.map((unidade) => {
          const dados = {
            codigo: unidade.codigo,
            nomeOriginal: unidade.nomeOriginal,
            modelo: unidade.modelo,
            armazenamento: unidade.armazenamento,
            cor: unidade.cor,
            condicao: unidade.condicao,
            bateria: unidade.bateria,
            preco: unidade.preco,
            quantidade: unidade.quantidade,
            disponivel: true,
          };

          return prisma.iphone.upsert({
            where: {
              hiperId: unidade.hiperId,
            },
            create: {
              hiperId: unidade.hiperId,
              ...dados,
            },
            update: dados,
          });
        })
      );

      atualizados += lote.length;
    }

    // 4. Desativar registros que vieram no Hiper,
    // mas não passaram nos filtros de disponibilidade.
    console.log("[5/5] Verificando indisponíveis...");

    const idsIndisponiveis = [...idsRecebidos]
      .filter((id) => !idsDisponiveis.has(id));

    let indisponibilizados = 0;

    for (
      const lote of dividirEmLotes(
        idsIndisponiveis,
        100
      )
    ) {
      const resultadoUpdate =
        await prisma.iphone.updateMany({
          where: {
            hiperId: { in: lote },
            disponivel: true,
          },
          data: {
            disponivel: false,
            quantidade: 0,
          },
        });

      indisponibilizados += resultadoUpdate.count;
    }

    // Registra conclusão
    await prisma.sincronizacao.update({
      where: { id: registro.id },
      data: {
        status: "concluido",
        finalizadaEm: new Date(),
        produtosRecebidos: produtos.length,
        produtosValidos: unidades.length,
        mensagem:
          `Atualizados: ${atualizados}. ` +
          `Indisponibilizados: ${indisponibilizados}.`,
      },
    });

    // Resumo
    console.log("\nSINCRONIZAÇÃO CONCLUÍDA!");

    console.table({
      produtosRecebidos: produtos.length,
      iphonesAtualizados: atualizados,
      indisponibilizados,
      gruposVisuais: resultado.grupos.length,
      unidadesDisponiveis:
        resultado.diagnostico.unidadesDisponiveis,
    });

    console.log("\nDados do banco:");

    const total = await prisma.iphone.count();

    const disponiveis = await prisma.iphone.count({
      where: { disponivel: true },
    });

    const indisponiveis = await prisma.iphone.count({
      where: { disponivel: false },
    });

    console.table({
      totalCadastros: total,
      disponiveis,
      indisponiveis,
    });

    console.log(
      "Produtos ausentes da consulta foram preservados."
    );

  } catch (erro) {
    await prisma.sincronizacao.update({
      where: { id: registro.id },
      data: {
        status: "erro",
        finalizadaEm: new Date(),
        mensagem: "Sincronização não concluída.",
      },
    }).catch(() => {});

    throw erro;
  }
}

sincronizar()
  .catch((erro: unknown) => {
    console.error(
      "Falha:",
      erro instanceof Error
        ? erro.message
        : "Erro desconhecido"
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
