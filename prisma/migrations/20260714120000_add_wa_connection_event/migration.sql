-- CreateTable
CREATE TABLE "WaConnectionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "lifecycle" TEXT,
    "ownerInstance" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaConnectionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WaConnectionEvent_userId_occurredAt_idx" ON "WaConnectionEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "WaConnectionEvent_type_occurredAt_idx" ON "WaConnectionEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "WaConnectionEvent_occurredAt_idx" ON "WaConnectionEvent"("occurredAt");
