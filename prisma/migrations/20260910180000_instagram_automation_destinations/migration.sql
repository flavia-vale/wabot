PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_OfferAutomation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "destGroupJid" TEXT,
  "destGroupName" TEXT,
  "keyword" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL DEFAULT 'automatico_classico',
  "intervalMinutes" INTEGER NOT NULL,
  "dailyRunTime" TEXT,
  "offersPerSend" INTEGER NOT NULL DEFAULT 1,
  "minDiscountPct" INTEGER NOT NULL DEFAULT 0,
  "sortType" INTEGER NOT NULL DEFAULT 2,
  "listType" INTEGER NOT NULL DEFAULT 1,
  "prioritizeAMS" BOOLEAN NOT NULL DEFAULT false,
  "isKeySeller" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSentAt" DATETIME,
  "sentItemIds" TEXT NOT NULL DEFAULT '[]',
  "page" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OfferAutomation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OfferAutomation" SELECT "id", "userId", "destGroupJid", "destGroupName", "keyword", "templateKey", "intervalMinutes", "dailyRunTime", "offersPerSend", "minDiscountPct", "sortType", "listType", "prioritizeAMS", "isKeySeller", "enabled", "lastSentAt", "sentItemIds", "page", "createdAt", "updatedAt" FROM "OfferAutomation";
DROP TABLE "OfferAutomation";
ALTER TABLE "new_OfferAutomation" RENAME TO "OfferAutomation";
CREATE INDEX "OfferAutomation_userId_enabled_idx" ON "OfferAutomation"("userId", "enabled");
CREATE INDEX "OfferAutomation_enabled_lastSentAt_idx" ON "OfferAutomation"("enabled", "lastSentAt");

CREATE TABLE "OfferAutomationDestination" (
  "automationId" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("automationId", "destinationId"),
  CONSTRAINT "OfferAutomationDestination_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "OfferAutomation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OfferAutomationDestination_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OfferAutomationDestination_destinationId_idx" ON "OfferAutomationDestination"("destinationId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
