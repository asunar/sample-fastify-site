import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  UsersInsertSchema,
  UsersInsertResponseSchema,
  UsersUpdateSchema,
  UsersUpdateParamsSchema,
} from "../db/refinements.ts";

export default function usersRoutes(db: DatabaseSync) {
  const plugin: FastifyPluginAsyncZod = async function (fastify) {
    fastify.post("/users", {
      schema: {
        body: UsersInsertSchema,
        response: { 201: UsersInsertResponseSchema },
      },
    }, async (request, reply) => {
      const { email, dob } = request.body;

      const stmt = db.prepare("INSERT INTO users (email, dob) VALUES (?, ?)");
      const result = stmt.run(email, dob ?? null);

      reply.code(201);
      return { id: Number(result.lastInsertRowid) };
    });

    fastify.patch("/users/:id", {
      schema: {
        params: UsersUpdateParamsSchema,
        body: UsersUpdateSchema,
        response: { 204: UsersUpdateSchema.partial() },
      },
    }, async (request, reply) => {
      const { id } = request.params;

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
        db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
      }

      reply.code(204);
    });
  };

  return plugin;
}
