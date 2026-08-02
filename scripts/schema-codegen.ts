// Pure zod-source generation, separated from generateSchemas.ts so it can be
// tested without the connect-and-write side effects that script performs at
// module scope.

import type { DatabaseSync } from "node:sqlite";
import { type ColumnInfo, getColumns, toPascalCase } from "./introspect.ts";

// Each schema asks a different question of the same column, and they do not have
// the same answer:
//
//   insert — must the client supply this?      no, if it is nullable or defaulted
//   row    — what can a stored value be?       null, if the column is nullable
//   update — a partial, so everything optional
//   params — a path parameter, so always required
export type SchemaContext = "insert" | "row" | "update" | "params";

export function columnToZodExpr(col: ColumnInfo, context: SchemaContext = "row"): string {
  const typeMap: Record<string, string> = {
    INTEGER: "z.number().int()",
    INT: "z.number().int()",
    REAL: "z.number()",
    NUMERIC: "z.number()",
  };
  const base = typeMap[col.type.toUpperCase()] ?? "z.string()";

  switch (context) {
    case "params":
      return base;

    case "update":
      return `${base}.optional()`;

    case "insert":
      // The database fills defaulted columns, so requiring them of the client
      // would force it to send a value the server was going to generate.
      return !col.notnull || col.dflt_value !== null ? `${base}.optional()` : base;

    case "row":
      // .nullable(), not .optional(): node:sqlite returns SQL NULL as JavaScript
      // null and always includes the column, and zod's .optional() is
      // `| undefined`, which rejects null and fails response serialization.
      //
      // A primary key reports notnull=0 when it is a rowid alias, but a stored
      // row always has one, so presence rather than nullability decides it.
      return !col.notnull && !col.pk ? `${base}.nullable()` : base;
  }
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
    .map((col) => `  ${col.name}: ${columnToZodExpr(col, "update")},`)
    .join("\n");

  const paramsFields = columns
    .filter((col) => col.pk)
    .map((col) => `  ${col.name}: ${columnToZodExpr(col, "params")},`)
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
