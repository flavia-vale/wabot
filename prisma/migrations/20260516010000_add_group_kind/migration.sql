-- Adiciona discriminator kind em Group para distinguir grupos ('group')
-- de canais ('channel'). Default 'group' garante retrocompatibilidade
-- com todos os registros existentes.
ALTER TABLE "Group" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'group';
CREATE INDEX "Group_userId_kind_idx" ON "Group"("userId", "kind");
