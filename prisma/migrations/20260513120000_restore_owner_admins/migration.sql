-- Restore owner-level admin access for the canonical Wabot admin accounts.
-- This is an idempotent data migration: it only affects users with these emails
-- in the current environment database and does not copy data between environments.

INSERT INTO "AdminUser" ("id", "userId", "role", "status", "createdAt", "updatedAt")
SELECT
  'admin_restore_' || lower(hex(randomblob(8))),
  u."id",
  'owner',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE lower(trim(u."email")) IN (
  'flavia.vale@usp.br',
  'flaviaroberta.1496@gmail.com',
  'tacianeaas02@gmail.com'
)
AND NOT EXISTS (
  SELECT 1
  FROM "AdminUser" au
  WHERE au."userId" = u."id"
);

UPDATE "AdminUser"
SET
  "role" = 'owner',
  "status" = 'active',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "userId" IN (
  SELECT u."id"
  FROM "User" u
  WHERE lower(trim(u."email")) IN (
    'flavia.vale@usp.br',
    'flaviaroberta.1496@gmail.com',
    'tacianeaas02@gmail.com'
  )
);
