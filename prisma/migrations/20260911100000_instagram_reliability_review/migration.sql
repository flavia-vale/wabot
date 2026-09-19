ALTER TABLE "InstagramStoryIngress" ADD COLUMN "claimedAt" DATETIME;
CREATE INDEX "InstagramStoryIngress_status_claimedAt_idx" ON "InstagramStoryIngress"("status", "claimedAt");
