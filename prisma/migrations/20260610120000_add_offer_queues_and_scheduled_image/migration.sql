ALTER TABLE "ScheduledMessage" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "ScheduledMessage" ADD COLUMN "imageRefererUrl" TEXT;

CREATE TABLE "OfferQueue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "intervalEnabled" BOOLEAN NOT NULL DEFAULT false,
  "intervalMinutes" INTEGER NOT NULL DEFAULT 30,
  "hourlyCapEnabled" BOOLEAN NOT NULL DEFAULT false,
  "hourlyCap" INTEGER NOT NULL DEFAULT 10,
  "dailyCapEnabled" BOOLEAN NOT NULL DEFAULT false,
  "dailyCap" INTEGER NOT NULL DEFAULT 50,
  "lastSentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OfferQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OfferQueueItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "queueId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "imageUrl" TEXT,
  "imageRefererUrl" TEXT,
  "targetJids" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "position" INTEGER NOT NULL,
  "sentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfferQueueItem_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "OfferQueue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OfferQueueItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OfferQueue_userId_enabled_idx" ON "OfferQueue"("userId", "enabled");
CREATE INDEX "OfferQueueItem_queueId_status_position_idx" ON "OfferQueueItem"("queueId", "status", "position");
CREATE INDEX "OfferQueueItem_userId_status_idx" ON "OfferQueueItem"("userId", "status");
