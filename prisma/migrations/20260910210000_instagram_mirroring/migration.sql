CREATE TABLE "InstagramMirrorDestination" (
  "sourceGroupId" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("sourceGroupId", "destinationId"),
  CONSTRAINT "InstagramMirrorDestination_sourceGroupId_fkey" FOREIGN KEY ("sourceGroupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InstagramMirrorDestination_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InstagramMirrorDestination_destinationId_idx" ON "InstagramMirrorDestination"("destinationId");
CREATE TABLE "InstagramStoryIngress" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "sourceMessageKey" TEXT NOT NULL,
  "offerSnapshotJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" DATETIME,
  "lastError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" DATETIME,
  CONSTRAINT "InstagramStoryIngress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InstagramStoryIngress_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InstagramStoryIngress_destinationId_sourceMessageKey_key" ON "InstagramStoryIngress"("destinationId", "sourceMessageKey");
CREATE INDEX "InstagramStoryIngress_status_nextAttemptAt_idx" ON "InstagramStoryIngress"("status", "nextAttemptAt");
CREATE INDEX "InstagramStoryIngress_userId_createdAt_idx" ON "InstagramStoryIngress"("userId", "createdAt");
