-- Feature 017 (arquitetura multicanal de entrega) — migration ADITIVA apenas:
-- 3 colunas nuláveis em tabelas existentes + 2 tabelas novas. Nenhum DROP,
-- nenhum RENAME, nenhuma reescrita de dado existente. `Group.waJid` e
-- `MessageLog.destGroup` continuam com o mesmo nome, o mesmo tipo e o mesmo
-- conteúdo (FR-012). Ver specs/017-multicanal-telegram-instagram/data-model.md.

-- Nulo = WhatsApp (todo grupo/registro gravado até esta feature é WhatsApp).
ALTER TABLE "Group" ADD COLUMN "deliveryNetwork" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN "deliveryNetwork" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN "deliveryReductions" TEXT;

CREATE TABLE "DeliveryOutbox" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "deliveryNetwork" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "sourceId" TEXT,
  "messageLogId" TEXT,
  "offerJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "notBeforeAt" DATETIME,
  "enqueuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "DeliveryOutbox_status_notBeforeAt_idx" ON "DeliveryOutbox"("status", "notBeforeAt");
CREATE INDEX "DeliveryOutbox_userId_status_idx" ON "DeliveryOutbox"("userId", "status");
CREATE INDEX "DeliveryOutbox_deliveryNetwork_status_idx" ON "DeliveryOutbox"("deliveryNetwork", "status");

CREATE TABLE "DeliveryInboxSeen" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deliveryNetwork" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DeliveryInboxSeen_deliveryNetwork_sourceId_messageId_key" ON "DeliveryInboxSeen"("deliveryNetwork", "sourceId", "messageId");
CREATE INDEX "DeliveryInboxSeen_seenAt_idx" ON "DeliveryInboxSeen"("seenAt");
