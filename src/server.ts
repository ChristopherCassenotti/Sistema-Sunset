
import "dotenv/config";

import Fastify from "fastify";

import {
  obterCatalogo,
} from "./modules/catalog/catalog.service.js";

const app = Fastify({
  logger: true,
});

// Verificar funcionamento da API
app.get("/health", async () => {
  return {
    status: "ok",
    projeto: "Sunset Importados",
    versao: "0.2.0",
  };
});

// Catálogo público de iPhones
app.get("/api/catalogo", async (request, reply) => {
  try {
    const catalogo = await obterCatalogo();

    // Evita cache adicional no navegador
    reply.header("Cache-Control", "no-store");

    return reply.send(catalogo);

  } catch {
    request.log.error(
      "Falha ao consultar o catálogo no Hiper."
    );

    return reply.code(503).send({
      erro: "CATALOGO_INDISPONIVEL",
      mensagem:
        "Não foi possível atualizar o catálogo neste momento.",
    });
  }
});

const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({
    port,
    host: "0.0.0.0",
  });

} catch (erro) {
  app.log.error(erro);
  process.exit(1);
}
