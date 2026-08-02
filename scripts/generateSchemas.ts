// It is run after migrations are applied to generate the base schemas.
// Format refinements (e.g. z.email(), z.iso.date()) live in src/db/refinements/.

import fs from "node:fs";
import path from "node:path";
import { connectToDb } from "../src/db/db.ts";
import { getTables } from "./introspect.ts";
import { generateSchemaForTable } from "./schema-codegen.ts";

const db = connectToDb();
const tables = getTables(db);

const schemaBlocks = tables.map((table) => generateSchemaForTable(db, table));

const output = [
  "// AUTO-GENERATED — do not edit by hand.",
  "// Re-generate with: npm run generate:schemas",
  "",
  'import { z } from "zod";',
  "",
  ...schemaBlocks,
  "",
].join("\n");

const outDir = path.join(import.meta.dirname, "..", "src", "generated");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

fs.writeFileSync(path.join(outDir, "schemas.ts"), output);
console.log("Generated src/generated/schemas.ts");
