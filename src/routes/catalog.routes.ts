
import type { FastifyInstance } from "fastify";

import { CatalogController } from "../controllers/catalog.controller.js";

const catalogController = new CatalogController();

export async function catalogRoutes(
  app: FastifyInstance
) {
  app.get(
    "/catalogo",
    {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: "1 minute",
        },
      },
    },
    (request, reply) =>
      catalogController.listar(request, reply)
  );
}
