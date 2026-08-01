import { connectToDb } from "../src/db/db.ts";
import { latest } from "../src/db/migration-runner.ts";

const db = connectToDb();
latest(db);
console.log("Migrations complete.");
