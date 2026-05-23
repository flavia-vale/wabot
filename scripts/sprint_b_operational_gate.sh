#!/usr/bin/env bash
set -euo pipefail

# Sprint B: governança operacional + gate de promoção
# Uso (staging):
#   DASHBOARD_BASE_URL=http://178.105.54.0:3006 \
#   API_BASE_URL=http://127.0.0.1:3004 \
#   bash scripts/sprint_b_operational_gate.sh

ROOT_DIR="${ROOT_DIR:-$HOME/wabot-staging}"
DASHBOARD_BASE_URL="${DASHBOARD_BASE_URL:-http://178.105.54.0:3006}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3004}"
P3_SOAK_EVIDENCE_FILE="${P3_SOAK_EVIDENCE_FILE:-$ROOT_DIR/docs/p3-soak-evidence.md}"
P24_GUARD_SCRIPT="${P24_GUARD_SCRIPT:-$ROOT_DIR/scripts/p2_4_prod_cutover_guard.sh}"
ADMIN_BEARER_TOKEN="${ADMIN_BEARER_TOKEN:-}"

[[ -f "$P24_GUARD_SCRIPT" ]] || { echo "ERRO: script P2.4 não encontrado: $P24_GUARD_SCRIPT"; exit 1; }
[[ -f "$P3_SOAK_EVIDENCE_FILE" ]] || { echo "ERRO: evidência soak não encontrada: $P3_SOAK_EVIDENCE_FILE"; exit 1; }

echo "[Sprint B] 1/5 - Sanity de endpoints base"
curl -fsS "$DASHBOARD_BASE_URL/login" >/dev/null
curl -fsS "$API_BASE_URL/health" >/dev/null

echo "[Sprint B] 2/5 - Observability endpoint"
if [[ -n "$ADMIN_BEARER_TOKEN" ]]; then
  OBS=$(curl -fsS -H "Authorization: Bearer $ADMIN_BEARER_TOKEN" "$API_BASE_URL/api/admin/system/observability")
else
  OBS=$(curl -fsS "$API_BASE_URL/api/admin/system/observability" || true)
fi
if [[ -z "$OBS" ]]; then
  echo "ERRO: /api/admin/system/observability vazio ou indisponível"
  exit 1
fi

if echo "$OBS" | grep -q '"recommended":"no-go"'; then
  echo "NO-GO detectado no observability endpoint"
  exit 1
fi

echo "[Sprint B] 3/5 - P2.4 dry-run hard-gate"
MODE=dry-run bash "$P24_GUARD_SCRIPT"

echo "[Sprint B] 4/5 - Soak evidence preenchida"
if grep -q '____' "$P3_SOAK_EVIDENCE_FILE"; then
  echo "ERRO: p3-soak-evidence.md ainda contém placeholders '____'"
  exit 1
fi

echo "[Sprint B] 5/5 - Métricas básicas"
METRICS=$(curl -fsS "$API_BASE_URL/metrics")
echo "$METRICS" | grep -q 'wabot_api_uptime_seconds' || { echo "ERRO: métrica wabot_api_uptime_seconds ausente"; exit 1; }
echo "$METRICS" | grep -q 'wabot_api_http_5xx_total' || { echo "ERRO: métrica wabot_api_http_5xx_total ausente"; exit 1; }

echo "SPRINT_B_GATE=OK"
