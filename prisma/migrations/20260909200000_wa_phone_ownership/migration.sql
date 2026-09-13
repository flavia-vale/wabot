-- Histórico de qual conta conectou qual número de WhatsApp.
-- Tabela nova e vazia: nada existente muda de comportamento.
CREATE TABLE "WaPhoneOwnership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "firstConnectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastConnectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaPhoneOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WaPhoneOwnership_phone_userId_key" ON "WaPhoneOwnership"("phone", "userId");
CREATE INDEX "WaPhoneOwnership_phone_idx" ON "WaPhoneOwnership"("phone");
CREATE INDEX "WaPhoneOwnership_userId_idx" ON "WaPhoneOwnership"("userId");

-- Aviso de recusa de conexão mostrado para a cliente (JSON curto, nulo por padrão).
ALTER TABLE "WaSession" ADD COLUMN "blockNotice" TEXT;
