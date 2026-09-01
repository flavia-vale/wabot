ALTER TABLE "Payment" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'mercado_pago';
ALTER TABLE "Payment" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Payment" ADD COLUMN "daysGranted" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "note" TEXT;

CREATE INDEX "Payment_provider_createdAt_idx" ON "Payment"("provider", "createdAt");
