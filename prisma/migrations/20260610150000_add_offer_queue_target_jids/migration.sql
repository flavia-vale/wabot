-- Grupos de destino selecionados na própria fila (JSON array de JIDs).
-- '[]' mantém o comportamento legado: fallback para todos os grupos 'post'.
ALTER TABLE "OfferQueue" ADD COLUMN "targetJids" TEXT NOT NULL DEFAULT '[]';
