// our-first-route.js

import type { FastifyInstance } from "fastify";

async function routes(fastify: FastifyInstance, options: Object) {
  fastify.get("/", async (request, reply) => {
    return { hello: "world123" };
  });
}

//ESM
export default routes;
