-- Módulo de Preservação Avançada: flag mestre opt-in (só vale para usuários Pro/Trial).
-- Default false: o pipeline de preservação (throttle, stagger, mutação de imagem,
-- snapshots, follow-guard) só passa a valer quando o usuário Pro liga explicitamente.
ALTER TABLE "BotConfig" ADD COLUMN "preservationEnabled" BOOLEAN NOT NULL DEFAULT false;
