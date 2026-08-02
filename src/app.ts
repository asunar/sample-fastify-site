import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import Fastify, {
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type FastifyPluginAsyncZod,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { connectToDb } from "./db/db.ts";
import { latest } from "./db/migration-runner.ts";
import { isForeignKeyViolation } from "./routes/sqlite-errors.ts";

// 1MB. Fastify's own default, set explicitly so the limit is visible rather than
// implied — it is the first thing to tune if large payloads are ever expected.
const BODY_LIMIT = 1_048_576;

const ROUTES_DIR = path.join(import.meta.dirname, "routes");

// Every route module exports `default (db) => FastifyPluginAsyncZod`. Discovery
// relies on that shape, so a scaffolded file is live the moment it is written and
// nothing has to edit this file.
type RouteModule = { default: (db: DatabaseSync) => FastifyPluginAsyncZod };

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
  // withTypeProvider is compile-time only — it re-types this instance so any
  // route declared directly here infers from its zod schemas, the same way the
  // FastifyPluginAsyncZod route plugins already do. The runtime wiring is the
  // validator/serializer compiler pair set below.
  const fastify = Fastify({ logger, bodyLimit: BODY_LIMIT })
    .withTypeProvider<ZodTypeProvider>();

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
    // A payload referencing a row that does not exist is a client mistake, not a
    // server fault, so it is logged as a warning rather than paged on. Handled
    // centrally because every route rethrows what it does not map itself, and the
    // database is the only authority on whether a referenced row exists — a
    // pre-check in a schema would race with a concurrent delete.
    if (isForeignKeyViolation(error)) {
      request.log.warn({ err: error }, "Foreign key violation");

      return reply.code(422).send({
        statusCode: 422,
        error: "Unprocessable Content",
        message: "The request references a record that does not exist.",
      });
    }

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

  // Registered before the routes so it observes every one of them. The transforms
  // convert the zod route schemas into OpenAPI-flavoured JSON Schema; because the
  // spec is read off the live route table it cannot drift from what is served.
  fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: "sample-fastify-site",
        description: "REST API with zod-validated requests and responses.",
        version: "1.0.0",
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  fastify.register(fastifySwaggerUi, { routePrefix: "/docs" });

  // swagger-ui serves the document at /docs/json. This alias is the stable,
  // tool-friendly URL, and `hide` keeps the spec from documenting itself.
  fastify.get("/openapi.json", { schema: { hide: true } }, async () => fastify.swagger());

  // An async plugin rather than a top-level await, which keeps buildApp
  // synchronous for its callers — app.ready() waits for this either way.
  fastify.register(async (instance) => {
    const files = fs.readdirSync(ROUTES_DIR)
      .filter((file) => file.endsWith("-routes.ts"))
      .sort();

    for (const file of files) {
      const module = await import(
        pathToFileURL(path.join(ROUTES_DIR, file)).href
      ) as RouteModule;
      instance.register(module.default(db));
    }
  });

  return fastify;
}
