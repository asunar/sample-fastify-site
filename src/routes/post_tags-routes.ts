import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  PostTagsInsertSchema,
  PostTagsInsertResponseSchema,
  PostTagsUpdateSchema,
  PostTagsUpdateParamsSchema,
  PostTagsRowSchema,
} from "../db/refinements/post_tags.ts";
import { isUniqueViolation } from "./sqlite-errors.ts";

const ErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
});

export default function post_tagsRoutes(db: DatabaseSync) {
  const plugin: FastifyPluginAsyncZod = async function (fastify) {
    fastify.get("/post_tags", {
      schema: {
        querystring: z.object({ skip: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(0).max(100).default(50) }),
        response: { 200: z.array(PostTagsRowSchema) },
      },
    }, async (request) => {
      const { limit, skip } = request.query;
      // node:sqlite returns untyped rows; the serializer validates them against
      // PostTagsRowSchema at runtime, so the assertion states what it enforces.
      return db.prepare("SELECT * FROM post_tags LIMIT ? OFFSET ?").all(limit, skip) as z.infer<typeof PostTagsRowSchema>[];
    });

    fastify.get("/post_tags/:id", {
      schema: {
        params: PostTagsUpdateParamsSchema,
        response: { 200: PostTagsRowSchema, 404: ErrorSchema },
      },
    }, async (request, reply) => {
      const { id } = request.params;

      const row = db.prepare("SELECT * FROM post_tags WHERE id = ?").get(id) as
        z.infer<typeof PostTagsRowSchema> | undefined;
      if (!row) {
        reply.code(404);
        return { statusCode: 404, error: "Not Found", message: `PostTags ${id} not found` };
      }

      return row;
    });

    fastify.post("/post_tags", {
      schema: {
        body: PostTagsInsertSchema,
        response: { 201: PostTagsInsertResponseSchema, 409: ErrorSchema },
      },
    }, async (request, reply) => {
      const columns = Object.keys(request.body);
      const values = Object.values(request.body) as SQLInputValue[];
      const placeholders = columns.map(() => "?").join(", ");

      let result;
      try {
        result = db
          .prepare(`INSERT INTO post_tags (${columns.join(", ")}) VALUES (${placeholders})`)
          .run(...values);
      } catch (err) {
        if (isUniqueViolation(err)) {
          reply.code(409);
          return { statusCode: 409, error: "Conflict", message: "Already exists" };
        }
        throw err;
      }

      reply.code(201);
      return { id: Number(result.lastInsertRowid) };
    });

    fastify.patch("/post_tags/:id", {
      schema: {
        params: PostTagsUpdateParamsSchema,
        body: PostTagsUpdateSchema,
        response: { 204: z.null(), 404: ErrorSchema, 409: ErrorSchema },
      },
    }, async (request, reply) => {
      const { id } = request.params;

      // Checked up front rather than via the UPDATE's `changes` count, because an
      // empty body runs no UPDATE at all and would otherwise report success.
      const existing = db.prepare("SELECT 1 FROM post_tags WHERE id = ?").get(id);
      if (!existing) {
        reply.code(404);
        return { statusCode: 404, error: "Not Found", message: `PostTags ${id} not found` };
      }

      const fields: string[] = [];
      const values: SQLInputValue[] = [];

      for (const [key, value] of Object.entries(request.body)) {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value as SQLInputValue);
        }
      }

      if (fields.length > 0) {
        values.push(id);
        try {
          db.prepare(`UPDATE post_tags SET ${fields.join(", ")} WHERE id = ?`).run(...values);
        } catch (err) {
          if (isUniqueViolation(err)) {
            reply.code(409);
            return { statusCode: 409, error: "Conflict", message: "Already exists" };
          }
          throw err;
        }
      }

      reply.code(204);
    });

    fastify.delete("/post_tags/:id", {
      schema: {
        params: PostTagsUpdateParamsSchema,
        response: { 204: z.null(), 404: ErrorSchema },
      },
    }, async (request, reply) => {
      const { id } = request.params;

      const result = db.prepare("DELETE FROM post_tags WHERE id = ?").run(id);
      if (result.changes === 0) {
        reply.code(404);
        return { statusCode: 404, error: "Not Found", message: `PostTags ${id} not found` };
      }

      reply.code(204);
    });
  };

  return plugin;
}
