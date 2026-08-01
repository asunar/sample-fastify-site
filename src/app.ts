import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { connectToDb } from "./db/db.ts";
import { latest } from "./db/migration-runner.ts";
import usersRoutes from "./routes/user-routes.ts";

export function buildApp(dbFile: string, { migrate = false, logger = true } = {}) {
  const db = connectToDb(dbFile);
  if (migrate) latest(db);

  const fastify = Fastify({ logger });

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.register(usersRoutes(db));

  return fastify;
}
