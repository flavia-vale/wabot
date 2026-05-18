-- Phase 5 Foundations: anti-ban guardrails for WhatsApp channels.
-- Aditivo: ALTER TABLE ... ADD COLUMN com DEFAULT + tabelas novas.

ALTER TABLE "BotConfig" ADD COLUMN "maxDailyFollows" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "BotConfig" ADD COLUMN "channelMinIntervalSec" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "BotConfig" ADD COLUMN "channelBurstCap" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "BotConfig" ADD COLUMN "channelBurstWindowSec" INTEGER NOT NULL DEFAULT 600;
ALTER TABLE "BotConfig" ADD COLUMN "channelDailyCap" INTEGER;
ALTER TABLE "BotConfig" ADD COLUMN "channelStaggerJitterMs" INTEGER NOT NULL DEFAULT 90000;
ALTER TABLE "BotConfig" ADD COLUMN "channelQuietHoursJson" TEXT NOT NULL DEFAULT '{"startHour":0,"endHour":6,"tz":"America/Sao_Paulo"}';
ALTER TABLE "BotConfig" ADD COLUMN "imageMutationEnabled" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BotConfig" ADD COLUMN "copyVariationPoolJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "BotConfig" ADD COLUMN "probeAccountSessionId" TEXT;
ALTER TABLE "BotConfig" ADD COLUMN "probeEnabled" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "FollowLog" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "channelJid" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "followedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "FollowLog_userId_followedAt_idx" ON "FollowLog"("userId", "followedAt");

CREATE TABLE "ChannelHealth" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "groupId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'green',
  "lastError" TEXT,
  "errorRate1h" REAL NOT NULL DEFAULT 0,
  "latencyP95_1h" INTEGER,
  "lastProbeSeenAt" DATETIME,
  "lastPostedAt" DATETIME,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "pausedUntil" DATETIME,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelHealth_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "ChannelHealth_groupId_key" ON "ChannelHealth"("groupId");
CREATE INDEX "ChannelHealth_status_idx" ON "ChannelHealth"("status");

CREATE TABLE "ChannelThrottle" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "groupId" TEXT NOT NULL,
  "lastPostAt" DATETIME,
  "burstWindowStart" DATETIME,
  "postsInBurstWindow" INTEGER NOT NULL DEFAULT 0,
  "postsToday" INTEGER NOT NULL DEFAULT 0,
  "dayBucket" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "ChannelThrottle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "ChannelThrottle_groupId_key" ON "ChannelThrottle"("groupId");

CREATE TABLE "ChannelSnapshot" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" TEXT,
  "description" TEXT,
  "inviteLink" TEXT,
  "snapshotJson" TEXT NOT NULL,
  "snapshotedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelSnapshot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE
);
CREATE INDEX "ChannelSnapshot_groupId_snapshotedAt_idx" ON "ChannelSnapshot"("groupId", "snapshotedAt");
