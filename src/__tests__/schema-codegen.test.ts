import test, { describe } from "node:test";
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { getColumns } from "../../scripts/introspect.ts";
import { columnToZodExpr, generateSchemaForTable } from "../../scripts/schema-codegen.ts";

// One table covering every nullability/default combination the generator has to
// distinguish. Built in memory so the tests never touch src/db/data.db.
function fixtureColumns() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE widgets(
    id          INTEGER PRIMARY KEY,
    required    TEXT NOT NULL,
    nullable    TEXT,
    literal     INTEGER NOT NULL DEFAULT 0,
    expression  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    quantity    REAL NOT NULL
  ) STRICT;`);

  const columns = Object.fromEntries(
    getColumns(db, "widgets").map((col) => [col.name, col]),
  );

  return { db, columns };
}

describe("columnToZodExpr", () => {
  test("maps SQLite types to zod types", () => {
    const { db, columns } = fixtureColumns();

    assert.strictEqual(columnToZodExpr(columns.required), "z.string()");
    assert.strictEqual(columnToZodExpr(columns.quantity), "z.number()");
    assert.strictEqual(columnToZodExpr(columns.literal), "z.number().int()");

    db.close();
  });

  // The distinction that matters: node:sqlite hands back SQL NULL as JavaScript
  // null and always includes the column, so a row's nullable value is null, never
  // absent. zod's .optional() means `| undefined` and rejects null outright.
  test("a nullable column may be omitted or sent as null, and reads back as null", () => {
    const { db, columns } = fixtureColumns();

    // .nullish() is .nullable().optional(): omit it, or send null deliberately.
    assert.strictEqual(columnToZodExpr(columns.nullable, "insert"), "z.string().nullish()");
    assert.strictEqual(columnToZodExpr(columns.nullable, "update"), "z.string().nullish()");
    assert.strictEqual(columnToZodExpr(columns.nullable, "row"), "z.string().nullable()");

    db.close();
  });

  // A defaulted column may be omitted, but null is not the same as "use the
  // default" — writing null to a NOT NULL column is a constraint violation.
  test("a defaulted NOT NULL column is optional but never nullable", () => {
    const { db, columns } = fixtureColumns();

    assert.strictEqual(columnToZodExpr(columns.literal, "insert"), "z.number().int().optional()");
    assert.strictEqual(columnToZodExpr(columns.expression, "insert"), "z.string().optional()");
    assert.strictEqual(columnToZodExpr(columns.literal, "update"), "z.number().int().optional()");

    db.close();
  });

  test("update makes every column optional and params leaves them required", () => {
    const { db, columns } = fixtureColumns();

    assert.strictEqual(columnToZodExpr(columns.required, "update"), "z.string().optional()");
    assert.strictEqual(columnToZodExpr(columns.id, "params"), "z.number().int()");

    db.close();
  });

  test("a NOT NULL column with no default is required in both contexts", () => {
    const { db, columns } = fixtureColumns();

    assert.strictEqual(columnToZodExpr(columns.required, "insert"), "z.string()");
    assert.strictEqual(columnToZodExpr(columns.required, "row"), "z.string()");

    db.close();
  });

  // The reason the context parameter exists: the database supplies these on the
  // way in, so the client must not be forced to, but a stored row always has one.
  test("a NOT NULL column with a literal default is optional to insert, required in a row", () => {
    const { db, columns } = fixtureColumns();

    assert.strictEqual(columnToZodExpr(columns.literal, "insert"), "z.number().int().optional()");
    assert.strictEqual(columnToZodExpr(columns.literal, "row"), "z.number().int()");

    db.close();
  });

  // INTEGER PRIMARY KEY is a rowid alias, which PRAGMA table_info reports as
  // notnull=0. A stored row always has one regardless, so nullability is the
  // wrong signal for the key.
  test("a primary key is required in a row despite reporting notnull=0", () => {
    const { db, columns } = fixtureColumns();

    assert.strictEqual(columns.id.notnull, 0, "fixture assumption: rowid alias is notnull=0");
    assert.strictEqual(columnToZodExpr(columns.id, "row"), "z.number().int()");

    db.close();
  });

  test("a NOT NULL column with an expression default behaves the same way", () => {
    const { db, columns } = fixtureColumns();

    assert.strictEqual(columnToZodExpr(columns.expression, "insert"), "z.string().optional()");
    assert.strictEqual(columnToZodExpr(columns.expression, "row"), "z.string()");

    db.close();
  });
});

describe("generateSchemaForTable", () => {
  test("defaulted columns are optional in the insert schema but not the row schema", () => {
    const { db } = fixtureColumns();

    const source = generateSchemaForTable(db, "widgets");
    const block = (name: string) =>
      source.split(`export const BaseWidgets${name}Schema = z.object({`)[1].split("});")[0];

    const insert = block("Insert");
    assert.match(insert, /literal: z\.number\(\)\.int\(\)\.optional\(\)/);
    assert.match(insert, /expression: z\.string\(\)\.optional\(\)/);
    assert.match(insert, /required: z\.string\(\),/);

    const row = block("Row");
    assert.match(row, /literal: z\.number\(\)\.int\(\),/);
    assert.match(row, /expression: z\.string\(\),/);
    // A NULL in this column must serialize, not 500.
    assert.match(row, /nullable: z\.string\(\)\.nullable\(\),/);

    // The primary key is excluded from the write body and non-optional in the row.
    assert.ok(!insert.includes("id:"));
    assert.match(row, /id: z\.number\(\)\.int\(\),/);

    // Same for the insert response: lastInsertRowid always yields a value.
    assert.match(block("InsertResponse"), /id: z\.number\(\)\.int\(\),/);

    db.close();
  });

  test("no column is required in the update schema", () => {
    const { db } = fixtureColumns();

    const source = generateSchemaForTable(db, "widgets");
    const update = source
      .split("export const BaseWidgetsUpdateSchema = z.object({")[1]
      .split("});")[0];

    // .nullish() is .nullable().optional(), so it satisfies "not required" too.
    for (const line of update.trim().split("\n")) {
      assert.match(
        line,
        /\.(optional|nullish)\(\),$/,
        `required in update schema: ${line.trim()}`,
      );
    }

    db.close();
  });
});
