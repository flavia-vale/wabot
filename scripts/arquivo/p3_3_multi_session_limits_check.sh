#!/usr/bin/env bash
set -euo pipefail

echo "[P3.3] Multi-session guardrails checklist"
echo "- enforce destination rate limits from centralized state (Redis)"
echo "- keep dedup window global across workers"
echo "- cap max sessions per worker process"
echo "- track per-destination send errors and throttle automatically"
echo "- run staged load test before production"
