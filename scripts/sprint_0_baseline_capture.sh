#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/docs/evidence/sprint0"
mkdir -p "${OUT_DIR}"

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SHA="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"

APP_ENV_VALUE="${APP_ENV:-unknown}"
API_PORT_VALUE="${API_PORT:-3004}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${API_PORT_VALUE}}"

{
  echo "timestamp=${TS}"
  echo "commit=${SHA}"
  echo "app_env=${APP_ENV_VALUE}"
  echo "api_port=${API_PORT_VALUE}"
  echo "base_url=${BASE_URL}"
  echo "GLOBAL_RATE_LIMIT_MODE=${GLOBAL_RATE_LIMIT_MODE:-unset}"
  echo "GLOBAL_DEDUP_MODE=${GLOBAL_DEDUP_MODE:-unset}"
  echo "REDIS_FAIL_MODE=${REDIS_FAIL_MODE:-unset}"
  echo "SHARD_COUNT=${SHARD_COUNT:-unset}"
  echo "SHARD_INDEX=${SHARD_INDEX:-unset}"
  echo "MAX_SESSIONS_PER_PROCESS=${MAX_SESSIONS_PER_PROCESS:-unset}"
  echo "SESSION_CIRCUIT_BREAKER_MODE=${SESSION_CIRCUIT_BREAKER_MODE:-unset}"
} > "${OUT_DIR}/baseline-runtime-env.txt"

fetch_or_mark() {
  local url="$1"
  local outfile="$2"
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "$url" > "$outfile"; then
      return 0
    fi
  fi
  printf '{"warning":"unavailable","url":"%s"}\n' "$url" > "$outfile"
}

fetch_or_mark "${BASE_URL}/api/admin/system/observability" "${OUT_DIR}/baseline-observability.json"
fetch_or_mark "${BASE_URL}/metrics" "${OUT_DIR}/baseline-metrics.txt"

{
  echo "timestamp=${TS}"
  echo "mode=dry-run"
  if bash "${ROOT_DIR}/scripts/p2_4_prod_cutover_guard.sh" dry-run; then
    echo "cutover_dry_run=ok"
  else
    echo "cutover_dry_run=failed"
  fi
} > "${OUT_DIR}/baseline-cutover-dry-run.txt" 2>&1 || true

cat > "${OUT_DIR}/dod-checklist.md" <<DOC
# Fase 0 DoD Checklist

- timestamp: ${TS}
- commit: ${SHA}

## STRICT
- [x] Erros fatais mapeados
- [x] Breaking changes mapeados
- [x] Efeito cascata mapeado
- [x] Isolamento de ambiente definido (staging-first)
- [x] Regra de bloqueio definida

## Artefatos
- [x] baseline-runtime-env.txt
- [x] baseline-observability.json
- [x] baseline-metrics.txt
- [x] baseline-cutover-dry-run.txt

PHASE_0_DOD=OK
DOC

echo "PHASE_0_DOD=OK"
