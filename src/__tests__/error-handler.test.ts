import test, { before, after, describe } from "node:test";
import assert from "node:assert";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.ts";

const INTERNAL_DETAIL = "connection string postgres://user:hunter2@host/db";

// A route that throws is registered before ready() so the error handler sees it.
function buildAppWithFailingRoute(nodeEnv: string) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;

  const app = buildApp(":memory:", { migrate: true, logger: false });
  app.get("/boom", async () => {
    throw new Error(INTERNAL_DETAIL);
  });

  return {
    app,
    restore: () => {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    },
  };
}

describe("error handler in production", () => {
  let app: FastifyInstance;
  let restore: () => void;

  before(async () => {
    ({ app, restore } = buildAppWithFailingRoute("production"));
    await app.ready();
  });

  after(async () => {
    await app.close();
    restore();
  });

  test("does not leak the internal error message to the client", async () => {
    const response = await app.inject({ method: "GET", url: "/boom" });

    assert.strictEqual(response.statusCode, 500);
    assert.ok(
      !response.body.includes("hunter2"),
      `Internal detail leaked to client: ${response.body}`,
    );
  });

  test("still validates request bodies", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: { email: "not-an-email" },
    });

    assert.strictEqual(response.statusCode, 400, "Validation must still return 400");
  });
});

describe("error handler in development", () => {
  let app: FastifyInstance;
  let restore: () => void;

  before(async () => {
    ({ app, restore } = buildAppWithFailingRoute("development"));
    await app.ready();
  });

  after(async () => {
    await app.close();
    restore();
  });

  test("keeps the real message for local debugging", async () => {
    const response = await app.inject({ method: "GET", url: "/boom" });

    assert.strictEqual(response.statusCode, 500);
    assert.ok(
      response.body.includes("hunter2"),
      "Developers should still see the real error locally",
    );
  });
});
