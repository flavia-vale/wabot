-- Preço lido pelo Criar oferta, para o cupom do agendado sair com "de X por Y".
-- Aditiva e opcional: agendados existentes ficam com NULL (preço desconhecido).
ALTER TABLE "ScheduledMessage" ADD COLUMN "couponPriceCents" INTEGER;
