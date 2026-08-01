import test from "node:test";
import assert from "node:assert";
import { connectToDb } from "../db/db.ts";

test("connectToDb creates a valid database connection", () => {
  const db = connectToDb(":memory:");
  assert.ok(db, "Should return a database instance");

  db.close();
});
