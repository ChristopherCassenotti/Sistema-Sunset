
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function conectarBanco() {
  await prisma.$connect();
  console.log("MySQL conectado!");
}

export async function desconectarBanco() {
  await prisma.$disconnect();
}
