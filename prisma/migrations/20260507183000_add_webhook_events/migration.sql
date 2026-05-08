-- Billing foundation v1: persist webhook events with idempotency keys.
CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT,
  "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "requestId" TEXT,
  "dataId" TEXT,
  "payload" TEXT NOT NULL,
  "processingStatus" TEXT NOT NULL DEFAULT 'received',
  "processedAt" DATETIME,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");
CREATE INDEX "WebhookEvent_provider_createdAt_idx" ON "WebhookEvent"("provider", "createdAt");
CREATE INDEX "WebhookEvent_processingStatus_createdAt_idx" ON "WebhookEvent"("processingStatus", "createdAt");
