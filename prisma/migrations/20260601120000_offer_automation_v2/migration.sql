-- AddColumn couponLink to BotConfig
ALTER TABLE "BotConfig" ADD COLUMN "couponLink" TEXT NOT NULL DEFAULT '';

-- Rename isAMSOffer to prioritizeAMS in OfferAutomation
ALTER TABLE "OfferAutomation" RENAME COLUMN "isAMSOffer" TO "prioritizeAMS";
