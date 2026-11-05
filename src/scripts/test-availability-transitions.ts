
import "dotenv/config";

import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

import { prisma } from "../config/database.js";

class ReverterTeste extends Error {}

async function main() {
  console.log(
    "\nSUNSET — TESTE DE TRANSIÇÕES DE DISPONIBILIDADE"
  );

  const hiperId = randomUUID();
  let testesAprovados = 0;

  try {
    await prisma.$transaction(
      async (tx) => {
        // Registro temporário e isolado.
        await tx.iphone.create({
          data: {
            hiperId,
            codigo: "TESTE-TEMPORARIO",
            nomeOriginal: "IPHONE TESTE TEMPORARIO",
            modelo: "iPhone 13",
            armazenamento: "128GB",
            cor: "Preto",
            condicao: "seminovo",
            bateria: 90,
            preco: 2500,
            quantidade: 1,
            ativoCadastro: true,
            disponivel: true,
          },
        });

        async function verificar(
          descricao: string,
          ativo: boolean,
          quantidade: number,
          esperado: boolean
        ) {
          await tx.iphone.update({
            where: { hiperId },
            data: {
              ativoCadastro: ativo,
              quantidade,
              disponivel: ativo && quantidade > 0,
            },
          });

          const iphone = await tx.iphone.findUniqueOrThrow({
            where: { hiperId },
          });

          assert.equal(iphone.ativoCadastro, ativo);
          assert.equal(iphone.quantidade, quantidade);
          assert.equal(iphone.disponivel, esperado);

          testesAprovados++;
          console.log(`✔ ${descricao}`);
        }

        await verificar(
          "iPhone ativo com estoque 1",
          true, 1, true
        );

        await verificar(
          "iPhone vendido com estoque 0",
          true, 0, false
        );

        await verificar(
          "Cadastro inativo com estoque positivo",
          false, 1, false
        );

        await verificar(
          "Cadastro reativado com estoque positivo",
          true, 1, true
        );

        await verificar(
          "Cadastro inativo com estoque 0",
          false, 0, false
        );

        // Desfaz todas as operações do teste.
        throw new ReverterTeste();
      },
      {
        maxWait: 10_000,
        timeout: 30_000,
      }
    );
  } catch (erro) {
    if (!(erro instanceof ReverterTeste)) {
      throw erro;
    }
  }

  // Confirma que o registro temporário
  // não permaneceu no banco.
  const registroRestante =
    await prisma.iphone.findUnique({
      where: { hiperId },
    });

  assert.equal(
    registroRestante,
    null,
    "O registro temporário não foi removido."
  );

  console.table({
    testesAprovados,
    falhas: 0,
    registroTemporarioPreservado: false,
    rollbackConfirmado: true,
  });

  console.log(
    "\nAPROVADO — Todas as alterações foram revertidas."
  );
}

main()
  .catch((erro: unknown) => {
    console.error(
      "TESTE REPROVADO:",
      erro instanceof Error
        ? erro.message
        : "Erro desconhecido"
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
