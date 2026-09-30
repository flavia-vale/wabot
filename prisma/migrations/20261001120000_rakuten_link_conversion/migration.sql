-- Conversão de links pela Rakuten (docs/rca/afiliados-rakuten.md).
-- Só acréscimos: uma tabela nova, uma coluna opcional e 'rakuten' na lista de
-- lojas ligadas. Sem cache de links: o deep link é montado sem chamada.
-- AlterTable
ALTER TABLE "RakutenAccount" ADD COLUMN "linkId" TEXT;

-- CreateTable
CREATE TABLE "RakutenProgramme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storeUrl" TEXT,
    "domainsJson" TEXT NOT NULL DEFAULT '[]',
    "lastSeenRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RakutenProgramme_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "RakutenAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RakutenProgramme_userId_idx" ON "RakutenProgramme"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RakutenProgramme_accountId_advertiserId_key" ON "RakutenProgramme"("accountId", "advertiserId");

-- Liga a Rakuten nas configurações existentes (a conversão só age para quem
-- tem conta Rakuten cadastrada; sem conta, nada muda).
UPDATE "BotConfig"
   SET "platforms" = CASE
     WHEN COALESCE("platforms", '') = '' THEN 'rakuten'
     ELSE "platforms" || ',rakuten'
   END
 WHERE ',' || COALESCE("platforms", '') || ',' NOT LIKE '%,rakuten,%';
