-- Conteúdo legal editável pelo painel admin (Termos de Uso, futuras políticas).
CREATE TABLE "LegalDocument" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "contentJson" TEXT NOT NULL DEFAULT '{}',
  "version" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
