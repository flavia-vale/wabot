-- Vários números por conta, Fase 2 (docs/rca/multi-numero.md): rodízio de
-- envio. Só acréscimos: chave por conta (padrão desligada) e dono de cada grupo.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "rotationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DestinationSender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "destJid" TEXT NOT NULL,
    "slot" INTEGER,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DestinationSender_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DestinationSender_userId_destJid_key" ON "DestinationSender"("userId", "destJid");
