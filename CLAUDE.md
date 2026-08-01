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

All application code lives under `src/`. Only project scaffolding (config, CI, hooks, `scripts/`, `integration-tests/`) sits at the repository root.

Paths are resolved with `import.meta.dirname`, never `process.cwd()`, so the app runs correctly from any working directory.

### Entry Points
- `src/server.ts` — process entry point; resolves the database path and calls `listen()`
- `src/app.ts` — exports `buildApp(dbFile, { migrate, logger })`, which wires the zod compilers, connects the database and registers routes. Tests build the app with `:memory:`.

### Routes
- `src/routes/` — each route file exports a default function returning a Fastify plugin, registered via `fastify.register()` in `src/app.ts`.

### Database
- `src/db/db.ts` — `connectToDb(dbFile?)` returns a `DatabaseSync` instance (Node's native `node:sqlite`) with WAL mode, foreign keys, and a 5s busy timeout. Defaults to `src/db/data.db`.
- `src/db/migration-runner.ts` — custom runner that reads numbered SQL files from `src/db/migrations/`, tracks applied migrations via SQLite's `user_version` PRAGMA, and applies them in numeric order within a transaction
- `src/db/migrations/` — SQL migration files named `<number>_<description>.sql`
- `src/db/refinements.ts` — hand-written zod refinements layered on the generated base schemas
- `src/generated/schemas.ts` — AUTO-GENERATED from the live database schema by `npm run generate:schemas`; do not edit by hand
- `src/db/data.db` — SQLite database file (do not commit)

### Tests
Uses Node.js native `node:test`. Test files live in `src/__tests__/`. Database tests use in-memory SQLite (`:memory:`) to avoid touching `data.db`.

### Validation

The objective is to validate all incoming http requests and return relevant errors when the request sends invalid body, querystring and/or headers.

Ideally, would like to use zod for this. Zod should check if the payload matches the schema.


### Workflow
Follow the red/green/refactor (/simplify) TDD method.
After making changes, make sure that there are no build errors/(deprecation) warnings, lint/formatting issues and all tests