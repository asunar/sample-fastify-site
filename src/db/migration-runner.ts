import fs from "node:fs";
import path from "node:path";
import { type DatabaseSync } from "node:sqlite";

// Resolved from this module, not process.cwd(), so the runner works from any
// working directory.
const defaultMigrationsDir = path.join(import.meta.dirname, "migrations");

export function getCurrentVersion(db: DatabaseSync): number {
  const result = db.prepare("PRAGMA user_version;").get() as { user_version: number };
  return result.user_version;
}

export function latest(db: DatabaseSync, migrationsDir: string = defaultMigrationsDir) {
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith(".sql"))
    .sort((a, b) => {
      const vA = parseInt(a.split("_")[0]);
      const vB = parseInt(b.split("_")[0]);
      return vA - vB;
    });

  const currentVersion = getCurrentVersion(db);

  for (const file of migrationFiles) {
    const version = parseInt(file.split("_")[0]);
    if (version > currentVersion) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      
      db.exec("BEGIN TRANSACTION;");
      try {
        db.exec(sql);
        db.exec(`PRAGMA user_version = ${version};`);
        db.exec("COMMIT;");
        console.log(`Applied migration: ${file} (version ${version})`);
      } catch (err) {
        db.exec("ROLLBACK;");
        console.error(`Error applying migration ${file}:`, err);
        throw err;
      }
    }
  }
}
