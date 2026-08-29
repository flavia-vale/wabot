-- Cor da marca d'água escolhida pelo DESTINO: 'white' ou 'black'.
-- Nulo = padrão ('white'), resolvido em src/core/destinationWatermark.js —
-- valor desconhecido cai no padrão em vez de derrubar o envio da oferta.
ALTER TABLE "Group" ADD COLUMN "watermarkColor" TEXT;
