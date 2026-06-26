-- R3: Ledger append-only de movimentação financeira de comissão.
-- Toda transição de status grava uma linha aqui; nunca sofre UPDATE/DELETE em runtime.
CREATE TABLE "AffiliateCommissionLedger" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "commissionId" TEXT NOT NULL,
  "affiliateId" TEXT,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "actor" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateCommissionLedger_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "AffiliateCommission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AffiliateCommissionLedger_commissionId_createdAt_idx" ON "AffiliateCommissionLedger"("commissionId", "createdAt");
CREATE INDEX "AffiliateCommissionLedger_affiliateId_createdAt_idx" ON "AffiliateCommissionLedger"("affiliateId", "createdAt");
