-- Remove o bot de oferta do Telegram e a flag feedGlobal (nunca usada).
--
-- TelegramOfferLog: tabela do bot do Telegram (removido por completo do
-- código). DROP TABLE também remove os índices associados.
DROP TABLE "TelegramOfferLog";

-- BotConfig.feedGlobal: flag sempre `false` em produção, nunca exposta na UI.
-- Removê-la preserva o comportamento atual (só processa grupos monitorados).
-- SQLite >= 3.35 (bundled no Prisma 5.22) suporta ALTER TABLE DROP COLUMN.
ALTER TABLE "BotConfig" DROP COLUMN "feedGlobal";
