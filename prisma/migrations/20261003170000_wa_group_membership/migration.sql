-- Vários números por conta, Fase 2 (docs/rca/multi-numero.md): em quais
-- grupos cada número da conta está. Tabela nova, nada existente muda.

-- CreateTable
CREATE TABLE "WaGroupMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "waJid" TEXT NOT NULL,
    "name" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "refreshedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaGroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WaGroupMembership_userId_slot_waJid_key" ON "WaGroupMembership"("userId", "slot", "waJid");
CREATE INDEX "WaGroupMembership_userId_waJid_idx" ON "WaGroupMembership"("userId", "waJid");
