
import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { CatalogService } from "../services/catalog.service.js";
import { criarCacheCurto } from "../utils/cache-curto.js";

const DURACAO_CACHE_MS = 30_000;

const catalogService = new CatalogService();

// Protege o MySQL: no máximo uma consulta do catálogo a cada 30 segundos.
const obterCatalogo = criarCacheCurto(
  () => catalogService.listar(),
  DURACAO_CACHE_MS
);

export class CatalogController {
  async listar(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const catalogo =
        await obterCatalogo();

      return reply
        .header("Cache-Control", "no-store")
        .code(200)
        .send(catalogo);

    } catch (erro) {
      request.log.error(
        { err: erro },
        "Erro ao buscar catálogo"
      );

      return reply.code(503).send({
        erro: "CATALOGO_INDISPONIVEL",
        mensagem:
          "Não foi possível consultar o catálogo.",
      });
    }
  }
}
