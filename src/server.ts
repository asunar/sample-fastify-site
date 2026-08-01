// ESM
import closeWithGrace from "close-with-grace";
import { buildApp } from "./app.ts";
import { resolveServerConfig } from "./config.ts";

const config = resolveServerConfig();

const fastify = buildApp(config.databaseFile, { migrate: false });

// Traps the termination signals plus uncaughtException and unhandledRejection,
// so a crash drains through the same path as a clean SIGTERM. A second signal
// during shutdown aborts immediately.
closeWithGrace(
  { delay: config.shutdownTimeoutMs, logger: fastify.log },
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
  await fastify.listen({ port: config.port, host: config.host });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
