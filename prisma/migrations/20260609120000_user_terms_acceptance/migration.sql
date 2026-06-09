-- Registro do aceite explícito dos Termos de Uso no cadastro.
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "termsAcceptedIp" TEXT;
ALTER TABLE "User" ADD COLUMN "termsAcceptedUserAgent" TEXT;
