// Shared between hand-written routes and scaffolded ones, so generated route
// files stay thin and every table maps constraint failures the same way.

// SQLITE_CONSTRAINT_UNIQUE. node:sqlite exposes the raw SQLite result code as
// `errcode`, which is stabler to match on than the error message text.
export const SQLITE_CONSTRAINT_UNIQUE = 2067;

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null
    && (err as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE;
}
