ALTER TABLE "AffiliateSettings" ADD COLUMN "attributionWindowDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "AffiliateSettings" ADD COLUMN "attributionModel" TEXT NOT NULL DEFAULT 'last_non_direct';

ALTER TABLE "Payment" ADD COLUMN "affiliateProfileIdAtCheckout" TEXT;
ALTER TABLE "Payment" ADD COLUMN "affiliateClickId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "attributionModel" TEXT;
ALTER TABLE "Payment" ADD COLUMN "attributionLockedAt" DATETIME;

CREATE INDEX "Payment_affiliateProfileIdAtCheckout_createdAt_idx" ON "Payment"("affiliateProfileIdAtCheckout", "createdAt");

CREATE TABLE "AffiliateAttributionTouch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "affiliateId" TEXT NOT NULL,
  "affiliateCode" TEXT,
  "clickId" TEXT,
  "visitorId" TEXT,
  "userId" TEXT,
  "source" TEXT,
  "medium" TEXT,
  "campaign" TEXT,
  "landingPage" TEXT,
  "ipHash" TEXT,
  "uaHash" TEXT,
  "touchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateAttributionTouch_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AffiliateAttributionTouch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AffiliateAttributionTouch_affiliateId_touchedAt_idx" ON "AffiliateAttributionTouch"("affiliateId", "touchedAt");
CREATE INDEX "AffiliateAttributionTouch_userId_touchedAt_idx" ON "AffiliateAttributionTouch"("userId", "touchedAt");
CREATE INDEX "AffiliateAttributionTouch_visitorId_touchedAt_idx" ON "AffiliateAttributionTouch"("visitorId", "touchedAt");
CREATE INDEX "AffiliateAttributionTouch_clickId_idx" ON "AffiliateAttributionTouch"("clickId");
