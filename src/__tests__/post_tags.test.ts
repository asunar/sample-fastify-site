import test, { before, after, describe } from "node:test";
import assert from "node:assert";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.ts";

describe("post_tags routes", () => {
  let app: FastifyInstance;

  before(async () => {
    app = buildApp(":memory:", { migrate: true, logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test("lists post_tags", async () => {
    const response = await app.inject({ method: "GET", url: "/post_tags" });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(Array.isArray(response.json()));
  });

  test("returns 404 for a post_tags row that does not exist", async () => {
    const response = await app.inject({ method: "GET", url: "/post_tags/999999" });

    assert.strictEqual(response.statusCode, 404);
  });

  test("returns 404 when deleting a post_tags row that does not exist", async () => {
    const response = await app.inject({ method: "DELETE", url: "/post_tags/999999" });

    assert.strictEqual(response.statusCode, 404);
  });

  // post_tags carries both constraint kinds, so it is where they can be told
  // apart: a bad reference is 422, a duplicate valid pair is 409.
  async function seedPair() {
    const author = await app.inject({
      method: "POST",
      url: "/authors",
      payload: { name: "Ada", email: `ada${Date.now()}@example.com` },
    });
    const post = await app.inject({
      method: "POST",
      url: "/posts",
      payload: {
        author_id: author.json().id,
        title: "T",
        slug: `slug-${Date.now()}-${Math.random()}`,
        body: "...",
      },
    });
    const tag = await app.inject({
      method: "POST",
      url: "/tags",
      payload: { name: `tag-${Date.now()}-${Math.random()}` },
    });

    return { postId: post.json().id, tagId: tag.json().id };
  }

  test("links a real post to a real tag", async () => {
    const { postId, tagId } = await seedPair();

    const response = await app.inject({
      method: "POST",
      url: "/post_tags",
      payload: { post_id: postId, tag_id: tagId },
    });

    assert.strictEqual(response.statusCode, 201);
  });

  test("returns 422 when post_id references a post that does not exist", async () => {
    const { tagId } = await seedPair();

    const response = await app.inject({
      method: "POST",
      url: "/post_tags",
      payload: { post_id: 999999, tag_id: tagId },
    });

    assert.strictEqual(response.statusCode, 422);
  });

  test("returns 422 when tag_id references a tag that does not exist", async () => {
    const { postId } = await seedPair();

    const response = await app.inject({
      method: "POST",
      url: "/post_tags",
      payload: { post_id: postId, tag_id: 999999 },
    });

    assert.strictEqual(response.statusCode, 422);
  });

  test("returns 409 when the same pair is linked twice", async () => {
    const { postId, tagId } = await seedPair();
    const payload = { post_id: postId, tag_id: tagId };

    await app.inject({ method: "POST", url: "/post_tags", payload });
    const response = await app.inject({ method: "POST", url: "/post_tags", payload });

    assert.strictEqual(response.statusCode, 409, "unique violations must still win");
  });
});
