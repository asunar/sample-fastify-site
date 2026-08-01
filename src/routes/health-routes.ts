import type { DatabaseSync } from "node:sqlite";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const LiveSchema = z.object({
  status: z.literal("ok"),
  uptime: z.number(),
});

const ReadySchema = z.object({
  status: z.enum(["ok", "degraded"]),
  checks: z.object({ database: z.boolean() }),
});

export default function healthRoutes(db: DatabaseSync) {
  const plugin: FastifyPluginAsyncZod = async function (fastify) {
    // Liveness: is the process up? Deliberately touches no dependencies, so a
    // sick database never causes an orchestrator to kill an otherwise fine process.
    fastify.get("/health", {
      schema: { response: { 200: LiveSchema } },
    }, async () => {
      return { status: "ok" as const, uptime: process.uptime() };
    });

    // Readiness: should this instance receive traffic? This one *does* check the
    // database, because serving requests without it is pointless.
    fastify.get("/health/ready", {
      schema: { response: { 200: ReadySchema, 503: ReadySchema } },
    }, async (_request, reply) => {
      let database = false;
      try {
        db.prepare("SELECT 1").get();
        database = true;
      } catch {
        database = false;
      }

      if (!database) reply.code(503);

      return {
        status: database ? ("ok" as const) : ("degraded" as const),
        checks: { database },
      };
    });
  };

  return plugin;
}
