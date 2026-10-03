-- Vários números por conta, Fase 1 (docs/rca/multi-numero.md). Só acréscimos:
-- WaSession (o número 1) não muda; números extras ganham tabela própria e a
-- conta ganha três colunas com default — conta existente segue com 1 número.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "extraNumbers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "activeWaSlot" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN "waSlotSwitchedAt" DATETIME;

-- CreateTable
CREATE TABLE "WaExtraSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "lifecycle" TEXT NOT NULL DEFAULT 'idle',
    "nodeId" TEXT,
    "lastHeartbeatAt" DATETIME,
    "lastDisconnectCode" TEXT,
    "blockNotice" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WaExtraSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WaExtraSession_userId_slot_key" ON "WaExtraSession"("userId", "slot");
CREATE INDEX "WaExtraSession_status_lastHeartbeatAt_idx" ON "WaExtraSession"("status", "lastHeartbeatAt");
