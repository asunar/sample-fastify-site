// Scaffolds a refinements module, a route module and a test file per table.
//
// The load-bearing rule is that an existing file is NEVER overwritten. That is
// what makes this safe to run on every `npm run migrate`: scaffolded code is
// hand-written code the moment it lands, and regeneration must not eat it.

import fs from "node:fs";
import path from "node:path";
import { connectToDb } from "../src/db/db.ts";
import { getColumns, getTables, toPascalCase } from "./introspect.ts";

const root = path.join(import.meta.dirname, "..");
const refinementsDir = path.join(root, "src", "db", "refinements");
const routesDir = path.join(root, "src", "routes");
const testsDir = path.join(root, "src", "__tests__");

function writeIfAbsent(file: string, contents: string): boolean {
  if (fs.existsSync(file)) {
    console.log(`  - skipped ${path.relative(root, file)} (exists)`);
    return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  console.log(`  ✓ wrote ${path.relative(root, file)}`);
  return true;
}

function refinementsSource(table: string, pascal: string, pk: string): string {
  return `// Hand-written refinements for the ${table} table. The generated base schemas
// only know column types; tighten them here (z.email(), z.iso.date(), min/max)
// and the constraints flow into both validation and openapi.json.

import { z } from "zod";
import {
  Base${pascal}InsertSchema,
  Base${pascal}InsertResponseSchema,
  Base${pascal}UpdateSchema,
  Base${pascal}UpdateParamsSchema,
  Base${pascal}RowSchema,
} from "../../generated/schemas.ts";

export const ${pascal}InsertSchema = Base${pascal}InsertSchema;

export const ${pascal}InsertResponseSchema = Base${pascal}InsertResponseSchema;

export const ${pascal}UpdateSchema = Base${pascal}UpdateSchema;

export const ${pascal}RowSchema = Base${pascal}RowSchema;

// Path params arrive as strings, so the numeric key is coerced before validation.
export const ${pascal}UpdateParamsSchema = Base${pascal}UpdateParamsSchema.extend({
  ${pk}: z.coerce.number().int(),
});
`;
}

// TODO(human): decide the shape of the generated list endpoint.
//
// Return the three fragments the list route is built from. They are spliced into
// the template in listRouteSource() below.
//
//   querySchema — zod object source for the querystring, e.g.
//                 `z.object({ limit: z.coerce.number().int().max(100).default(50) })`
//                 Use `z.object({})` for no querystring at all.
//   sqlSuffix   — text appended to `SELECT * FROM <table>`, e.g. " LIMIT ?"
//   sqlArgs     — comma-separated args passed to .all(), e.g. "limit"
//                 Empty string for none.
function listRouteParts(table: string): {
  querySchema: string;
  sqlSuffix: string;
  sqlArgs: string;
} {
  // The lower bounds are what make the cap real: SQLite reads `LIMIT -1` as "no
  // limit", so without min(0) a client could pass limit=-1 and page past max(100)
  // to a full table scan.
  const querySchema = "z.object({ skip: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(0).max(100).default(50) })";
  const sqlSuffix = " LIMIT ? OFFSET ?";
  const sqlArgs = "limit, skip";
  return { querySchema, sqlSuffix, sqlArgs };   
}

function listRouteSource(table: string, pascal: string): string {
  const { querySchema, sqlSuffix, sqlArgs } = listRouteParts(table);
  const destructure = sqlArgs ? `      const { ${sqlArgs} } = request.query;\n` : "";
  const args = sqlArgs ? `.all(${sqlArgs})` : ".all()";

  return `    fastify.get("/${table}", {
      schema: {
        querystring: ${querySchema},
        response: { 200: z.array(${pascal}RowSchema) },
      },
    }, async (request) => {
${destructure}      // node:sqlite returns untyped rows; the serializer validates them against
      // ${pascal}RowSchema at runtime, so the assertion states what it enforces.
      return db.prepare("SELECT * FROM ${table}${sqlSuffix}")${args} as z.infer<typeof ${pascal}RowSchema>[];
    });
`;
}

function routeSource(table: string, pascal: string, pk: string): string {
  return `import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  ${pascal}InsertSchema,
  ${pascal}InsertResponseSchema,
  ${pascal}UpdateSchema,
  ${pascal}UpdateParamsSchema,
  ${pascal}RowSchema,
} from "../db/refinements/${table}.ts";
import { isUniqueViolation } from "./sqlite-errors.ts";

const ErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
});

export default function ${table}Routes(db: DatabaseSync) {
  const plugin: FastifyPluginAsyncZod = async function (fastify) {
${listRouteSource(table, pascal)}
    fastify.get("/${table}/:${pk}", {
      schema: {
        params: ${pascal}UpdateParamsSchema,
        response: { 200: ${pascal}RowSchema, 404: ErrorSchema },
      },
    }, async (request, reply) => {
      const { ${pk} } = request.params;

      const row = db.prepare("SELECT * FROM ${table} WHERE ${pk} = ?").get(${pk}) as
        z.infer<typeof ${pascal}RowSchema> | undefined;
      if (!row) {
        reply.code(404);
        return { statusCode: 404, error: "Not Found", message: \`${pascal} \${${pk}} not found\` };
      }

      return row;
    });

    fastify.post("/${table}", {
      schema: {
        body: ${pascal}InsertSchema,
        response: { 201: ${pascal}InsertResponseSchema, 409: ErrorSchema },
      },
    }, async (request, reply) => {
      const columns = Object.keys(request.body);
      const values = Object.values(request.body) as SQLInputValue[];
      const placeholders = columns.map(() => "?").join(", ");

      let result;
      try {
        result = db
          .prepare(\`INSERT INTO ${table} (\${columns.join(", ")}) VALUES (\${placeholders})\`)
          .run(...values);
      } catch (err) {
        if (isUniqueViolation(err)) {
          reply.code(409);
          return { statusCode: 409, error: "Conflict", message: "Already exists" };
        }
        throw err;
      }

      reply.code(201);
      return { ${pk}: Number(result.lastInsertRowid) };
    });

    fastify.patch("/${table}/:${pk}", {
      schema: {
        params: ${pascal}UpdateParamsSchema,
        body: ${pascal}UpdateSchema,
        response: { 204: z.null(), 404: ErrorSchema, 409: ErrorSchema },
      },
    }, async (request, reply) => {
      const { ${pk} } = request.params;

      // Checked up front rather than via the UPDATE's \`changes\` count, because an
      // empty body runs no UPDATE at all and would otherwise report success.
      const existing = db.prepare("SELECT 1 FROM ${table} WHERE ${pk} = ?").get(${pk});
      if (!existing) {
        reply.code(404);
        return { statusCode: 404, error: "Not Found", message: \`${pascal} \${${pk}} not found\` };
      }

      const fields: string[] = [];
      const values: SQLInputValue[] = [];

      for (const [key, value] of Object.entries(request.body)) {
        if (value !== undefined) {
          fields.push(\`\${key} = ?\`);
          values.push(value as SQLInputValue);
        }
      }

      if (fields.length > 0) {
        values.push(${pk});
        try {
          db.prepare(\`UPDATE ${table} SET \${fields.join(", ")} WHERE ${pk} = ?\`).run(...values);
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

    fastify.delete("/${table}/:${pk}", {
      schema: {
        params: ${pascal}UpdateParamsSchema,
        response: { 204: z.null(), 404: ErrorSchema },
      },
    }, async (request, reply) => {
      const { ${pk} } = request.params;

      const result = db.prepare("DELETE FROM ${table} WHERE ${pk} = ?").run(${pk});
      if (result.changes === 0) {
        reply.code(404);
        return { statusCode: 404, error: "Not Found", message: \`${pascal} \${${pk}} not found\` };
      }

      reply.code(204);
    });
  };

  return plugin;
}
`;
}

function testSource(table: string, pascal: string, pk: string): string {
  return `import test, { before, after, describe } from "node:test";
import assert from "node:assert";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.ts";

describe("${table} routes", () => {
  let app: FastifyInstance;

  before(async () => {
    app = buildApp(":memory:", { migrate: true, logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test("lists ${table}", async () => {
    const response = await app.inject({ method: "GET", url: "/${table}" });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(Array.isArray(response.json()));
  });

  test("returns 404 for a ${table} row that does not exist", async () => {
    const response = await app.inject({ method: "GET", url: "/${table}/999999" });

    assert.strictEqual(response.statusCode, 404);
  });

  test("returns 404 when deleting a ${table} row that does not exist", async () => {
    const response = await app.inject({ method: "DELETE", url: "/${table}/999999" });

    assert.strictEqual(response.statusCode, 404);
  });

  // Add POST and PATCH cases here — they need column values this scaffold
  // cannot guess. See src/__tests__/users.test.ts for the shape.
});
`;
}

const db = connectToDb();
const tables = getTables(db);

for (const table of tables) {
  const pascal = toPascalCase(table);
  const pkColumns = getColumns(db, table).filter((col) => col.pk);

  console.log(`${table}:`);

  if (pkColumns.length !== 1) {
    console.log(`  - skipped (needs exactly one primary key column, found ${pkColumns.length})`);
    continue;
  }

  const pk = pkColumns[0].name;

  writeIfAbsent(path.join(refinementsDir, `${table}.ts`), refinementsSource(table, pascal, pk));
  writeIfAbsent(path.join(routesDir, `${table}-routes.ts`), routeSource(table, pascal, pk));
  writeIfAbsent(path.join(testsDir, `${table}.test.ts`), testSource(table, pascal, pk));
}
