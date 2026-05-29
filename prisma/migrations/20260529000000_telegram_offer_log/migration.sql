-- PR: Telegram offer bot request/metrics logging for /admin tab
CREATE TABLE "TelegramOfferLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chatId" TEXT NOT NULL,
  "inputUrl" TEXT NOT NULL,
  "platform" TEXT,
  "status" TEXT NOT NULL,
  "withImage" BOOLEAN NOT NULL DEFAULT false,
  "errorMsg" TEXT,
  "latencyMs" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "TelegramOfferLog_createdAt_idx" ON "TelegramOfferLog"("createdAt");
CREATE INDEX "TelegramOfferLog_status_createdAt_idx" ON "TelegramOfferLog"("status", "createdAt");
CREATE INDEX "TelegramOfferLog_platform_createdAt_idx" ON "TelegramOfferLog"("platform", "createdAt");
