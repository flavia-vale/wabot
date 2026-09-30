-- Link Inteligente: avisos de "link enchendo" (e-mail + WhatsApp) com controle de repetição.
-- Colunas novas com padrão: nada existente muda (avisos ligados por padrão).
ALTER TABLE "SmartLink" ADD COLUMN "notifyEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SmartLink" ADD COLUMN "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SmartLink" ADD COLUMN "alertKind" TEXT;
ALTER TABLE "SmartLink" ADD COLUMN "alertLastSentAt" DATETIME;
ALTER TABLE "SmartLink" ADD COLUMN "alertReminders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SmartLink" ADD COLUMN "alertActiveGroups" INTEGER;
