-- Como a oferta aparece deixa de valer só para espelhamento.
--
-- FILAS: escolha POR FILA (cada fila costuma atender um público diferente).
-- OFERTAS AUTOMÁTICAS: escolha ÚNICA da conta (em BotConfig), não por
-- automação — decisão de produto: a pessoa configura uma vez e vale para todas.
--
-- Todo mundo nasce em 'original' ("a foto que veio na oferta"), que é
-- exatamente o comportamento atual dos dois caminhos — nenhuma conta muda de
-- comportamento por causa desta migration.
ALTER TABLE "OfferQueue" ADD COLUMN "imageMode" TEXT NOT NULL DEFAULT 'original';
ALTER TABLE "OfferQueue" ADD COLUMN "watermarkText" TEXT;
ALTER TABLE "OfferQueue" ADD COLUMN "watermarkColor" TEXT;

ALTER TABLE "BotConfig" ADD COLUMN "automationImageMode" TEXT NOT NULL DEFAULT 'original';
ALTER TABLE "BotConfig" ADD COLUMN "automationWatermarkText" TEXT;
ALTER TABLE "BotConfig" ADD COLUMN "automationWatermarkColor" TEXT;
