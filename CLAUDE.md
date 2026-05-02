# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test          # Run all tests with Node's native test runner
npm start         # Start the Fastify server
node --test       # Run tests directly
node --watch-path . server.ts  # Start server with file watching (no nodemon)
```

To run a single test file:
```bash
node --test __tests__/greeting.test.ts
```

## Architecture

This is a Fastify v5 REST API using **no build step** — TypeScript runs directly via Node.js 24. The project is `"type": "module"` (ESM).

**Key principle:** Favor native Node.js modules over npm packages (e.g., `node:test` over jest, `node:sqlite` over an ORM, `node:util` parseArgs over commander).

### Entry Points
- `index.ts` — application entry point
- `server.ts` — Fastify server setup and route registration

### Routes
Routes are registered as Fastify plugins and registered via `fastify.register()` in `server.ts`. Each route file exports a default async function `(fastify, options) => void`.

### Database
- `db/db.ts` — exports a `DatabaseSync` instance (Node's native `node:sqlite`) with WAL mode, foreign keys, and a 5s busy timeout
- `db/migrationRunner.ts` — custom runner that reads numbered SQL files from `db/migrations/`, tracks applied migrations via SQLite's `user_version` PRAGMA, and applies them in numeric order within a transaction
- `db/migrations/` — SQL migration files named `<number>_<description>.sql`
- `db/data.db` — SQLite database file (do not commit)

### Tests
Uses Node.js native `node:test`. Test files live in `__tests__/`. Database tests use in-memory SQLite (`:memory:`) to avoid touching `data.db`.

### Validation

The objective is to validate all incoming http requests and return relevant errors when the request sends invalid body, querystring and/or headers.

Ideally, would like to use zod for this. Zod should check if the payload matches the schema.


### Workflow
Follow the red/green/refactor (/simplify) TDD method.
After making changes, make sure that there are no build errors/(deprecation) warnings, lint/formatting issues and all tests