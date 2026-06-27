ALTER TABLE "AffiliateSettings" ADD COLUMN "commissionHoldDays" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "AffiliateCommission" ADD COLUMN "eligibleAt" DATETIME;
ALTER TABLE "AffiliateCommission" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "AffiliateCommission" ADD COLUMN "approvedByUserId" TEXT;
ALTER TABLE "AffiliateCommission" ADD COLUMN "heldAt" DATETIME;
ALTER TABLE "AffiliateCommission" ADD COLUMN "holdReason" TEXT;
ALTER TABLE "AffiliateCommission" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "AffiliateCommission" ADD COLUMN "reversalReason" TEXT;

CREATE INDEX "AffiliateCommission_status_eligibleAt_idx" ON "AffiliateCommission"("status", "eligibleAt");
