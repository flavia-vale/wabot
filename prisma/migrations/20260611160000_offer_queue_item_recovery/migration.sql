-- Recuperação de itens presos na fila de ofertas: claim com lease + retry.
-- claimedAt marca quando o item foi reivindicado (pending -> queued); o
-- watchdog devolve para 'pending' itens cujo lease expirou (processo caiu
-- entre claim e envio). attemptCount/nextAttemptAt suportam retry com
-- backoff; lastError registra o motivo da última falha.
ALTER TABLE "OfferQueueItem" ADD COLUMN "claimedAt" DATETIME;
ALTER TABLE "OfferQueueItem" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OfferQueueItem" ADD COLUMN "nextAttemptAt" DATETIME;
ALTER TABLE "OfferQueueItem" ADD COLUMN "lastError" TEXT;
