#!/usr/bin/env bash
set -euo pipefail

# P2.3 orchestrator (plan/checklist runner)
# This script does not mutate production data; it prints/validates required steps.

echo "[P2.3] Event trail split checklist"
echo "1) Create event schema/database in Postgres"
echo "2) Create Prisma schema for events writer"
echo "3) Enable dual-write for MessageLog/AnalyticsEvent/AffiliateClick/WebhookEvent/FollowLog"
echo "4) Run backfill from OLTP -> events store"
echo "5) Reconcile counts/checksum"
echo "6) Switch reads (if needed) to events store"
echo "7) Keep rollback flag to single-write OLTP"
echo ""
echo "Required gates:"
echo "- No critical API 5xx increase"
echo "- No event-loss in 24h soak"
echo "- Reconciliation diff == 0 for key tables"
