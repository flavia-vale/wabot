-- Plano B (config de preservação direcionada): preset reutilizável por usuário +
-- campos de override por DESTINO (Group). Ver
-- docs/superpowers/plans/2026-06-22-plano-b-config-direcionada-design.md
--
-- Apenas adições (nova tabela + colunas nuláveis em Group). Sem rebuild de
-- tabela: SQLite aceita ADD COLUMN com REFERENCES quando o default é NULL.

-- CreateTable
CREATE TABLE "PreservationPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "operatingHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "operatingHoursJson" TEXT NOT NULL DEFAULT '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
    "throttleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "burstCap" INTEGER NOT NULL DEFAULT 6,
    "burstWindowSec" INTEGER NOT NULL DEFAULT 600,
    "dailyCap" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PreservationPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PreservationPreset_userId_idx" ON "PreservationPreset"("userId");

-- AlterTable: override de preservação por destino (null = herda do preset)
ALTER TABLE "Group" ADD COLUMN "preservationPresetId" TEXT REFERENCES "PreservationPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Group" ADD COLUMN "operatingHoursEnabled" BOOLEAN;
ALTER TABLE "Group" ADD COLUMN "operatingHoursJson" TEXT;
ALTER TABLE "Group" ADD COLUMN "throttleEnabled" BOOLEAN;
ALTER TABLE "Group" ADD COLUMN "minIntervalSec" INTEGER;
ALTER TABLE "Group" ADD COLUMN "burstCap" INTEGER;
ALTER TABLE "Group" ADD COLUMN "burstWindowSec" INTEGER;
ALTER TABLE "Group" ADD COLUMN "dailyCap" INTEGER;

-- CreateIndex
CREATE INDEX "Group_preservationPresetId_idx" ON "Group"("preservationPresetId");
