-- Enforce one account per email address.
--
-- Existing databases may already hold duplicates (nothing prevented them until
-- now), and CREATE UNIQUE INDEX fails outright if any remain — which would roll
-- the whole migration back. So collapse duplicates first, keeping the earliest
-- row for each address.
--
-- The IS NOT NULL guards matter: GROUP BY treats all NULLs as one group, so
-- without them every NULL-email row but the first would be deleted as a
-- "duplicate" even though a unique index permits multiple NULLs.
DELETE FROM users
WHERE email IS NOT NULL
  AND id NOT IN (SELECT MIN(id) FROM users WHERE email IS NOT NULL GROUP BY email);

CREATE UNIQUE INDEX users_email_unique ON users(email);
