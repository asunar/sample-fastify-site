import fs from "node:fs";
import path from "node:path";
import { type DatabaseSync } from "node:sqlite";

// Resolved from this module, not process.cwd(), so the runner works from any
// working directory.
const defaultMigrationsDir = path.join(import.meta.dirname, "migrations");

// Structurally satisfied by both `console` and Fastify's `fastify.log`, so the
// runner writes to the app's logger when it has one and stdout when it doesn't.
export type MigrationLogger = {
  info(message: string): void;
  error(message: string): void;
};

export type MigrationOptions = {
  migrationsDir?: string;
  logger?: MigrationLogger;
};

export function getCurrentVersion(db: DatabaseSync): number {
  const result = db.prepare("PRAGMA user_version;").get() as { user_version: number };
  return result.user_version;
}

export function latest(db: DatabaseSync, options: MigrationOptions = {}) {
  const { migrationsDir = defaultMigrationsDir, logger = console } = options;

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
        logger.info(`Applied migration: ${file} (version ${version})`);
      } catch (err) {
        db.exec("ROLLBACK;");
        logger.error(`Error applying migration ${file}: ${(err as Error).message}`);
        throw err;
      }
    }
  }
}
