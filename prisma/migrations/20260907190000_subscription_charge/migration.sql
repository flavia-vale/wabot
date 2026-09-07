-- Tentativas de cobrança da assinatura recorrente (inclusive as recusadas).
-- Tabela NOVA: não altera nenhuma tabela existente, então não concorre com
-- leitura/escrita das já materializadas.
CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "mpSubscriptionId" TEXT,
    "mpAuthorizedPaymentId" TEXT,
    "mpPaymentId" TEXT,
    "plan" TEXT,
    "amount" REAL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "statusDetail" TEXT,
    "paymentMethod" TEXT,
    "retryAttempt" INTEGER,
    "attemptedAt" DATETIME NOT NULL,
    "debitedAt" DATETIME,
    "nextRetryAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'mp_sync',
    "syncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubscriptionCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SubscriptionCharge_mpAuthorizedPaymentId_key" ON "SubscriptionCharge"("mpAuthorizedPaymentId");
CREATE INDEX "SubscriptionCharge_attemptedAt_idx" ON "SubscriptionCharge"("attemptedAt");
CREATE INDEX "SubscriptionCharge_status_attemptedAt_idx" ON "SubscriptionCharge"("status", "attemptedAt");
CREATE INDEX "SubscriptionCharge_userId_attemptedAt_idx" ON "SubscriptionCharge"("userId", "attemptedAt");
CREATE INDEX "SubscriptionCharge_mpSubscriptionId_attemptedAt_idx" ON "SubscriptionCharge"("mpSubscriptionId", "attemptedAt");
