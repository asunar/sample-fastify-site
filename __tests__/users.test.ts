import test, { before, after, describe } from "node:test";
import assert from "node:assert";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.ts";

describe("POST /users", () => {
  let app: FastifyInstance;

  before(async () => {
    app = buildApp(":memory:", { migrate: true, logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test("inserts a user and returns 201 with id", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: { email: "alice@example.com", dob: "1990-01-15" },
    });

    assert.strictEqual(response.statusCode, 201);
    const body = response.json();
    assert.ok(typeof body.id === "number", "Should return a numeric id");
  });

  test("works without dob", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: { email: "bob@example.com" },
    });

    assert.strictEqual(response.statusCode, 201);
    const body = response.json();
    assert.ok(typeof body.id === "number", "Should return a numeric id");
  });

  test("returns 400 when email is missing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: { dob: "1990-01-15" },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  test("returns 400 when email is not a valid email address", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: { email: "not-an-email" },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  test("returns 400 when body is empty", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: {},
    });

    assert.strictEqual(response.statusCode, 400);
  });

  test("returns 400 when dob is not a valid date", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: { email: "carol@example.com", dob: "not-a-date" },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  test("returns 400 when dob is a datetime instead of a date", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: { email: "carol@example.com", dob: "1990-01-15T00:00:00Z" },
    });

    assert.strictEqual(response.statusCode, 400);
  });
});

describe("PATCH /users/:id", () => {
  let app: FastifyInstance;
  let userId: number;

  before(async () => {
    app = buildApp(":memory:", { migrate: true, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: { email: "dave@example.com", dob: "1985-06-20" },
    });
    userId = response.json().id;
  });

  after(async () => {
    await app.close();
  });

  test("updates email and returns 204", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/users/${userId}`,
      payload: { email: "dave-updated@example.com" },
    });

    assert.strictEqual(response.statusCode, 204);
  });

  test("updates dob and returns 204", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/users/${userId}`,
      payload: { dob: "1985-06-21" },
    });

    assert.strictEqual(response.statusCode, 204);
  });

  test("returns 400 when email is invalid", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/users/${userId}`,
      payload: { email: "not-an-email" },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  test("returns 400 when dob is invalid", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/users/${userId}`,
      payload: { dob: "not-a-date" },
    });

    assert.strictEqual(response.statusCode, 400);
  });
});
