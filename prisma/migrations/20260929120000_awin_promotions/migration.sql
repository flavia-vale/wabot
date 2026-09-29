-- Integração Awin (docs/rca/afiliados-awin.md). Só acréscimos: três tabelas
-- novas e três colunas com default em OfferAutomation — automação existente
-- continua "shopee" e nada muda para ela.

-- AlterTable
ALTER TABLE "OfferAutomation" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'shopee';
ALTER TABLE "OfferAutomation" ADD COLUMN "awinAccountId" TEXT;
ALTER TABLE "OfferAutomation" ADD COLUMN "awinAdvertiserIds" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "AwinAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "tokenLast4" TEXT NOT NULL,
    "tokenFingerprint" TEXT NOT NULL,
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
    CONSTRAINT "AwinAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AwinPromotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "advertiserName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "terms" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "urlTracking" TEXT NOT NULL,
    "regionsJson" TEXT NOT NULL DEFAULT '{}',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "dateAdded" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSeenRunId" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AwinPromotion_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AwinAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AwinSyncRun" (
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
    CONSTRAINT "AwinSyncRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AwinAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AwinAccount_userId_publisherId_key" ON "AwinAccount"("userId", "publisherId");
CREATE INDEX "AwinAccount_userId_idx" ON "AwinAccount"("userId");
CREATE INDEX "AwinAccount_syncEnabled_status_nextSyncAt_idx" ON "AwinAccount"("syncEnabled", "status", "nextSyncAt");
CREATE UNIQUE INDEX "AwinPromotion_accountId_promotionId_key" ON "AwinPromotion"("accountId", "promotionId");
CREATE INDEX "AwinPromotion_userId_status_endDate_idx" ON "AwinPromotion"("userId", "status", "endDate");
CREATE INDEX "AwinPromotion_accountId_status_idx" ON "AwinPromotion"("accountId", "status");
CREATE INDEX "AwinSyncRun_accountId_startedAt_idx" ON "AwinSyncRun"("accountId", "startedAt");
