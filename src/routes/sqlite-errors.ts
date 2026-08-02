// Shared between hand-written routes and scaffolded ones, so generated route
// files stay thin and every table maps constraint failures the same way.

// node:sqlite exposes the raw SQLite result code as `errcode`, which is stabler
// to match on than the error message text.
export const SQLITE_CONSTRAINT_UNIQUE = 2067;
export const SQLITE_CONSTRAINT_FOREIGNKEY = 787;

function hasErrcode(err: unknown, code: number): boolean {
  return typeof err === "object" && err !== null
    && (err as { errcode?: number }).errcode === code;
}

export function isUniqueViolation(err: unknown): boolean {
  return hasErrcode(err, SQLITE_CONSTRAINT_UNIQUE);
}

// Raised when a payload references a row that does not exist. SQLite reports only
// "FOREIGN KEY constraint failed" — it never says which reference failed.
export function isForeignKeyViolation(err: unknown): boolean {
  return hasErrcode(err, SQLITE_CONSTRAINT_FOREIGNKEY);
}
