-- CreateIndex
CREATE INDEX "ScheduledMessage_userId_status_scheduledAt_idx" ON "ScheduledMessage"("userId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MessageLog_userId_sentAt_idx" ON "MessageLog"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "MessageLog_userId_status_sentAt_idx" ON "MessageLog"("userId", "status", "sentAt");
