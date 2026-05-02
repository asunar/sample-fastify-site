import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getCurrentVersion, latest } from "../db/migration-runner.ts";

test("getCurrentVersion returns the user_version from the database", (t) => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA user_version = 5;");

  const version = getCurrentVersion(db);

  assert.strictEqual(version, 5, "Should return the user_version set in the database");
});

test("latest applies migrations in order and updates user_version", (t) => {
  const db = new DatabaseSync(":memory:");
  const migrationsDir = path.join(process.cwd(), "db", "migrations");

  // Create temporary migrations for testing
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const migration1 = path.join(migrationsDir, "100_test.sql");
  const migration2 = path.join(migrationsDir, "101_test.sql");

  fs.writeFileSync(migration1, "CREATE TABLE test1 (id INTEGER);");
  fs.writeFileSync(migration2, "CREATE TABLE test2 (id INTEGER);");

  try {
    db.exec("PRAGMA user_version = 99;");
    latest(db);

    assert.strictEqual(getCurrentVersion(db), 101, "Should update to the latest version");
    
    // Verify tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'test%'").all() as { name: string }[];
    const names = tables.map(t => t.name);
    assert.ok(names.includes("test1"), "test1 table should exist");
    assert.ok(names.includes("test2"), "test2 table should exist");

  } finally {
    // Clean up temporary migrations
    if (fs.existsSync(migration1)) fs.unlinkSync(migration1);
    if (fs.existsSync(migration2)) fs.unlinkSync(migration2);
  }
});

test("latest skips already applied migrations", (t) => {
    const db = new DatabaseSync(":memory:");
    const migrationsDir = path.join(process.cwd(), "db", "migrations");
  
    const migration1 = path.join(migrationsDir, "999_test.sql");
    fs.writeFileSync(migration1, "CREATE TABLE test_skipped (id INTEGER);");

    try {
      db.exec("PRAGMA user_version = 999;"); // Version 999 already applied
      latest(db);
  
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_skipped'").all();
      assert.strictEqual(tables.length, 0, "test_skipped table should NOT exist because migration was skipped");
  
    } finally {
      if (fs.existsSync(migration1)) fs.unlinkSync(migration1);
    }
  });
