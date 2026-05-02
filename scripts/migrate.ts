import { connectToDb } from "../db/db.ts";
import { latest } from "../db/migration-runner.ts";

const db = connectToDb();
latest(db);
console.log("Migrations complete.");
