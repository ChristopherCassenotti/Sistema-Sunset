
import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";

const LOCK_ID = 1;
const DURACAO_LOCK_MS = 10 * 60 * 1000;

export class SyncLockRepository {
  async adquirir(): Promise<string | null> {
    const agora = new Date();
    const token = randomUUID();

    const expiraEm = new Date(
      agora.getTime() + DURACAO_LOCK_MS
    );

    // Garante que a linha de controle exista.
    await prisma.syncLock.upsert({
      where: { id: LOCK_ID },
      create: {
        id: LOCK_ID,
        expiraEm: new Date(0),
      },
      update: {},
    });

    // Operação atômica no banco:
    // somente um processo consegue adquirir o lock.
    const resultado = await prisma.syncLock.updateMany({
      where: {
        id: LOCK_ID,
        expiraEm: { lte: agora },
      },
      data: {
        token,
        expiraEm,
      },
    });

    return resultado.count === 1 ? token : null;
  }

  async liberar(token: string): Promise<void> {
    await prisma.syncLock.updateMany({
      where: {
        id: LOCK_ID,
        token,
      },
      data: {
        token: null,
        expiraEm: new Date(0),
      },
    });
  }
}
