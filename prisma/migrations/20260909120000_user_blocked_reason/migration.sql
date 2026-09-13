-- Motivo do bloqueio/encerramento de acesso, mostrado para a cliente.
-- Duas colunas nulas: nenhuma linha existente muda de comportamento.
ALTER TABLE "User" ADD COLUMN "blockedReason" TEXT;
ALTER TABLE "User" ADD COLUMN "blockedAt" DATETIME;
