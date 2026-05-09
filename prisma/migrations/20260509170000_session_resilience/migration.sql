-- Add resilience/health metadata to WaSession
ALTER TABLE "WaSession" ADD COLUMN "lifecycle" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "WaSession" ADD COLUMN "ownerInstance" TEXT;
ALTER TABLE "WaSession" ADD COLUMN "lastHeartbeatAt" DATETIME;
ALTER TABLE "WaSession" ADD COLUMN "lastDisconnectCode" TEXT;

CREATE INDEX "WaSession_status_lastHeartbeatAt_idx" ON "WaSession"("status", "lastHeartbeatAt");
