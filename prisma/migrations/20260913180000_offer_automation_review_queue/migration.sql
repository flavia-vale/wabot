ALTER TABLE "OfferAutomation" ADD COLUMN "publicationMode" TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE "OfferAutomation" ADD COLUMN "lastDiscoveryAt" DATETIME;
ALTER TABLE "OfferAutomation" ADD COLUMN "reviewTargetSize" INTEGER NOT NULL DEFAULT 10;

CREATE TABLE "OfferAutomationReviewItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "automationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'awaiting_review',
  "productKey" TEXT NOT NULL,
  "itemId" TEXT,
  "priceCents" INTEGER NOT NULL,
  "productUrl" TEXT NOT NULL,
  "imageUrl" TEXT,
  "imageRefererUrl" TEXT,
  "productSnapshot" TEXT NOT NULL,
  "renderedText" TEXT NOT NULL,
  "targetSnapshot" TEXT NOT NULL,
  "deliverySnapshot" TEXT NOT NULL DEFAULT '{}',
  "position" INTEGER NOT NULL,
  "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" DATETIME,
  "reviewedAction" TEXT,
  "sentAt" DATETIME,
  "claimedAt" DATETIME,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" DATETIME,
  "lastError" TEXT,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OfferAutomationReviewItem_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "OfferAutomation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OfferAutomationReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OfferAutomationReviewItem_automationId_status_position_idx" ON "OfferAutomationReviewItem"("automationId", "status", "position");
CREATE INDEX "OfferAutomationReviewItem_userId_status_createdAt_idx" ON "OfferAutomationReviewItem"("userId", "status", "createdAt");
CREATE INDEX "OfferAutomationReviewItem_automationId_productKey_priceCents_idx" ON "OfferAutomationReviewItem"("automationId", "productKey", "priceCents");
