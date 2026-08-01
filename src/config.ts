import path from "node:path";

export type ServerConfig = {
  port: number;
  host: string;
  shutdownTimeoutMs: number;
  databaseFile: string;
};

export const DEFAULTS = {
  port: 3000,
  // Not loopback: a container listening only on 127.0.0.1 is unreachable from
  // outside itself.
  host: "0.0.0.0",
  shutdownTimeoutMs: 10_000,
  // Resolved from this module rather than process.cwd(), so the default survives
  // being started from any working directory.
  databaseFile: path.join(import.meta.dirname, "db", "data.db"),
} as const;

// Fail fast rather than falling back: a typo'd PORT that silently becomes 3000
// is far harder to diagnose than one that refuses to boot.
function parseInteger(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === "") return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer, got ${JSON.stringify(raw)}`);
  }

  return value;
}

export function resolveServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: parseInteger(env.PORT, DEFAULTS.port, "PORT"),
    host: env.HOST?.trim() || DEFAULTS.host,
    shutdownTimeoutMs: parseInteger(
      env.SHUTDOWN_TIMEOUT_MS,
      DEFAULTS.shutdownTimeoutMs,
      "SHUTDOWN_TIMEOUT_MS",
    ),
    databaseFile: env.DATABASE_FILE?.trim() || DEFAULTS.databaseFile,
  };
}
