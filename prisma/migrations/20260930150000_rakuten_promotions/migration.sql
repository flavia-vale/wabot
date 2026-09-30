-- Integração Rakuten Advertising (docs/rca/afiliados-rakuten.md). Só
-- acréscimos: três tabelas novas e duas colunas com default em
-- OfferAutomation — automação existente continua com a origem que tinha.

-- AlterTable
ALTER TABLE "OfferAutomation" ADD COLUMN "rakutenAccountId" TEXT;
ALTER TABLE "OfferAutomation" ADD COLUMN "rakutenAdvertiserIds" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "RakutenAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "clientIdEncrypted" TEXT NOT NULL,
    "clientIdLast4" TEXT NOT NULL,
    "clientSecretEncrypted" TEXT NOT NULL,
    "clientSecretLast4" TEXT NOT NULL,
    "credentialFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusDetail" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "nextSyncAt" DATETIME,
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastTestAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RakutenAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RakutenPromotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "advertiserName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "couponCode" TEXT,
    "promotionTypes" TEXT NOT NULL DEFAULT '',
    "categories" TEXT NOT NULL DEFAULT '',
    "clickUrl" TEXT NOT NULL,
    "networkId" TEXT,
    "logoUrl" TEXT,
    "storeUrl" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSeenRunId" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RakutenPromotion_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "RakutenAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RakutenSyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "expired" INTEGER NOT NULL DEFAULT 0,
    "errorsJson" TEXT NOT NULL DEFAULT '[]',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "RakutenSyncRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "RakutenAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RakutenAccount_userId_sid_key" ON "RakutenAccount"("userId", "sid");
CREATE INDEX "RakutenAccount_userId_idx" ON "RakutenAccount"("userId");
CREATE INDEX "RakutenAccount_syncEnabled_status_nextSyncAt_idx" ON "RakutenAccount"("syncEnabled", "status", "nextSyncAt");
CREATE UNIQUE INDEX "RakutenPromotion_accountId_promotionId_key" ON "RakutenPromotion"("accountId", "promotionId");
CREATE INDEX "RakutenPromotion_userId_status_endDate_idx" ON "RakutenPromotion"("userId", "status", "endDate");
CREATE INDEX "RakutenPromotion_accountId_status_idx" ON "RakutenPromotion"("accountId", "status");
CREATE INDEX "RakutenSyncRun_accountId_startedAt_idx" ON "RakutenSyncRun"("accountId", "startedAt");
