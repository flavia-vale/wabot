-- Add required name and enforce unique contactPhone.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL DEFAULT 'Usuário',
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "contactPhone" TEXT,
  "contactPhoneVerifiedAt" DATETIME,
  "contactPhoneOptInAt" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'active',
  "plan" TEXT NOT NULL DEFAULT 'trial',
  "accessExpiresAt" DATETIME,
  "sendCount" INTEGER NOT NULL DEFAULT 0,
  "referralCode" TEXT,
  "referredBy" TEXT,
  "lastLoginAt" DATETIME,
  "lastActivityAt" DATETIME,
  "lastSupportContactAt" DATETIME,
  "supportStatus" TEXT NOT NULL DEFAULT 'new',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_User" (
  "id","name","email","passwordHash","contactPhone","contactPhoneVerifiedAt","contactPhoneOptInAt","status","plan",
  "accessExpiresAt","sendCount","referralCode","referredBy","lastLoginAt","lastActivityAt","lastSupportContactAt","supportStatus","createdAt"
)
SELECT
  "id", COALESCE(NULLIF(TRIM(SUBSTR("email", 1, INSTR("email", '@') - 1)), ''), 'Usuário'), "email","passwordHash","contactPhone","contactPhoneVerifiedAt","contactPhoneOptInAt","status","plan",
  "accessExpiresAt","sendCount","referralCode","referredBy","lastLoginAt","lastActivityAt","lastSupportContactAt","supportStatus","createdAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE UNIQUE INDEX "User_contactPhone_key" ON "User"("contactPhone");
CREATE INDEX "User_status_plan_accessExpiresAt_idx" ON "User"("status", "plan", "accessExpiresAt");
CREATE INDEX "User_lastActivityAt_idx" ON "User"("lastActivityAt");
CREATE INDEX "User_supportStatus_idx" ON "User"("supportStatus");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
