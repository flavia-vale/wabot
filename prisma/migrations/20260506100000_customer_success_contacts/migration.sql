-- Customer Success: histórico de contatos e follow-ups para suporte proativo.
CREATE TABLE "CustomerContactLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "adminUserId" TEXT,
    "actorUserId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "reason" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'contacted',
    "notes" TEXT,
    "nextFollowUpAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerContactLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerContactLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerContactLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CustomerContactLog_userId_createdAt_idx" ON "CustomerContactLog"("userId", "createdAt");
CREATE INDEX "CustomerContactLog_adminUserId_createdAt_idx" ON "CustomerContactLog"("adminUserId", "createdAt");
CREATE INDEX "CustomerContactLog_actorUserId_createdAt_idx" ON "CustomerContactLog"("actorUserId", "createdAt");
CREATE INDEX "CustomerContactLog_reason_createdAt_idx" ON "CustomerContactLog"("reason", "createdAt");
CREATE INDEX "CustomerContactLog_outcome_nextFollowUpAt_idx" ON "CustomerContactLog"("outcome", "nextFollowUpAt");
