-- AlterTable: página atual da busca Shopee por automação. Rotaciona a cada
-- execução (runAutomation) para trazer candidatos novos em vez de rebater
-- sempre a página 1 — causa do all_offers_filtered em nichos pequenos já
-- enviados no dia.
ALTER TABLE "OfferAutomation" ADD COLUMN "page" INTEGER NOT NULL DEFAULT 1;
