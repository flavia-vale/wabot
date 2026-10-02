#!/usr/bin/env bash
set -euo pipefail

# P3.1 checklist runner for API stateless + LB readiness

echo "[P3.1] API scale-out readiness"
echo "- revocation store supports Redis-backed mode (REVOCATION_STORE_MODE=auto + REDIS_URL)"
echo "- health/readiness endpoints available"
echo "- run at least 2 API replicas behind LB"
echo "- verify login/logout/revoked token behavior across replicas"
echo "- verify no sticky-session requirement"
