import test, { before, after, describe } from "node:test";
import assert from "node:assert";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.ts";

describe("posts routes", () => {
  let app: FastifyInstance;

  before(async () => {
    app = buildApp(":memory:", { migrate: true, logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test("lists posts", async () => {
    const response = await app.inject({ method: "GET", url: "/posts" });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(Array.isArray(response.json()));
  });

  test("returns 404 for a posts row that does not exist", async () => {
    const response = await app.inject({ method: "GET", url: "/posts/999999" });

    assert.strictEqual(response.statusCode, 404);
  });

  test("returns 404 when deleting a posts row that does not exist", async () => {
    const response = await app.inject({ method: "DELETE", url: "/posts/999999" });

    assert.strictEqual(response.statusCode, 404);
  });

  test("creates a post against a real author", async () => {
    const author = await app.inject({
      method: "POST",
      url: "/authors",
      payload: { name: "Ada", email: "ada@example.com" },
    });
    const { id: authorId } = author.json();

    const response = await app.inject({
      method: "POST",
      url: "/posts",
      payload: { author_id: authorId, title: "Hello", slug: "hello", body: "..." },
    });

    assert.strictEqual(response.statusCode, 201);
  });

  // The database is the authority on whether a referenced row exists, so this is
  // caught rather than pre-checked. Before the error handler mapped it, the raw
  // SQLite failure reached the client as a 500.
  test("returns 422 when author_id references an author that does not exist", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/posts",
      payload: { author_id: 999999, title: "Orphan", slug: "orphan", body: "..." },
    });

    assert.strictEqual(response.statusCode, 422);
    assert.strictEqual(response.json().error, "Unprocessable Content");
    assert.ok(
      !response.body.includes("FOREIGN KEY"),
      `driver detail leaked to client: ${response.body}`,
    );
  });

  test("returns 422 when patching author_id to one that does not exist", async () => {
    const author = await app.inject({
      method: "POST",
      url: "/authors",
      payload: { name: "Grace", email: "grace@example.com" },
    });
    const created = await app.inject({
      method: "POST",
      url: "/posts",
      payload: { author_id: author.json().id, title: "T", slug: "patch-me", body: "..." },
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/posts/${created.json().id}`,
      payload: { author_id: 999999 },
    });

    assert.strictEqual(response.statusCode, 422);
  });

  test("returns 409 when the slug is already taken", async () => {
    const author = await app.inject({
      method: "POST",
      url: "/authors",
      payload: { name: "Alan", email: "alan@example.com" },
    });

    const payload = { author_id: author.json().id, title: "Dup", slug: "taken", body: "..." };
    await app.inject({ method: "POST", url: "/posts", payload });
    const response = await app.inject({ method: "POST", url: "/posts", payload });

    assert.strictEqual(response.statusCode, 409, "unique violations must still win");
  });
});
