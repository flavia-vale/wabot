-- AlterTable: horário de funcionamento por fila (override da janela silenciosa
-- global). operatingHoursStart/End em "HH:mm" (America/Sao_Paulo).
ALTER TABLE "OfferQueue" ADD COLUMN "operatingHoursEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OfferQueue" ADD COLUMN "operatingHoursStart" TEXT;
ALTER TABLE "OfferQueue" ADD COLUMN "operatingHoursEnd" TEXT;
