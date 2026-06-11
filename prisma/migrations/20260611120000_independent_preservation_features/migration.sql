ALTER TABLE "BotConfig" ADD COLUMN "channelThrottleEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BotConfig" ADD COLUMN "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BotConfig" ADD COLUMN "followGuardEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BotConfig" ADD COLUMN "copyVariationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BotConfig" ADD COLUMN "imageMutationActive" BOOLEAN NOT NULL DEFAULT false;

-- Mantém o comportamento dos usuários existentes: o antigo interruptor mestre
-- passa a habilitar individualmente as defesas que ele controlava. O campo
-- imageMutationEnabled continua sendo a preferência legada; o novo campo
-- imageMutationActive é o opt-in independente da funcionalidade.
UPDATE "BotConfig"
SET "channelThrottleEnabled" = "preservationEnabled",
    "quietHoursEnabled" = "preservationEnabled",
    "followGuardEnabled" = "preservationEnabled",
    "copyVariationEnabled" = "preservationEnabled",
    "imageMutationActive" = CASE WHEN "preservationEnabled" THEN "imageMutationEnabled" ELSE false END;
