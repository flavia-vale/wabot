-- PR-5 follow-up: click tracker foundation.
-- Encurta links de afiliado e loga clicks para alimentar o reportRiskScore
-- (clickRate) e o futuro PR-5.C.4 (alerta de drop > 70% por > 48h).

CREATE TABLE "AffiliateLink" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "hash" TEXT NOT NULL UNIQUE,
  "originalUrl" TEXT NOT NULL,
  "messageLogId" TEXT,
  "groupId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "AffiliateLink_userId_createdAt_idx" ON "AffiliateLink"("userId", "createdAt");
CREATE INDEX "AffiliateLink_groupId_createdAt_idx" ON "AffiliateLink"("groupId", "createdAt");

CREATE TABLE "AffiliateClick" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "linkId" TEXT NOT NULL,
  "clickedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash" TEXT,
  "uaHash" TEXT,
  CONSTRAINT "AffiliateClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AffiliateLink"("id") ON DELETE CASCADE
);
CREATE INDEX "AffiliateClick_linkId_clickedAt_idx" ON "AffiliateClick"("linkId", "clickedAt");
