
import type { FastifyInstance } from "fastify";

import { CatalogController } from "../controllers/catalog.controller.js";

const catalogController = new CatalogController();

export async function catalogRoutes(
  app: FastifyInstance
) {
  app.get(
    "/catalogo",
    (request, reply) =>
      catalogController.listar(request, reply)
  );
}
