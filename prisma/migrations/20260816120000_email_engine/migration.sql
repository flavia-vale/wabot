-- Motor de e-mails (fase 2 do plano de e-mails do BOTinho).
--
-- Quatro tabelas NOVAS, nenhuma coluna alterada em tabela existente:
--   EmailTemplate — override de assunto/texto feito pelo painel admin. Sem
--                   linha aqui, vale o texto padrão do código
--                   (src/email/registry.js) — o sistema nunca fica sem texto.
--   EmailSendLog  — histórico de tudo que saiu. É também a idempotência dos
--                   gatilhos automáticos e a trava anti-repetição dos envios
--                   manuais ("já recebeu este e-mail nos últimos N dias").
--   EmailBatch    — um disparo manual em massa feito pelo painel.
--   EmailOptOut   — descadastro por categoria (só 'marketing'; transacional é
--                   obrigação de serviço e não passa por aqui).
--
-- CREATE TABLE em tabela nova não disputa lock com escrita em andamento como um
-- ALTER TABLE disputaria, mas continua sendo DDL: os scripts de deploy já param
-- os apps que seguram Prisma antes do migrate (pegadinha #8 do AGENTS.md).

CREATE TABLE "EmailTemplate" (
    "slug" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "EmailSendLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'transactional',
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "batchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "skipReason" TEXT,
    "error" TEXT,
    "scheduledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "EmailSendLog_slug_userId_createdAt_idx" ON "EmailSendLog"("slug", "userId", "createdAt");
CREATE INDEX "EmailSendLog_status_scheduledAt_idx" ON "EmailSendLog"("status", "scheduledAt");
CREATE INDEX "EmailSendLog_batchId_status_idx" ON "EmailSendLog"("batchId", "status");

CREATE TABLE "EmailBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "filters" TEXT NOT NULL DEFAULT '{}',
    "total" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

CREATE INDEX "EmailBatch_status_createdAt_idx" ON "EmailBatch"("status", "createdAt");

CREATE TABLE "EmailOptOut" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'marketing',
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "EmailOptOut_userId_category_key" ON "EmailOptOut"("userId", "category");
