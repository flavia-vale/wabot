-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "gatewayEventId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "lastSyncedAt" DATETIME;

-- CreateTable
CREATE TABLE "PaymentWebhookDlq" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "requestId" TEXT,
    "payload" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX "Payment_gatewayEventId_idx" ON "Payment"("gatewayEventId");
CREATE INDEX "PaymentWebhookDlq_provider_createdAt_idx" ON "PaymentWebhookDlq"("provider", "createdAt");
CREATE INDEX "PaymentWebhookDlq_resolvedAt_createdAt_idx" ON "PaymentWebhookDlq"("resolvedAt", "createdAt");
CREATE UNIQUE INDEX "PaymentWebhookDlq_provider_eventId_key" ON "PaymentWebhookDlq"("provider", "eventId");
