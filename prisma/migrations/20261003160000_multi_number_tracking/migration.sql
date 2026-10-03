-- Vários números por conta, Fase 2 (docs/rca/multi-numero.md): rastreio de
-- qual número enviou e estado de recepção gravado no heartbeat. Só acréscimos,
-- colunas anuláveis — linha existente não muda.

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN "senderSlot" INTEGER;

-- AlterTable
ALTER TABLE "WaSession" ADD COLUMN "receptionState" TEXT;
ALTER TABLE "WaSession" ADD COLUMN "receptionStateAt" DATETIME;
