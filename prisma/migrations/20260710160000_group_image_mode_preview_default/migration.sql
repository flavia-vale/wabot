-- Fixa a fonte de imagem de toda oferta espelhada em 'preview'
-- (Preview clicável do WhatsApp). A escolha por grupo foi removida da UI;
-- migra qualquer valor legado/nulo/não-preview para 'preview'. Idempotente,
-- não toca nenhuma outra coluna. Ver specs/001-image-mode-preview-default.
--
-- DML puro de propósito (sem ALTER TABLE): o `@default("preview")` novo em
-- schema.prisma é defesa em profundidade adicional (INV-3), mas o
-- carregamento efetivo em runtime nunca depende do DEFAULT físico da coluna
-- — o chokepoint em src/billing/groupEntitlements.js (toMonitorGroup) já
-- força 'preview' sempre, e a criação de grupo (src/api/routes/groups.js)
-- sempre envia `imageMode` explícito. Uma ALTER de DEFAULT em SQLite via
-- Prisma exigiria recriar a tabela inteira (rebuild) — risco/lock
-- desnecessário (AGENTS.md pegadinha #8) para um valor que a aplicação nunca
-- lê da coluna sem passar antes pelo chokepoint.
UPDATE "Group" SET "imageMode" = 'preview'
WHERE "imageMode" IS NULL OR "imageMode" <> 'preview';
