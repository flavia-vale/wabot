CREATE TABLE "CapacityHostProfile" (
  "id" TEXT NOT NULL PRIMARY KEY, "hostKey" TEXT NOT NULL, "hostname" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'hetzner', "providerProjectId" TEXT, "providerServerId" TEXT,
  "serverType" TEXT, "architecture" TEXT, "vcpu" INTEGER, "memoryTotalMb" INTEGER,
  "diskTotalMb" INTEGER, "region" TEXT, "ipv4" TEXT, "inventoryJson" TEXT NOT NULL DEFAULT '{}',
  "source" TEXT NOT NULL DEFAULT 'baseline', "checkedAt" DATETIME, "lastSuccessAt" DATETIME,
  "errorCode" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CapacityHostProfile_hostKey_key" ON "CapacityHostProfile"("hostKey");

CREATE TABLE "CapacitySnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY, "hostProfileId" TEXT NOT NULL, "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hostKey" TEXT, "serverType" TEXT, "contractedVcpu" INTEGER, "contractedMemoryMb" INTEGER, "contractedDiskMb" INTEGER, "deploymentRevision" TEXT,
  "durationMs" INTEGER, "completeness" TEXT NOT NULL, "cpuPercent" REAL, "load1" REAL, "load5" REAL, "load15" REAL,
  "uptimeSeconds" INTEGER, "oomKillCount" INTEGER, "memoryTotalMb" INTEGER, "memoryFreeMb" INTEGER, "memoryAvailableMb" INTEGER,
  "memoryCacheMb" INTEGER, "processRssTotalMb" INTEGER, "classifiedRssTotalMb" INTEGER, "fixedBaseMb" INTEGER, "swapTotalMb" INTEGER,
  "swapUsedMb" INTEGER, "swapInKbPerSec" REAL, "swapOutKbPerSec" REAL, "diskTotalMb" INTEGER,
  "diskUsedMb" INTEGER, "diskAvailableMb" INTEGER, "diskUsedPercent" REAL, "inodeUsedPercent" REAL,
  "connectedSessions" INTEGER, "activeCustomers" INTEGER, "productionWorkers" INTEGER, "stagingWorkers" INTEGER,
  "workerRssTotalMb" INTEGER, "workerRssP50Mb" INTEGER, "workerRssP95Mb" INTEGER, "workerRssMaxMb" INTEGER,
  "productionRssMb" INTEGER, "stagingRssMb" INTEGER, "stagingOnline" BOOLEAN, "policyVersion" TEXT,
  "safeSessionLimit" INTEGER, "estimatedMaximum" INTEGER, "reserveMb" INTEGER, "sessionCostMb" INTEGER, "fixedBaseBudgetMb" INTEGER, "headroomSessions" INTEGER, "headroomMemoryMb" INTEGER,
  "bottleneck" TEXT, "operationalState" TEXT NOT NULL, "decisionReasonsJson" TEXT NOT NULL DEFAULT '[]',
  "sourcesJson" TEXT NOT NULL DEFAULT '[]', "componentsJson" TEXT NOT NULL DEFAULT '[]',
  CONSTRAINT "CapacitySnapshot_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "CapacityHostProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CapacitySnapshot_hostProfileId_collectedAt_idx" ON "CapacitySnapshot"("hostProfileId", "collectedAt");
CREATE INDEX "CapacitySnapshot_operationalState_collectedAt_idx" ON "CapacitySnapshot"("operationalState", "collectedAt");

CREATE TABLE "CapacityRollup" (
  "id" TEXT NOT NULL PRIMARY KEY, "hostProfileId" TEXT NOT NULL, "bucketStart" DATETIME NOT NULL,
  "granularity" TEXT NOT NULL, "sampleCount" INTEGER NOT NULL, "expectedSampleCount" INTEGER NOT NULL,
  "metricsJson" TEXT NOT NULL, "sessionPeak" INTEGER, "workerPeak" INTEGER, "safeLimitMin" INTEGER,
  "worstState" TEXT NOT NULL, "policyVersionsJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CapacityRollup_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "CapacityHostProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CapacityRollup_hostProfileId_granularity_bucketStart_key" ON "CapacityRollup"("hostProfileId", "granularity", "bucketStart");

CREATE TABLE "CapacityEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "hostProfileId" TEXT NOT NULL, "type" TEXT NOT NULL,
  "occurredAt" DATETIME NOT NULL, "source" TEXT NOT NULL, "severity" TEXT NOT NULL, "title" TEXT NOT NULL,
  "detailsJson" TEXT NOT NULL DEFAULT '{}', "dedupeKey" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapacityEvent_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "CapacityHostProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CapacityEvent_dedupeKey_key" ON "CapacityEvent"("dedupeKey");
CREATE INDEX "CapacityEvent_hostProfileId_occurredAt_idx" ON "CapacityEvent"("hostProfileId", "occurredAt");
CREATE INDEX "CapacityEvent_type_occurredAt_idx" ON "CapacityEvent"("type", "occurredAt");

CREATE TABLE "CapacityAlert" (
  "id" TEXT NOT NULL PRIMARY KEY, "hostProfileId" TEXT NOT NULL, "type" TEXT NOT NULL, "status" TEXT NOT NULL,
  "severity" TEXT NOT NULL, "conditionKey" TEXT NOT NULL, "firstObservedAt" DATETIME NOT NULL,
  "lastObservedAt" DATETIME NOT NULL, "consecutiveBreaches" INTEGER NOT NULL DEFAULT 0,
  "consecutiveRecoveries" INTEGER NOT NULL DEFAULT 0, "lastNotifiedAt" DATETIME, "recoveredAt" DATETIME,
  "observedValuesJson" TEXT NOT NULL DEFAULT '{}', "recommendation" TEXT NOT NULL, "policyVersion" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CapacityAlert_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "CapacityHostProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CapacityAlert_conditionKey_key" ON "CapacityAlert"("conditionKey");
CREATE INDEX "CapacityAlert_hostProfileId_status_lastObservedAt_idx" ON "CapacityAlert"("hostProfileId", "status", "lastObservedAt");
CREATE INDEX "CapacityAlert_type_status_idx" ON "CapacityAlert"("type", "status");
