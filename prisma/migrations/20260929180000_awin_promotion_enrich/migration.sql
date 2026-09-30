-- Link curto e foto das promoções Awin (docs/rca/afiliados-awin.md).
-- Só acréscimos: três colunas vazias; nada existente muda.
ALTER TABLE "AwinPromotion" ADD COLUMN "shortUrl" TEXT;
ALTER TABLE "AwinPromotion" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "AwinPromotion" ADD COLUMN "enrichedAt" DATETIME;
