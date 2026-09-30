-- Amostras horárias do total de membros por grupo (painel "Membros").
-- Tabela nova e vazia: nada existente muda.
CREATE TABLE "GroupMemberSample" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "groupId" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sampledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupMemberSample_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "GroupMemberSample_groupId_sampledAt_idx" ON "GroupMemberSample"("groupId", "sampledAt");
