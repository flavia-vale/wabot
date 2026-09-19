ALTER TABLE "OfferQueueItem" ADD COLUMN "offerSnapshot" TEXT;
CREATE TABLE "OfferQueueDestination" (
  "queueId" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("queueId", "destinationId"),
  CONSTRAINT "OfferQueueDestination_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "OfferQueue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OfferQueueDestination_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OfferQueueDestination_destinationId_idx" ON "OfferQueueDestination"("destinationId");
