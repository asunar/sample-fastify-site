// Writes openapi.json from the live route table. Boots against :memory: so
// generating docs never touches src/db/data.db, and migrates that throwaway
// database so the routes register against a real schema.

import fs from "node:fs";
import path from "node:path";
import { buildApp } from "../src/app.ts";

const app = buildApp(":memory:", { migrate: true, logger: false });
await app.ready();

const spec = app.swagger();

const outFile = path.join(import.meta.dirname, "..", "openapi.json");
fs.writeFileSync(outFile, `${JSON.stringify(spec, null, 2)}\n`);

await app.close();

const pathCount = Object.keys(spec.paths ?? {}).length;
console.log(`Generated openapi.json (${pathCount} paths)`);
