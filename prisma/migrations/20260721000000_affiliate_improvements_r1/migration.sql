-- Aditiva: tabela nova + colunas nullable/com default. Sem rebuild de tabela
-- (ADD COLUMN e CREATE TABLE no SQLite não recriam a tabela) → sem lock
-- exclusivo prolongado; convive com API/supervisor rodando (pegadinha #8 não
-- se aplica). DML de backfill idempotente. Ver specs/009-affiliate-improvements-r1.

CREATE TABLE IF NOT EXISTS "AffiliatePayoutRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "affiliateId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" DATETIME,
  "resolvedByUserId" TEXT,
  "rejectionReason" TEXT,
  "settledCommissionIds" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliatePayoutRequest_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AffiliatePayoutRequest_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AffiliatePayoutRequest_affiliateId_status_idx" ON "AffiliatePayoutRequest"("affiliateId", "status");
CREATE INDEX IF NOT EXISTS "AffiliatePayoutRequest_status_requestedAt_idx" ON "AffiliatePayoutRequest"("status", "requestedAt");

ALTER TABLE "AffiliateSettings" ADD COLUMN "minPayoutCents" INTEGER NOT NULL DEFAULT 5000;
ALTER TABLE "AffiliateSettings" ADD COLUMN "orphanTouchWindowDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "AffiliateSettings" ADD COLUMN "orphanTouchMode" TEXT NOT NULL DEFAULT 'both';
ALTER TABLE "AffiliateSettings" ADD COLUMN "payoutRequestsEnabled" BOOLEAN NOT NULL DEFAULT true;
