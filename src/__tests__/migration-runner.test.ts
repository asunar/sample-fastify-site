import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getCurrentVersion, latest } from "../db/migration-runner.ts";

// Fixtures live in a throwaway directory so the tests never mutate src/db/migrations.
function withMigrations(files: Record<string, string>, fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-runner-"));
  try {
    for (const [name, sql] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), sql);
    }
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("getCurrentVersion returns the user_version from the database", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA user_version = 5;");

  const version = getCurrentVersion(db);

  assert.strictEqual(version, 5, "Should return the user_version set in the database");
});

test("latest applies migrations in order and updates user_version", () => {
  const db = new DatabaseSync(":memory:");

  withMigrations({
    "100_test.sql": "CREATE TABLE test1 (id INTEGER);",
    "101_test.sql": "CREATE TABLE test2 (id INTEGER);",
  }, (dir) => {
    db.exec("PRAGMA user_version = 99;");
    latest(db, { migrationsDir: dir });

    assert.strictEqual(getCurrentVersion(db), 101, "Should update to the latest version");

    // Verify tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'test%'").all() as { name: string }[];
    const names = tables.map(t => t.name);
    assert.ok(names.includes("test1"), "test1 table should exist");
    assert.ok(names.includes("test2"), "test2 table should exist");
  });
});

test("latest skips already applied migrations", () => {
  const db = new DatabaseSync(":memory:");

  withMigrations({
    "999_test.sql": "CREATE TABLE test_skipped (id INTEGER);",
  }, (dir) => {
    db.exec("PRAGMA user_version = 999;"); // Version 999 already applied
    latest(db, { migrationsDir: dir });

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_skipped'").all();
    assert.strictEqual(tables.length, 0, "test_skipped table should NOT exist because migration was skipped");
  });
});

test("latest defaults to the project's own migrations directory", () => {
  const db = new DatabaseSync(":memory:");

  // Asserts against the directory rather than any particular table, so adding or
  // removing migrations does not break this test. user_version lands on the
  // highest-numbered file, and 0 is correct when there are none yet.
  const expected = fs.readdirSync(path.join(import.meta.dirname, "..", "db", "migrations"))
    .filter((file) => file.endsWith(".sql"))
    .reduce((max, file) => Math.max(max, parseInt(file.split("_")[0])), 0);

  assert.doesNotThrow(() => latest(db));
  assert.strictEqual(getCurrentVersion(db), expected);
});
