import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  UsersInsertSchema,
  UsersInsertResponseSchema,
  UsersUpdateSchema,
  UsersUpdateParamsSchema,
} from "../db/refinements/users.ts";
import { isUniqueViolation } from "./sqlite-errors.ts";

const ErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
});

export default function userRoutes(db: DatabaseSync) {
  const plugin: FastifyPluginAsyncZod = async function (fastify) {
    fastify.post("/users", {
      schema: {
        body: UsersInsertSchema,
        response: { 201: UsersInsertResponseSchema, 409: ErrorSchema },
      },
    }, async (request, reply) => {
      const { email, dob } = request.body;

      const stmt = db.prepare("INSERT INTO users (email, dob) VALUES (?, ?)");

      let result;
      try {
        result = stmt.run(email, dob ?? null);
      } catch (err) {
        // Without this the raw SQLite message would reach the client as a 500.
        if (isUniqueViolation(err)) {
          reply.code(409);
          return { statusCode: 409, error: "Conflict", message: "Email already registered" };
        }
        throw err;
      }

      reply.code(201);
      return { id: Number(result.lastInsertRowid) };
    });

    fastify.patch("/users/:id", {
      schema: {
        params: UsersUpdateParamsSchema,
        body: UsersUpdateSchema,
        // 204 carries no body; z.null() declares that without inventing a payload.
        response: { 204: z.null(), 404: ErrorSchema, 409: ErrorSchema },
      },
    }, async (request, reply) => {
      const { id } = request.params;

      // Checked up front rather than via the UPDATE's `changes` count, because an
      // empty body runs no UPDATE at all and would otherwise report success.
      const existing = db.prepare("SELECT 1 FROM users WHERE id = ?").get(id);
      if (!existing) {
        reply.code(404);
        return { statusCode: 404, error: "Not Found", message: `User ${id} not found` };
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
          db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
        } catch (err) {
          // Renaming to an address another user already holds.
          if (isUniqueViolation(err)) {
            reply.code(409);
            return { statusCode: 409, error: "Conflict", message: "Email already registered" };
          }
          throw err;
        }
      }

      reply.code(204);
    });
  };

  return plugin;
}
