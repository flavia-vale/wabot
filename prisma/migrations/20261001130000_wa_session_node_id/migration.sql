-- Roteamento por nó do supervisor (SUPERVISOR_NODE_ROUTING, default off).
-- Coluna nula, sem backfill: null = nó 'n1'. Nada existente muda.
ALTER TABLE "WaSession" ADD COLUMN "nodeId" TEXT;
CREATE INDEX "WaSession_nodeId_idx" ON "WaSession"("nodeId");
