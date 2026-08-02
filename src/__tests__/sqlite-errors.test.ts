import test, { describe } from "node:test";
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from "../routes/sqlite-errors.ts";

// The errors are provoked from a real database rather than hand-built, so the
// predicates stay honest if node:sqlite ever changes how it reports them.
function capture(fn: (db: DatabaseSync) => void): unknown {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE parent(id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE) STRICT;
    CREATE TABLE child(id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent(id)) STRICT;
  `);

  try {
    fn(db);
    throw new Error("expected the statement to fail");
  } catch (err) {
    return err;
  } finally {
    db.close();
  }
}

describe("sqlite error predicates", () => {
  test("recognises a foreign key violation", () => {
    const err = capture((db) => {
      db.prepare("INSERT INTO child (parent_id) VALUES (?)").run(999);
    });

    assert.strictEqual(isForeignKeyViolation(err), true);
    assert.strictEqual(isUniqueViolation(err), false);
  });

  test("recognises a unique violation", () => {
    const err = capture((db) => {
      db.prepare("INSERT INTO parent (code) VALUES (?)").run("dup");
      db.prepare("INSERT INTO parent (code) VALUES (?)").run("dup");
    });

    assert.strictEqual(isUniqueViolation(err), true);
    assert.strictEqual(isForeignKeyViolation(err), false);
  });

  // Guards the central 422 branch from swallowing unrelated failures.
  test("ignores other SQLite errors and non-errors", () => {
    const err = capture((db) => {
      db.prepare("INSERT INTO nope (x) VALUES (1)").run();
    });

    assert.strictEqual(isForeignKeyViolation(err), false);
    assert.strictEqual(isForeignKeyViolation(new Error("boom")), false);
    assert.strictEqual(isForeignKeyViolation(null), false);
    assert.strictEqual(isForeignKeyViolation({ errcode: 787 }), true);
  });
});
