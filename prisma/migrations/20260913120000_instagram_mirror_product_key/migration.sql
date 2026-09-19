-- Dedup do Story espelhado por PRODUTO. A captura do espelhamento roda antes
-- da dedup de link do WhatsApp no bot-worker, e o par único
-- (destinationId, sourceMessageKey) não segura repost: cada repost da origem
-- chega com um key.id diferente. Sem esta coluna a mesma oferta virava um
-- Story novo a cada repetição da origem.
ALTER TABLE "InstagramStoryIngress" ADD COLUMN "productKey" TEXT;
CREATE INDEX "InstagramStoryIngress_destinationId_productKey_createdAt_idx" ON "InstagramStoryIngress"("destinationId", "productKey", "createdAt");
