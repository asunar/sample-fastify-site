import Fastify, {
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { connectToDb } from "./db/db.ts";
import { latest } from "./db/migration-runner.ts";
import healthRoutes from "./routes/health-routes.ts";
import usersRoutes from "./routes/user-routes.ts";

// 1MB. Fastify's own default, set explicitly so the limit is visible rather than
// implied — it is the first thing to tune if large payloads are ever expected.
const BODY_LIMIT = 1_048_576;

// The skill suggests a pino-pretty transport for development; that needs an npm
// dependency, so this stays with levels only, per the repo's native-first rule.
function defaultLoggerOptions() {
  switch (process.env.NODE_ENV) {
    case "test":
      return false;
    case "production":
      return { level: process.env.LOG_LEVEL ?? "info" };
    default:
      return { level: process.env.LOG_LEVEL ?? "debug" };
  }
}

export function buildApp(
  dbFile: string,
  { migrate = false, logger = defaultLoggerOptions() } = {},
) {
  const fastify = Fastify({ logger, bodyLimit: BODY_LIMIT });

  // Built after Fastify so migrations report through the app's logger rather
  // than stdout, and stay silent when logging is disabled.
  const db = connectToDb(dbFile);
  if (migrate) latest(db, { logger: fastify.log });

  // Ties the connection to the Fastify lifecycle: app.close() now releases it,
  // which matters for tests and for graceful shutdown alike.
  fastify.addHook("onClose", async () => {
    db.close();
  });

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.setErrorHandler(function (
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    // Always record the real error server-side, whatever we choose to disclose.
    request.log.error({ err: error }, "Request error");

    const statusCode = error.statusCode ?? 500;

    // 4xx messages are *for* the caller — they say which field failed validation,
    // so they pass through untouched. 5xx messages are for us, and in production
    // they are replaced: the caller gets request.id to quote, and the real error
    // stays in the log line above.
    const hideDetail = statusCode >= 500 && process.env.NODE_ENV === "production";

    return reply.code(statusCode).send({
      statusCode,
      error: error.code ?? error.name,
      message: hideDetail
        ? `Internal Server Error. Please contact support with request id ${request.id}.`
        : error.message,
    });
  });

  fastify.register(healthRoutes(db));
  fastify.register(usersRoutes(db));

  return fastify;
}
