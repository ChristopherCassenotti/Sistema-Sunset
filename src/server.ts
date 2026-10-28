import "dotenv/config";
import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  projeto: "Sunset Importados",
  versao: "0.1.0",
  // Intencionalmente sem consultar o Hiper nesta rota pública.
}));

const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (erro) {
  app.log.error(erro);
  process.exit(1);
}
