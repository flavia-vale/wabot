-- Reserva atômica de chaves de dedup por envio espelhado.
-- Fecha a corrida em que dois workers consultam MessageLog antes de qualquer
-- um deles criar a linha queued/success.
CREATE TABLE "SendDedupKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "destGroup" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "messageLogId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "SendDedupKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SendDedupKey_messageLogId_fkey" FOREIGN KEY ("messageLogId") REFERENCES "MessageLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SendDedupKey_userId_destGroup_dedupKey_key" ON "SendDedupKey"("userId", "destGroup", "dedupKey");
CREATE INDEX "SendDedupKey_expiresAt_idx" ON "SendDedupKey"("expiresAt");
CREATE INDEX "SendDedupKey_userId_destGroup_createdAt_idx" ON "SendDedupKey"("userId", "destGroup", "createdAt");
