-- Agrega duplicatas bloqueadas em vez de criar N linhas iguais de skip:dedup_recent_link.
-- Ver src/bot-worker.js (registerDedupBlock) e dashboard/.../logs/page.js (ChipDedupHits).

ALTER TABLE "MessageLog" ADD COLUMN "dedupHits" INTEGER NOT NULL DEFAULT 0;

-- Índice para o lookup "encontre a row mais recente desta (userId, destGroup, convertedUrl)".
CREATE INDEX "MessageLog_userId_destGroup_convertedUrl_sentAt_idx"
  ON "MessageLog" ("userId", "destGroup", "convertedUrl", "sentAt");
