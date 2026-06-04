-- CreateTable
CREATE TABLE "OfferAutomationSentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "destGroupJid" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "itemId" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "OfferAutomationSentLog_userId_destGroupJid_sentAt_idx" ON "OfferAutomationSentLog"("userId", "destGroupJid", "sentAt");
