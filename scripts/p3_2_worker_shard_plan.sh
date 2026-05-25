#!/usr/bin/env bash
set -euo pipefail

SHARD_COUNT="${SHARD_COUNT:-2}"
APP_PREFIX="${APP_PREFIX:-bot-supervisor}"

echo "[P3.2] Worker sharding rollout plan"
echo "- shard count: $SHARD_COUNT"
for i in $(seq 0 $((SHARD_COUNT-1))); do
  echo "  pm2 start ecosystem.config.cjs --only ${APP_PREFIX} -- --shard-index=${i} --shard-count=${SHARD_COUNT}"
done

echo
echo "Validation checklist"
echo "1) Session ownership is stable across restarts (same userId => same shard)"
echo "2) No duplicate active worker for same userId"
echo "3) Restart one shard: sessions on other shards stay connected"
echo "4) Observe queue depth and reconnect spikes for 30min soak"
