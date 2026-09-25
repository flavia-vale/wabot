-- Cupom de link, compra mínima e teto de desconto (specs/017, 2026-09-25).
-- Aditiva: cupons existentes viram 'code' e ficam sem mínimo e sem teto,
-- exatamente como funcionavam.
ALTER TABLE "ClientCoupon" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'code';
ALTER TABLE "ClientCoupon" ADD COLUMN "redeemUrl" TEXT;
ALTER TABLE "ClientCoupon" ADD COLUMN "minPurchaseCents" INTEGER;
ALTER TABLE "ClientCoupon" ADD COLUMN "maxDiscountCents" INTEGER;
