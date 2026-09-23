-- Cupons da própria cliente. Tabela nova e vazia: nada existente muda.
CREATE TABLE "ClientCoupon" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT,
  "platform" TEXT NOT NULL,
  "discountType" TEXT NOT NULL,
  "discountValue" INTEGER NOT NULL,
  "validUntil" DATETIME,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClientCoupon_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ClientCoupon_userId_enabled_idx" ON "ClientCoupon"("userId", "enabled");
CREATE INDEX "ClientCoupon_userId_platform_idx" ON "ClientCoupon"("userId", "platform");

-- Opt-in por automação. DEFAULT false = automação existente não muda (FR-023).
ALTER TABLE "OfferAutomation" ADD COLUMN "useCoupons" BOOLEAN NOT NULL DEFAULT false;
