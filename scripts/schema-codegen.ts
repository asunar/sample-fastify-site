// Pure zod-source generation, separated from generateSchemas.ts so it can be
// tested without the connect-and-write side effects that script performs at
// module scope.

import type { DatabaseSync } from "node:sqlite";
import { type ColumnInfo, getColumns, toPascalCase } from "./introspect.ts";

// "insert" answers "must the client supply this?", "row" answers "can this be
// absent from a stored row?". The two diverge on defaulted NOT NULL columns,
// which the database fills on the way in and always has on the way out.
export type SchemaContext = "insert" | "row";

export function columnToZodExpr(col: ColumnInfo, context: SchemaContext = "row"): string {
  const typeMap: Record<string, string> = {
    INTEGER: "z.number().int()",
    INT: "z.number().int()",
    REAL: "z.number()",
    NUMERIC: "z.number()",
  };
  const base = typeMap[col.type.toUpperCase()] ?? "z.string()";

  // A primary key reports notnull=0 when it is a rowid alias, but a stored row
  // always has one — so in the row context the key is presence, not nullability.
  const optional = context === "insert"
    ? !col.notnull || col.dflt_value !== null
    : !col.notnull && !col.pk;

  return optional ? `${base}.optional()` : base;
}

export function generateSchemaForTable(db: DatabaseSync, table: string): string {
  const columns = getColumns(db, table);

  const prefix = `Base${toPascalCase(table)}`;

  const bodyFields = columns
    .filter((col) => !col.pk)
    .map((col) => `  ${col.name}: ${columnToZodExpr(col, "insert")},`)
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

  // Every column, primary keys included. The read endpoints serialize whole rows,
  // which none of the write-shaped schemas above describe.
  const rowFields = columns
    .map((col) => `  ${col.name}: ${columnToZodExpr(col, "row")},`)
    .join("\n");

  return [
    `export const ${prefix}InsertSchema = z.object({\n${bodyFields}\n});`,
    `export const ${prefix}InsertResponseSchema = z.object({\n${responseFields}\n});`,
    `export const ${prefix}UpdateSchema = z.object({\n${updateFields}\n});`,
    `export const ${prefix}UpdateParamsSchema = z.object({\n${paramsFields}\n});`,
    `export const ${prefix}RowSchema = z.object({\n${rowFields}\n});`,
  ].join("\n\n");
}
