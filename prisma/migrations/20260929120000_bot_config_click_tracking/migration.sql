-- Link rastreado (src/core/trackedLinks.js): opt-in por conta, DESLIGADO por
-- padrão — nenhuma cliente muda de comportamento com esta migration.
-- DDL (ALTER TABLE): em modo `remote` o deploy pode precisar parar o
-- bot-supervisor para aplicar (ver docs/rca/deploy-e-infra.md, pegadinha 8).
ALTER TABLE "BotConfig" ADD COLUMN "clickTrackingEnabled" BOOLEAN NOT NULL DEFAULT false;
