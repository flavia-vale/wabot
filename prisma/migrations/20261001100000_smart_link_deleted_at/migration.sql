-- Link Inteligente: apagar reserva o endereço (soft delete). Coluna nula: nada existente muda.
ALTER TABLE "SmartLink" ADD COLUMN "deletedAt" DATETIME;
