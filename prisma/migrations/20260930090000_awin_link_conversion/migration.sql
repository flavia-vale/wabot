-- Conversão de links pela Awin (docs/rca/afiliados-awin.md).
-- Só acréscimos: duas tabelas novas + 'awin' na lista de lojas ligadas.
-- O default de BotConfig.platforms muda só no schema (mesmo caminho da
-- AliExpress em 20260910150000): o código sempre grava a lista explícita.
-- CreateTable
CREATE TABLE "AwinProgramme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "advertiserId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "displayUrl" TEXT,
    "domainsJson" TEXT NOT NULL DEFAULT '[]',
    "lastSeenRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AwinProgramme_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AwinAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AwinLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "advertiserId" INTEGER NOT NULL,
    "destinationKey" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "shortUrl" TEXT,
    "longUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AwinLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AwinAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AwinProgramme_userId_idx" ON "AwinProgramme"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AwinProgramme_accountId_advertiserId_key" ON "AwinProgramme"("accountId", "advertiserId");

-- CreateIndex
CREATE INDEX "AwinLink_userId_idx" ON "AwinLink"("userId");

-- CreateIndex
CREATE INDEX "AwinLink_lastUsedAt_idx" ON "AwinLink"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AwinLink_accountId_advertiserId_destinationKey_key" ON "AwinLink"("accountId", "advertiserId", "destinationKey");


-- Liga a Awin nas configurações existentes (a conversão só age para quem tem
-- conta Awin cadastrada; sem conta, nada muda).
UPDATE "BotConfig"
   SET "platforms" = CASE
     WHEN COALESCE("platforms", '') = '' THEN 'awin'
     ELSE "platforms" || ',awin'
   END
 WHERE ',' || COALESCE("platforms", '') || ',' NOT LIKE '%,awin,%';
