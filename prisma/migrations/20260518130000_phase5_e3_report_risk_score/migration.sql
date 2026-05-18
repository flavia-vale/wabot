-- PR-5.E.3: score 0-100 de risco por canal-destino.
ALTER TABLE "ChannelHealth" ADD COLUMN "reportRiskScore" INTEGER;
