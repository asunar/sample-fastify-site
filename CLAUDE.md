# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test          # Run all tests with Node's native test runner
npm start         # Start the Fastify server
node --test       # Run tests directly
node --watch-path . src/server.ts  # Start server with file watching (no nodemon)
```

To run a single test file:
```bash
node --test src/__tests__/users.test.ts
```

## Architecture

This is a Fastify v5 REST API using **no build step** — TypeScript runs directly via Node.js 26. The project is `"type": "module"` (ESM).

**Key principle:** Favor native Node.js modules over npm packages (e.g., `node:test` over jest, `node:sqlite` over an ORM, `node:util` parseArgs over commander).

All application code lives under `src/`. Only project scaffolding (config, CI, hooks, `scripts/`) sits at the repository root.

Paths are resolved with `import.meta.dirname`, never `process.cwd()`, so the app runs correctly from any working directory.

### Entry Points
- `src/server.ts` — process entry point; resolves the database path, installs the shutdown handlers and calls `listen()`
- `src/app.ts` — exports `buildApp(dbFile, { migrate, logger })`, which wires the zod compilers, connects the database, sets the error handler and registers routes. Tests build the app with `:memory:`.

### Configuration
Read from the environment, all optional:

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `3000` | Listen port |
| `HOST` | `0.0.0.0` | Listen address (not loopback, so containers are reachable) |
| `LOG_LEVEL` | `info` in production, `debug` otherwise | Pino level |
| `NODE_ENV` | — | `test` disables logging; `production` hides 5xx error detail from clients |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Grace period before a hung shutdown is forced |

### Routes
- `src/routes/` — each route file exports a default function returning a Fastify plugin, registered via `fastify.register()` in `src/app.ts`.
- `GET /health` — liveness. Deliberately touches no dependencies, so a sick database cannot cause an orchestrator to restart a healthy process.
- `GET /health/ready` — readiness. Checks the database and returns 503 when it is unusable.

### Error handling
`src/app.ts` sets a single error handler. Errors below 500 pass through with their real message — validation errors name the offending field and are meant for the caller. At 500 and above the message is replaced in production with a request-id reference, while the real error goes to the log. Route handlers return 404/409 via `reply.code().send()`, which does **not** pass through the error handler.

### Lifecycle
`buildApp` registers an `onClose` hook that closes the database, so `app.close()` releases it in both tests and shutdown.

`src/server.ts` uses `close-with-grace` — one of the few npm dependencies here, taken deliberately because it covers more than signal handling. It drains on `SIGINT`/`SIGTERM` **and** on `uncaughtException`/`unhandledRejection`, so a crash releases the database through the same path as a clean shutdown. A second signal during shutdown aborts immediately; a shutdown exceeding `SHUTDOWN_TIMEOUT_MS` is forced.

### Database
- `src/db/db.ts` — `connectToDb(dbFile?)` returns a `DatabaseSync` instance (Node's native `node:sqlite`) with WAL mode, foreign keys, and a 5s busy timeout. Defaults to `src/db/data.db`.
- `src/db/migration-runner.ts` — `latest(db, { migrationsDir, logger })`; reads numbered SQL files from `src/db/migrations/`, tracks applied migrations via SQLite's `user_version` PRAGMA, and applies them in numeric order within a transaction. Both options exist for injection: tests pass a tmpdir so they never write into the real migrations folder, and `buildApp` passes `fastify.log` so migrations report through the app logger.
- `src/db/migrations/` — SQL migration files named `<number>_<description>.sql`
- `src/db/refinements.ts` — hand-written zod refinements layered on the generated base schemas
- `src/generated/schemas.ts` — AUTO-GENERATED from the live database schema by `npm run generate:schemas`; do not edit by hand
- `src/db/data.db` — SQLite database file (do not commit)

### Tests
Uses Node.js native `node:test`. Test files live in `src/__tests__/`. Database tests use in-memory SQLite (`:memory:`) to avoid touching `data.db`.

`src/__tests__/server.test.ts` spawns the real `src/server.ts` as a child process to cover boot config, port/host binding and shutdown signals — behaviour that cannot be reached with `inject()`.

There is no shell-based integration suite; `npm test` is the whole story. **Known gap:** nothing verifies that migrations have actually been applied to a deployed database, because tests always migrate a clean one. A schema-version check at boot would close this properly.

### Validation

The objective is to validate all incoming http requests and return relevant errors when the request sends invalid body, querystring and/or headers.

Ideally, would like to use zod for this. Zod should check if the payload matches the schema.


### Workflow
Follow the red/green/refactor (/simplify) TDD method.
After making changes, make sure that there are no build errors/(deprecation) warnings, lint/formatting issues and all tests