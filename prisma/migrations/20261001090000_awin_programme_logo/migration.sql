-- Logo da loja Awin como última camada da foto das promoções
-- (docs/rca/afiliados-awin.md, RCA 2026-09-30). Só acréscimo.
ALTER TABLE "AwinProgramme" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "AwinPromotion" ADD COLUMN "imageTriedAt" DATETIME;
