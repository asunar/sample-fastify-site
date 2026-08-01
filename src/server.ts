// ESM
import path from "node:path";
import { buildApp } from "./app.ts";

const fastify = buildApp(path.join(import.meta.dirname, "db", "data.db"), { migrate: false });

fastify.listen({ port: 3000 }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
