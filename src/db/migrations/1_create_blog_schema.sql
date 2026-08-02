-- Blog schema: authors write posts, posts collect comments, posts carry tags.
--
-- Two conventions here exist because of how the generation pipeline reads a table:
--
--   * Columns the database fills are NOT NULL DEFAULT. generateSchemas.ts treats a
--     defaulted column as optional in the insert schema and required in the row
--     schema, so the strictness costs the client nothing.
--   * post_tags carries a surrogate id even though (post_id, tag_id) is the real
--     key. scaffoldRoutes.ts only generates routes for tables with exactly one
--     primary key column; the UNIQUE constraint keeps the invariant and routes
--     duplicate tagging through the existing 409 mapping.
--
-- Timestamps use strftime rather than datetime('now'), which would emit a space
-- instead of a T and fail any later z.iso.datetime() refinement.

CREATE TABLE authors(
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  bio        TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE TABLE posts(
  id         INTEGER PRIMARY KEY,
  author_id  INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  body       TEXT NOT NULL,
  published  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE TABLE comments(
  id           INTEGER PRIMARY KEY,
  post_id      INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  author_email TEXT,
  body         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE TABLE tags(
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
) STRICT;

-- ON DELETE CASCADE throughout: foreign keys are enforced (PRAGMA foreign_keys = ON
-- in src/db/db.ts) and the scaffolded DELETE handler only maps unique violations,
-- so an unhandled FK violation would surface to the caller as a 500.
CREATE TABLE post_tags(
  id      INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(post_id, tag_id)
) STRICT;

CREATE INDEX posts_author_id ON posts(author_id);
CREATE INDEX comments_post_id ON comments(post_id);
CREATE INDEX post_tags_tag_id ON post_tags(tag_id);
