// It is run after migrations are applied to generate the base schemas.
// Format refinements (e.g. z.email(), z.iso.date()) live in src/db/refinements.ts.

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { connectToDb } from "../src/db/db.ts";

type ColumnInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

function columnToZodExpr(col: ColumnInfo): string {
  const typeMap: Record<string, string> = {
    INTEGER: "z.number().int()",
    INT: "z.number().int()",
    REAL: "z.number()",
    NUMERIC: "z.number()",
  };
  const base = typeMap[col.type.toUpperCase()] ?? "z.string()";
  return col.notnull ? base : `${base}.optional()`;
}

function getTables(db: DatabaseSync): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

function generateSchemaForTable(db: DatabaseSync, table: string): string {
  const columns = db
    .prepare(`PRAGMA table_info('${table}')`)
    .all() as ColumnInfo[];

  const prefix = `Base${table.charAt(0).toUpperCase() + table.slice(1)}`;

  const bodyFields = columns
    .filter((col) => !col.pk)
    .map((col) => `  ${col.name}: ${columnToZodExpr(col)},`)
    .join("\n");

  const responseFields = columns
    .filter((col) => col.pk)
    .map((col) => `  ${col.name}: ${columnToZodExpr(col)},`)
    .join("\n");

  const updateFields = columns
    .filter((col) => !col.pk)
    .map((col) => `  ${col.name}: ${columnToZodExpr(col).replace(/\.optional\(\)$/, "")}.optional(),`)
    .join("\n");

  const paramsFields = columns
    .filter((col) => col.pk)
    .map((col) => `  ${col.name}: ${columnToZodExpr(col).replace(/\.optional\(\)$/, "")},`)
    .join("\n");

  return [
    `export const ${prefix}InsertSchema = z.object({\n${bodyFields}\n});`,
    `export const ${prefix}InsertResponseSchema = z.object({\n${responseFields}\n});`,
    `export const ${prefix}UpdateSchema = z.object({\n${updateFields}\n});`,
    `export const ${prefix}UpdateParamsSchema = z.object({\n${paramsFields}\n});`,
  ].join("\n\n");
}

const db = connectToDb();
const tables = getTables(db);

const schemaBlocks = tables.map((table) => generateSchemaForTable(db, table));

const output = [
  "// AUTO-GENERATED — do not edit by hand.",
  "// Re-generate with: npm run generate:schemas",
  "",
  'import { z } from "zod";',
  "",
  ...schemaBlocks,
  "",
].join("\n");

const outDir = path.join(import.meta.dirname, "..", "src", "generated");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

fs.writeFileSync(path.join(outDir, "schemas.ts"), output);
console.log("Generated src/generated/schemas.ts");
