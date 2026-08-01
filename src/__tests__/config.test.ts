import test, { describe } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { DEFAULTS, resolveServerConfig } from "../config.ts";

// resolveServerConfig takes the environment as an argument precisely so tests
// never have to mutate process.env and race each other.
describe("resolveServerConfig — defaults", () => {
  test("falls back to every default when the environment is empty", () => {
    const config = resolveServerConfig({});

    assert.strictEqual(config.port, 3000);
    assert.strictEqual(config.host, "0.0.0.0");
    assert.strictEqual(config.shutdownTimeoutMs, 10_000);
    assert.strictEqual(config.databaseFile, DEFAULTS.databaseFile);
  });

  test("defaults the host to 0.0.0.0, not loopback", () => {
    // A container that binds 127.0.0.1 accepts no traffic from outside itself,
    // so this default is load-bearing rather than cosmetic.
    assert.strictEqual(resolveServerConfig({}).host, "0.0.0.0");
  });

  test("treats empty and whitespace-only values as unset", () => {
    const config = resolveServerConfig({ PORT: "", HOST: "   ", DATABASE_FILE: "" });

    assert.strictEqual(config.port, 3000);
    assert.strictEqual(config.host, "0.0.0.0");
    assert.strictEqual(config.databaseFile, DEFAULTS.databaseFile);
  });
});

describe("resolveServerConfig — overrides", () => {
  test("reads PORT, HOST and SHUTDOWN_TIMEOUT_MS from the environment", () => {
    const config = resolveServerConfig({
      PORT: "8080",
      HOST: "127.0.0.1",
      SHUTDOWN_TIMEOUT_MS: "250",
    });

    assert.strictEqual(config.port, 8080);
    assert.strictEqual(config.host, "127.0.0.1");
    assert.strictEqual(config.shutdownTimeoutMs, 250);
  });

  test("accepts port 0, which asks the OS to assign one", () => {
    assert.strictEqual(resolveServerConfig({ PORT: "0" }).port, 0);
  });

  test("DATABASE_FILE overrides the default database path", () => {
    const config = resolveServerConfig({ DATABASE_FILE: "/tmp/other.db" });

    assert.strictEqual(config.databaseFile, "/tmp/other.db");
  });
});

describe("resolveServerConfig — database path resolution", () => {
  test("defaults to src/db/data.db", () => {
    const { databaseFile } = resolveServerConfig({});

    assert.ok(
      databaseFile.endsWith(path.join("src", "db", "data.db")),
      `Expected the default to point at src/db/data.db, got ${databaseFile}`,
    );
  });

  test("resolves to an absolute path, independent of the working directory", () => {
    // The whole point of import.meta.dirname over process.cwd(): the resolved
    // path must not depend on where the process was started.
    const { databaseFile } = resolveServerConfig({});

    assert.ok(path.isAbsolute(databaseFile), `Expected an absolute path, got ${databaseFile}`);
  });
});

describe("resolveServerConfig — invalid values", () => {
  test("rejects a non-numeric PORT rather than silently defaulting", () => {
    assert.throws(
      () => resolveServerConfig({ PORT: "not-a-port" }),
      /PORT must be a non-negative integer/,
    );
  });

  test("rejects a fractional PORT", () => {
    assert.throws(() => resolveServerConfig({ PORT: "80.5" }), /PORT/);
  });

  test("rejects a negative PORT", () => {
    assert.throws(() => resolveServerConfig({ PORT: "-1" }), /PORT/);
  });

  test("rejects an invalid SHUTDOWN_TIMEOUT_MS", () => {
    assert.throws(
      () => resolveServerConfig({ SHUTDOWN_TIMEOUT_MS: "soon" }),
      /SHUTDOWN_TIMEOUT_MS must be a non-negative integer/,
    );
  });
});
