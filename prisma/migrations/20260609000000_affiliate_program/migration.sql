CREATE TABLE "AffiliateSettings" (
  "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "cookieDurationHours" INTEGER NOT NULL DEFAULT 24,
  "commissionPercent" INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE "AffiliateProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "pixKey" TEXT NOT NULL,
  "pixKeyType" TEXT NOT NULL,
  "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" DATETIME,
  "rejectedAt" DATETIME,
  "adminNotes" TEXT,
  CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AffiliateCommission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "affiliateId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "saleAmountCents" INTEGER NOT NULL,
  "commissionAmountCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "cycleMonth" TEXT NOT NULL,
  "paidAt" DATETIME,
  "paidByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AffiliateCommission_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AffiliateCommission_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AffiliateCommission_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "User" ADD COLUMN "affiliateProfileId" TEXT;

CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");
CREATE UNIQUE INDEX "AffiliateProfile_code_key" ON "AffiliateProfile"("code");
CREATE UNIQUE INDEX "AffiliateCommission_paymentId_key" ON "AffiliateCommission"("paymentId");
CREATE UNIQUE INDEX "User_affiliateProfileId_key" ON "User"("affiliateProfileId");
CREATE INDEX "AffiliateCommission_affiliateId_cycleMonth_status_idx" ON "AffiliateCommission"("affiliateId", "cycleMonth", "status");
CREATE INDEX "AffiliateCommission_referredUserId_idx" ON "AffiliateCommission"("referredUserId");
CREATE INDEX "AffiliateProfile_status_idx" ON "AffiliateProfile"("status");
