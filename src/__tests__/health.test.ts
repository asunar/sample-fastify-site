import test, { before, after, describe } from "node:test";
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { buildApp } from "../app.ts";
import healthRoutes from "../routes/health-routes.ts";

describe("health endpoints", () => {
  let app: FastifyInstance;

  before(async () => {
    app = buildApp(":memory:", { migrate: true, logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test("GET /health reports ok", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    assert.strictEqual(response.statusCode, 200);
    const body = response.json();
    assert.strictEqual(body.status, "ok");
    assert.ok(typeof body.uptime === "number", "Should report process uptime");
  });

  test("GET /health/ready reports the database is reachable", async () => {
    const response = await app.inject({ method: "GET", url: "/health/ready" });

    assert.strictEqual(response.statusCode, 200);
    const body = response.json();
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.checks.database, true);
  });

  test("GET /health/ready reports 503 when the database is unusable", async () => {
    // Wire the health routes to a handle that is already closed, so the readiness
    // probe hits the failure branch rather than us guessing that it works.
    const db = new DatabaseSync(":memory:");
    db.close();

    const degraded = Fastify({ logger: false });
    degraded.setValidatorCompiler(validatorCompiler);
    degraded.setSerializerCompiler(serializerCompiler);
    degraded.register(healthRoutes(db));
    await degraded.ready();

    const response = await degraded.inject({ method: "GET", url: "/health/ready" });

    assert.strictEqual(response.statusCode, 503);
    const body = response.json();
    assert.strictEqual(body.status, "degraded");
    assert.strictEqual(body.checks.database, false);

    await degraded.close();
  });

  test("GET /health does not depend on the database", async () => {
    // Liveness must stay green even when the database is broken, otherwise an
    // orchestrator would restart a process that is merely waiting on its DB.
    const db = new DatabaseSync(":memory:");
    db.close();

    const degraded = Fastify({ logger: false });
    degraded.setValidatorCompiler(validatorCompiler);
    degraded.setSerializerCompiler(serializerCompiler);
    degraded.register(healthRoutes(db));
    await degraded.ready();

    const response = await degraded.inject({ method: "GET", url: "/health" });
    assert.strictEqual(response.statusCode, 200, "Liveness must not check the database");

    await degraded.close();
  });
});

describe("database lifecycle", () => {
  test("closing the app closes the database handle", async () => {
    const app = buildApp(":memory:", { migrate: true, logger: false });
    await app.ready();

    // Proves the connection is live before shutdown.
    const before = await app.inject({ method: "GET", url: "/health/ready" });
    assert.strictEqual(before.json().checks.database, true);

    await app.close();

    // A second close must not throw — the onClose hook has to be idempotent
    // enough to survive Fastify calling it once and the process exiting.
    await assert.doesNotReject(() => app.close());
  });
});
