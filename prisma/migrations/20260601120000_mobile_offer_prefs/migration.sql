-- Persiste templates e links de cupom da experiência mobile no servidor
-- (antes viviam só em localStorage, sem sync entre dispositivos/desktop).
ALTER TABLE "BotConfig" ADD COLUMN "mobileTemplatesJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "BotConfig" ADD COLUMN "mobileCouponLinksJson" TEXT NOT NULL DEFAULT '{}';
