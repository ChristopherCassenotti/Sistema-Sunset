
import "dotenv/config";

import Fastify from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import cors from "@fastify/cors";

import { catalogRoutes } from "./routes/catalog.routes.js";

import {
  conectarBanco,
  desconectarBanco,
} from "./config/database.js";

// Quantidade de proxies à frente da API. Sem isso, atrás de um proxy,
// todos os visitantes pareceriam um só IP para o limite de requisições.
const proxiesConfiaveis = Number(
  process.env.TRUST_PROXY ?? 0
);

// Criar aplicação Fastify
const app = Fastify({
  logger: true,
  trustProxy: (_endereco, salto) =>
    salto < proxiesConfiaveis,
});

app.register(cors, {
  origin: [
    "https://sunsetimportados.com.br",
    "https://www.sunsetimportados.com.br",
  ],
  methods: ["GET", "OPTIONS"],
});

// Limite por IP, ativado rota a rota
app.register(fastifyRateLimit, {
  global: false,
  errorResponseBuilder: (_request, contexto) => ({
    statusCode: contexto.statusCode,
    erro: "MUITAS_REQUISICOES",
    mensagem:
      "Muitas requisições. Tente novamente em instantes.",
  }),
});

// Disponibilizar as imagens cadastradas
app.register(fastifyStatic, {
  root: path.resolve(
    process.cwd(),
    "uploads",
    "iphones"
  ),
  prefix: "/uploads/iphones/",
  decorateReply: false,
  index: false,
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
