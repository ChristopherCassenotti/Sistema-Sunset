
import { prisma } from "../config/database.js";

export class CatalogRepository {

  async buscarDisponiveis() {
    return prisma.iphone.findMany({
      where: {
        ativoCadastro: true,
        disponivel: true,
        quantidade: {
          gt: 0,
        },
      },
      select: {
        hiperId: true,
        modelo: true,
        armazenamento: true,
        cor: true,
        condicao: true,
        bateria: true,
        preco: true,
        quantidade: true,
        quantidadeReservada: true,
      },
      orderBy: [
        { modelo: "asc" },
        { armazenamento: "asc" },
        { cor: "asc" },
      ],
    });
  }

  async buscarUltimaSincronizacao() {
    return prisma.sincronizacao.findFirst({
      where: {
        status: "concluido",
      },
      orderBy: {
        finalizadaEm: "desc",
      },
      select: {
        finalizadaEm: true,
      },
    });
  }
}
