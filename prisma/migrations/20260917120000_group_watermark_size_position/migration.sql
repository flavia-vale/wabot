-- Tamanho e posição da marca d'água escolhidos pelo DESTINO.
-- Nulo = padrão (size='medium', o tamanho histórico; position='center'),
-- resolvido em src/core/destinationWatermark.js — valor desconhecido cai no
-- padrão em vez de derrubar o envio da oferta.
ALTER TABLE "Group" ADD COLUMN "watermarkSize" TEXT;
ALTER TABLE "Group" ADD COLUMN "watermarkPosition" TEXT;
