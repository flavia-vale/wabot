-- PR-3: probe evidence storage for monitoring latency/fallback pings
CREATE TABLE "ProbeEvidence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "probeSessionId" TEXT NOT NULL,
  "messageFingerprint" TEXT NOT NULL,
  "sentAt" DATETIME NOT NULL,
  "seenAt" DATETIME NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "matchSource" TEXT NOT NULL DEFAULT 'manual-ping-fallback',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProbeEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProbeEvidence_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProbeEvidence_userId_groupId_seenAt_idx" ON "ProbeEvidence"("userId", "groupId", "seenAt");
CREATE INDEX "ProbeEvidence_groupId_messageFingerprint_idx" ON "ProbeEvidence"("groupId", "messageFingerprint");
