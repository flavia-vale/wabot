/*
  Warnings:

  - You are about to alter the column `imageMutationEnabled` on the `BotConfig` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.
  - You are about to alter the column `probeEnabled` on the `BotConfig` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.

*/
-- CreateTable
CREATE TABLE "TutorialContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "images" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OfferAutomation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "destGroupJid" TEXT NOT NULL,
    "destGroupName" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "intervalMinutes" INTEGER NOT NULL,
    "offersPerSend" INTEGER NOT NULL DEFAULT 1,
    "minDiscountPct" INTEGER NOT NULL DEFAULT 0,
    "sortType" INTEGER NOT NULL DEFAULT 2,
    "isAMSOffer" BOOLEAN NOT NULL DEFAULT false,
    "isKeySeller" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" DATETIME,
    "sentItemIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OfferAutomation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AffiliateClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT NOT NULL,
    "clickedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "uaHash" TEXT,
    CONSTRAINT "AffiliateClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AffiliateLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AffiliateClick" ("clickedAt", "id", "ipHash", "linkId", "uaHash") SELECT "clickedAt", "id", "ipHash", "linkId", "uaHash" FROM "AffiliateClick";
DROP TABLE "AffiliateClick";
ALTER TABLE "new_AffiliateClick" RENAME TO "AffiliateClick";
CREATE INDEX "AffiliateClick_linkId_clickedAt_idx" ON "AffiliateClick"("linkId", "clickedAt");
CREATE TABLE "new_AffiliateLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "messageLogId" TEXT,
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AffiliateLink" ("createdAt", "groupId", "hash", "id", "messageLogId", "originalUrl", "userId") SELECT "createdAt", "groupId", "hash", "id", "messageLogId", "originalUrl", "userId" FROM "AffiliateLink";
DROP TABLE "AffiliateLink";
ALTER TABLE "new_AffiliateLink" RENAME TO "AffiliateLink";
CREATE UNIQUE INDEX "AffiliateLink_hash_key" ON "AffiliateLink"("hash");
CREATE INDEX "AffiliateLink_userId_createdAt_idx" ON "AffiliateLink"("userId", "createdAt");
CREATE INDEX "AffiliateLink_groupId_createdAt_idx" ON "AffiliateLink"("groupId", "createdAt");
CREATE TABLE "new_BotConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "delayMin" INTEGER NOT NULL DEFAULT 5,
    "delayMax" INTEGER NOT NULL DEFAULT 15,
    "platforms" TEXT NOT NULL DEFAULT 'shopee,amazon,mercadolivre,magazineluiza',
    "blockedKeywords" TEXT NOT NULL DEFAULT '',
    "welcomeMsg" TEXT NOT NULL DEFAULT '',
    "feedGlobal" BOOLEAN NOT NULL DEFAULT false,
    "postToStatus" BOOLEAN NOT NULL DEFAULT false,
    "brandingGroupLink" TEXT NOT NULL DEFAULT '',
    "brandingCtaText" TEXT NOT NULL DEFAULT 'Participe do grupo:',
    "maxDailyFollows" INTEGER NOT NULL DEFAULT 3,
    "channelMinIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "channelBurstCap" INTEGER NOT NULL DEFAULT 6,
    "channelBurstWindowSec" INTEGER NOT NULL DEFAULT 600,
    "channelDailyCap" INTEGER,
    "channelStaggerJitterMs" INTEGER NOT NULL DEFAULT 90000,
    "channelQuietHoursJson" TEXT NOT NULL DEFAULT '{"startHour":0,"endHour":6,"tz":"America/Sao_Paulo"}',
    "imageMutationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "copyVariationPoolJson" TEXT NOT NULL DEFAULT '{}',
    "probeAccountSessionId" TEXT,
    "probeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BotConfig" ("blockedKeywords", "brandingCtaText", "brandingGroupLink", "channelBurstCap", "channelBurstWindowSec", "channelDailyCap", "channelMinIntervalSec", "channelQuietHoursJson", "channelStaggerJitterMs", "copyVariationPoolJson", "delayMax", "delayMin", "feedGlobal", "id", "imageMutationEnabled", "maxDailyFollows", "platforms", "postToStatus", "probeAccountSessionId", "probeEnabled", "updatedAt", "userId", "welcomeMsg") SELECT "blockedKeywords", "brandingCtaText", "brandingGroupLink", "channelBurstCap", "channelBurstWindowSec", "channelDailyCap", "channelMinIntervalSec", "channelQuietHoursJson", "channelStaggerJitterMs", "copyVariationPoolJson", "delayMax", "delayMin", "feedGlobal", "id", "imageMutationEnabled", "maxDailyFollows", "platforms", "postToStatus", "probeAccountSessionId", "probeEnabled", "updatedAt", "userId", "welcomeMsg" FROM "BotConfig";
DROP TABLE "BotConfig";
ALTER TABLE "new_BotConfig" RENAME TO "BotConfig";
CREATE UNIQUE INDEX "BotConfig_userId_key" ON "BotConfig"("userId");
CREATE TABLE "new_ChannelHealth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'green',
    "lastError" TEXT,
    "errorRate1h" REAL NOT NULL DEFAULT 0,
    "latencyP95_1h" INTEGER,
    "lastProbeSeenAt" DATETIME,
    "lastPostedAt" DATETIME,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "pausedUntil" DATETIME,
    "reportRiskScore" INTEGER,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelHealth_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChannelHealth" ("consecutiveFailures", "errorRate1h", "groupId", "id", "lastError", "lastPostedAt", "lastProbeSeenAt", "latencyP95_1h", "pausedUntil", "reportRiskScore", "status", "updatedAt") SELECT "consecutiveFailures", "errorRate1h", "groupId", "id", "lastError", "lastPostedAt", "lastProbeSeenAt", "latencyP95_1h", "pausedUntil", "reportRiskScore", "status", "updatedAt" FROM "ChannelHealth";
DROP TABLE "ChannelHealth";
ALTER TABLE "new_ChannelHealth" RENAME TO "ChannelHealth";
CREATE UNIQUE INDEX "ChannelHealth_groupId_key" ON "ChannelHealth"("groupId");
CREATE INDEX "ChannelHealth_status_idx" ON "ChannelHealth"("status");
CREATE TABLE "new_ChannelSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "inviteLink" TEXT,
    "snapshotJson" TEXT NOT NULL,
    "snapshotedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelSnapshot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChannelSnapshot" ("description", "groupId", "id", "inviteLink", "name", "snapshotJson", "snapshotedAt") SELECT "description", "groupId", "id", "inviteLink", "name", "snapshotJson", "snapshotedAt" FROM "ChannelSnapshot";
DROP TABLE "ChannelSnapshot";
ALTER TABLE "new_ChannelSnapshot" RENAME TO "ChannelSnapshot";
CREATE INDEX "ChannelSnapshot_groupId_snapshotedAt_idx" ON "ChannelSnapshot"("groupId", "snapshotedAt");
CREATE TABLE "new_ChannelThrottle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "lastPostAt" DATETIME,
    "burstWindowStart" DATETIME,
    "postsInBurstWindow" INTEGER NOT NULL DEFAULT 0,
    "postsToday" INTEGER NOT NULL DEFAULT 0,
    "dayBucket" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ChannelThrottle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChannelThrottle" ("burstWindowStart", "dayBucket", "groupId", "id", "lastPostAt", "postsInBurstWindow", "postsToday") SELECT "burstWindowStart", "dayBucket", "groupId", "id", "lastPostAt", "postsInBurstWindow", "postsToday" FROM "ChannelThrottle";
DROP TABLE "ChannelThrottle";
ALTER TABLE "new_ChannelThrottle" RENAME TO "ChannelThrottle";
CREATE UNIQUE INDEX "ChannelThrottle_groupId_key" ON "ChannelThrottle"("groupId");
CREATE TABLE "new_FaqItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FaqItem" ("answer", "createdAt", "id", "isActive", "position", "question", "updatedAt") SELECT "answer", "createdAt", "id", "isActive", "position", "question", "updatedAt" FROM "FaqItem";
DROP TABLE "FaqItem";
ALTER TABLE "new_FaqItem" RENAME TO "FaqItem";
CREATE INDEX "FaqItem_isActive_position_idx" ON "FaqItem"("isActive", "position");
CREATE TABLE "new_FollowLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channelJid" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "followedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FollowLog" ("channelJid", "error", "followedAt", "id", "status", "userId") SELECT "channelJid", "error", "followedAt", "id", "status", "userId" FROM "FollowLog";
DROP TABLE "FollowLog";
ALTER TABLE "new_FollowLog" RENAME TO "FollowLog";
CREATE INDEX "FollowLog_userId_followedAt_idx" ON "FollowLog"("userId", "followedAt");
CREATE TABLE "new_LpPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "features" TEXT NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LpPlan" ("createdAt", "description", "features", "id", "position", "price", "title", "updatedAt") SELECT "createdAt", "description", "features", "id", "position", "price", "title", "updatedAt" FROM "LpPlan";
DROP TABLE "LpPlan";
ALTER TABLE "new_LpPlan" RENAME TO "LpPlan";
CREATE INDEX "LpPlan_position_idx" ON "LpPlan"("position");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactPhoneVerifiedAt" DATETIME,
    "contactPhoneOptInAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "accessExpiresAt" DATETIME,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT,
    "referredBy" TEXT,
    "lastLoginAt" DATETIME,
    "lastActivityAt" DATETIME,
    "lastSupportContactAt" DATETIME,
    "supportStatus" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("accessExpiresAt", "contactPhone", "contactPhoneOptInAt", "contactPhoneVerifiedAt", "createdAt", "email", "id", "lastActivityAt", "lastLoginAt", "lastSupportContactAt", "name", "passwordHash", "plan", "referralCode", "referredBy", "sendCount", "status", "supportStatus") SELECT "accessExpiresAt", "contactPhone", "contactPhoneOptInAt", "contactPhoneVerifiedAt", "createdAt", "email", "id", "lastActivityAt", "lastLoginAt", "lastSupportContactAt", "name", "passwordHash", "plan", "referralCode", "referredBy", "sendCount", "status", "supportStatus" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_contactPhone_key" ON "User"("contactPhone");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_status_plan_accessExpiresAt_idx" ON "User"("status", "plan", "accessExpiresAt");
CREATE INDEX "User_lastActivityAt_idx" ON "User"("lastActivityAt");
CREATE INDEX "User_supportStatus_idx" ON "User"("supportStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OfferAutomation_userId_enabled_idx" ON "OfferAutomation"("userId", "enabled");

-- CreateIndex
CREATE INDEX "OfferAutomation_enabled_lastSentAt_idx" ON "OfferAutomation"("enabled", "lastSentAt");
