
import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { CatalogService } from "../services/catalog.service.js";

const catalogService = new CatalogService();

export class CatalogController {
  async listar(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const catalogo =
        await catalogService.listar();

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
