ALTER TABLE "AffiliateSettings" ADD COLUMN "commissionRecurringPercent" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "AffiliateSettings" ADD COLUMN "recurringCommissionEnabled" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AffiliateProfile" ADD COLUMN "commissionPercentOverride" INTEGER;
ALTER TABLE "AffiliateProfile" ADD COLUMN "commissionRecurringPercentOverride" INTEGER;
ALTER TABLE "AffiliateCommission" ADD COLUMN "commissionType" TEXT NOT NULL DEFAULT 'initial';
ALTER TABLE "AffiliateCommission" ADD COLUMN "commissionRatePct" INTEGER NOT NULL DEFAULT 30;
