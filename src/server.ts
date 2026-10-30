
import "dotenv/config";

import Fastify from "fastify";

import { catalogRoutes } from "./routes/catalog.routes.js";

import {
  conectarBanco,
  desconectarBanco,
} from "./config/database.js";

const app = Fastify({
  logger: true,
});

// Verificação de funcionamento
app.get("/health", async () => {
  return {
    status: "ok",
    projeto: "Sunset Importados",
    versao: "0.3.0",
  };
});

// Registrar rotas do catálogo
app.register(catalogRoutes, {
  prefix: "/api",
});

const PORT = Number(
  process.env.PORT ?? 3000
);

async function iniciarServidor() {
  try {
    await conectarBanco();

    await app.listen({
      port: PORT,
      host: "0.0.0.0",
    });

    console.log(
      `API rodando na porta ${PORT}`
    );

  } catch (erro) {
    app.log.error(erro);

    await desconectarBanco();

    process.exit(1);
  }
}

async function encerrarServidor() {
  await app.close();
  await desconectarBanco();
}

process.on("SIGINT", () => {
  void encerrarServidor();
});

process.on("SIGTERM", () => {
  void encerrarServidor();
});

void iniciarServidor();
