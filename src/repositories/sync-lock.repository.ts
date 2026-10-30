
import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";
import { Prisma } from "@prisma/client";

const LOCK_ID = 1;
const DURACAO_LOCK_MS = 10 * 60 * 1000;

export class SyncLockRepository {
  constructor(
    private readonly lockId: number = LOCK_ID
  ) {}

  
async adquirir(): Promise<string | null> {
  const token = randomUUID();

  try {
    await prisma.syncLock.create({
      data: {
        id: this.lockId,
        expiraEm: new Date(0),
      },
    });
  } catch (erro) {
    if (
      !(
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === "P2002"
      )
    ) {
      throw erro;
    }
  }

  const agora = new Date();

  const expiraEm = new Date(
    agora.getTime() + DURACAO_LOCK_MS
  );

  const resultado = await prisma.syncLock.updateMany({
    where: {
      id: this.lockId,
      expiraEm: { lte: agora },
    },
    data: {
      token,
      expiraEm,
    },
  });

  return resultado.count === 1 ? token : null;
}

  /**
   * Renova somente se o token ainda pertence
   * à execução atual e não está expirado.
   */
  async renovar(token: string): Promise<boolean> {
    const agora = new Date();

    const resultado = await prisma.syncLock.updateMany({
      where: {
        id: this.lockId,
        token,
        expiraEm: { gt: agora },
      },
      data: {
        expiraEm: new Date(
          agora.getTime() + DURACAO_LOCK_MS
        ),
      },
    });

    return resultado.count === 1;
  }

  /**
   * Consulta se a execução ainda possui
   * um bloqueio válido.
   */
  async validar(token: string): Promise<boolean> {
    const bloqueio = await prisma.syncLock.findFirst({
      where: {
        id: this.lockId,
        token,
        expiraEm: { gt: new Date() },
      },
      select: { id: true },
    });

    return bloqueio !== null;
  }

  /**
   * Não permite liberar o bloqueio
   * de outra execução.
   */
  async liberar(token: string): Promise<void> {
    await prisma.syncLock.updateMany({
      where: {
        id: this.lockId,
        token,
      },
      data: {
        token: null,
        expiraEm: new Date(0),
      },
    });
  }
}
