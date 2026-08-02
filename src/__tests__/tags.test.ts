import test, { before, after, describe } from "node:test";
import assert from "node:assert";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.ts";

describe("tags routes", () => {
  let app: FastifyInstance;

  before(async () => {
    app = buildApp(":memory:", { migrate: true, logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test("lists tags", async () => {
    const response = await app.inject({ method: "GET", url: "/tags" });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(Array.isArray(response.json()));
  });

  test("returns 404 for a tags row that does not exist", async () => {
    const response = await app.inject({ method: "GET", url: "/tags/999999" });

    assert.strictEqual(response.statusCode, 404);
  });

  test("returns 404 when deleting a tags row that does not exist", async () => {
    const response = await app.inject({ method: "DELETE", url: "/tags/999999" });

    assert.strictEqual(response.statusCode, 404);
  });

  // Add POST and PATCH cases here — they need column values this scaffold
  // cannot guess. See src/__tests__/users.test.ts for the shape.
});
