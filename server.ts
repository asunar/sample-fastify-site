// ESM
import { buildApp } from "./app.ts";

const fastify = buildApp();

fastify.listen({ port: 3000 }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
