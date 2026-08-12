-- CreateTable
CREATE TABLE "MarketingLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "unsubscribedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingLead_email_source_key" ON "MarketingLead"("email", "source");

-- CreateIndex
CREATE INDEX "MarketingLead_createdAt_idx" ON "MarketingLead"("createdAt");

-- CreateIndex
CREATE INDEX "MarketingLead_source_createdAt_idx" ON "MarketingLead"("source", "createdAt");
