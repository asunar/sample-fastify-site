// ESM
import path from "node:path";
import closeWithGrace from "close-with-grace";
import { buildApp } from "./app.ts";

const PORT = Number(process.env.PORT ?? 3000);
// 0.0.0.0 rather than the default 127.0.0.1: a container that only listens on
// loopback is unreachable from outside itself.
const HOST = process.env.HOST ?? "0.0.0.0";
// How long in-flight requests get to finish before the process is forced down.
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000);

const fastify = buildApp(path.join(import.meta.dirname, "db", "data.db"), { migrate: false });

// Traps the termination signals plus uncaughtException and unhandledRejection,
// so a crash drains through the same path as a clean SIGTERM. A second signal
// during shutdown aborts immediately.
closeWithGrace(
  { delay: SHUTDOWN_TIMEOUT_MS, logger: fastify.log },
  async ({ signal, err, manual }) => {
    if (err) {
      fastify.log.error({ err }, "Shutting down after an unhandled error");
    } else {
      fastify.log.info({ signal, manual }, "Shutting down");
    }

    await fastify.close();
    fastify.log.info("Shutdown complete");
  },
);

try {
  await fastify.listen({ port: PORT, host: HOST });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
