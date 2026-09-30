-- Link Inteligente (rodízio de convites). Tabelas novas e vazias: nada existente muda.
CREATE TABLE "SmartLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "capPerGroup" INTEGER NOT NULL DEFAULT 1000,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SmartLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmartLink_slug_key" ON "SmartLink"("slug");
CREATE INDEX "SmartLink_userId_idx" ON "SmartLink"("userId");

CREATE TABLE "SmartLinkGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "smartLinkId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "inviteCode" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartLinkGroup_smartLinkId_fkey" FOREIGN KEY ("smartLinkId") REFERENCES "SmartLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SmartLinkGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmartLinkGroup_smartLinkId_groupId_key" ON "SmartLinkGroup"("smartLinkId", "groupId");
CREATE INDEX "SmartLinkGroup_groupId_idx" ON "SmartLinkGroup"("groupId");

CREATE TABLE "SmartLinkDailyClick" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "smartLinkGroupId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SmartLinkDailyClick_smartLinkGroupId_fkey" FOREIGN KEY ("smartLinkGroupId") REFERENCES "SmartLinkGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmartLinkDailyClick_smartLinkGroupId_day_key" ON "SmartLinkDailyClick"("smartLinkGroupId", "day");
