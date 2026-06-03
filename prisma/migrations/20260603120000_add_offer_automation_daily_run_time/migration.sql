-- Permite escolher um horário fixo (HH:mm) para automações com frequência diária.
ALTER TABLE "OfferAutomation" ADD COLUMN "dailyRunTime" TEXT;
