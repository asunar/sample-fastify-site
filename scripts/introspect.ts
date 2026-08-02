// Shared SQLite introspection. Lives apart from generateSchemas.ts because that
// script does its work at module scope — importing it to borrow a helper would
// regenerate schemas as a side effect.

import type { DatabaseSync } from "node:sqlite";

export type ColumnInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

export function getTables(db: DatabaseSync): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

export function getColumns(db: DatabaseSync, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info('${table}')`).all() as ColumnInfo[];
}

// users -> Users, order_items -> OrderItems. Drives both the generated schema
// prefix and the scaffolded function name, so the two always line up.
export function toPascalCase(table: string): string {
  return table
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
