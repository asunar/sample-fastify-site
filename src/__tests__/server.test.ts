import test, { after, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const SERVER = path.join(import.meta.dirname, "..", "server.ts");
const BOOT_TIMEOUT_MS = 15_000;
const EXIT_TIMEOUT_MS = 10_000;
// Second line of defence: even if a helper forgets to bound its own wait, the
// runner kills the test rather than hanging the suite.
const TEST_TIMEOUT = { timeout: 30_000 };

// Ask the OS for a port, then release it. Hard-coding 3000 would collide with a
// dev server and make these tests fail for the wrong reason.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Bounded on purpose. Waiting forever turns "the server no longer exits" from a
// fast test failure into a hung CI job.
function exited(
  child: ChildProcess,
  timeoutMs = EXIT_TIMEOUT_MS,
): Promise<{ code: number | null; signal: string | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Process did not exit within ${timeoutMs}ms`));
    }, timeoutMs);

    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

async function waitForHealth(port: number, host = "127.0.0.1") {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${host}:${port}/health`);
      if (response.ok) return await response.json();
    } catch {
      // Not listening yet.
    }
    await sleep(100);
  }

  throw new Error(`Server did not become healthy on ${host}:${port}`);
}

type Started = { child: ChildProcess; port: number; dbFile: string; stderr: () => string };

const started: ChildProcess[] = [];
const tempDirs: string[] = [];

async function startServer(env: Record<string, string> = {}): Promise<Started> {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "server-test-"));
  tempDirs.push(dir);
  const dbFile = path.join(dir, "data.db");

  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      HOST: "127.0.0.1",
      DATABASE_FILE: dbFile,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  started.push(child);

  let stderr = "";
  child.stderr?.on("data", (chunk) => { stderr += String(chunk); });

  return { child, port, dbFile, stderr: () => stderr };
}

after(async () => {
  for (const child of started) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("server boot", () => {
  test("binds the PORT and HOST given in the environment", TEST_TIMEOUT, async () => {
    const { child, port } = await startServer();

    const body = await waitForHealth(port);
    assert.strictEqual(body.status, "ok");

    // Nothing else should have taken the port we asked for.
    assert.strictEqual(child.exitCode, null, "Server should still be running");

    child.kill("SIGTERM");
    await exited(child);
  });

  test("opens the database file named by DATABASE_FILE", TEST_TIMEOUT, async () => {
    const { child, port, dbFile } = await startServer();
    await waitForHealth(port);

    assert.ok(fs.existsSync(dbFile), `Expected the server to create ${dbFile}`);

    // /health/ready proves the handle is genuinely usable, not just that a file
    // was touched on disk.
    const ready = await fetch(`http://127.0.0.1:${port}/health/ready`);
    assert.strictEqual(ready.status, 200);
    assert.strictEqual((await ready.json()).checks.database, true);

    child.kill("SIGTERM");
    await exited(child);
  });

  test("refuses to boot on an invalid PORT instead of defaulting", TEST_TIMEOUT, async () => {
    const { child, stderr } = await startServer({ PORT: "not-a-port" });

    const { code } = await exited(child);

    assert.notStrictEqual(code, 0, "A bad PORT must not boot successfully");
    assert.match(stderr(), /PORT must be a non-negative integer/);
  });
});

describe("server shutdown wiring", () => {
  test("SIGTERM shuts down cleanly and releases the port", TEST_TIMEOUT, async () => {
    const { child, port } = await startServer();
    await waitForHealth(port);

    child.kill("SIGTERM");
    const { code, signal } = await exited(child);

    assert.strictEqual(code, 0, `Expected a clean exit, got code=${code} signal=${signal}`);

    // The port must actually be free afterwards — a lingering listener is the
    // failure mode that breaks the next deploy.
    const rebound = net.createServer();
    await new Promise<void>((resolve, reject) => {
      rebound.once("error", reject);
      rebound.listen(port, "127.0.0.1", resolve);
    });
    await new Promise<void>((resolve) => rebound.close(() => resolve()));
  });

  test("SIGINT shuts down cleanly too", TEST_TIMEOUT, async () => {
    const { child, port } = await startServer();
    await waitForHealth(port);

    child.kill("SIGINT");
    const { code } = await exited(child);

    assert.strictEqual(code, 0, "SIGINT should drain like SIGTERM");
  });

  test("stops serving requests once shut down", TEST_TIMEOUT, async () => {
    const { child, port } = await startServer();
    await waitForHealth(port);

    child.kill("SIGTERM");
    await exited(child);

    await assert.rejects(
      () => fetch(`http://127.0.0.1:${port}/health`),
      "Requests must fail once the server has shut down",
    );
  });
});
