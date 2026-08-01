import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function connectToDb(dbFile?: string) {
  const sqliteFile = dbFile || path.join(import.meta.dirname, "data.db");
  const db = new DatabaseSync(sqliteFile);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  return db;
}
