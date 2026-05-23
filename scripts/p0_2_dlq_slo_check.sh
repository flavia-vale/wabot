#!/usr/bin/env bash
set -euo pipefail

# P0.2 - DLQ SLO checker
# Uses admin endpoints to evaluate warning/critical conditions.
#
# Example:
#   API_BASE_URL=http://127.0.0.1:3004 ADMIN_TOKEN=... USER_IDS=u1,u2 bash scripts/p0_2_dlq_slo_check.sh

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3004}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
USER_IDS="${USER_IDS:-}"
WARNING_OPEN_JOBS="${WARNING_OPEN_JOBS:-1}"
WARNING_AGE_MIN="${WARNING_AGE_MIN:-10}"
CRITICAL_OPEN_JOBS="${CRITICAL_OPEN_JOBS:-20}"
CRITICAL_AGE_MIN="${CRITICAL_AGE_MIN:-30}"

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "ERRO: defina ADMIN_TOKEN"
  exit 2
fi
if [[ -z "$USER_IDS" ]]; then
  echo "ERRO: defina USER_IDS (csv)"
  exit 2
fi

IFS=',' read -r -a IDS <<< "$USER_IDS"
now_s=$(date +%s)
warn=0
crit=0

for uid in "${IDS[@]}"; do
  uid_trim=$(echo "$uid" | xargs)
  [[ -z "$uid_trim" ]] && continue

  payload=$(curl -fsS -H "Authorization: Bearer ${ADMIN_TOKEN}" "${API_BASE_URL%/}/api/admin/send-dlq/${uid_trim}?limit=200")
  total=$(echo "$payload" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.total||0)})")

  oldest_age_min=0
  if [[ "$total" -gt 0 ]]; then
    oldest_ms=$(echo "$payload" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);const arr=Array.isArray(j.jobs)?j.jobs:[];const vals=arr.map(x=>Number(x.failedAt||0)).filter(Boolean);if(!vals.length){console.log(0);return;}console.log(Math.min(...vals));})")
    if [[ "$oldest_ms" -gt 0 ]]; then
      oldest_age_min=$(( (now_s - oldest_ms/1000) / 60 ))
    fi
  fi

  status="ok"
  if [[ "$total" -ge "$CRITICAL_OPEN_JOBS" || "$oldest_age_min" -ge "$CRITICAL_AGE_MIN" ]]; then
    status="critical"
    crit=$((crit+1))
  elif [[ "$total" -ge "$WARNING_OPEN_JOBS" && "$oldest_age_min" -ge "$WARNING_AGE_MIN" ]]; then
    status="warning"
    warn=$((warn+1))
  fi

  echo "user=${uid_trim} total=${total} oldest_age_min=${oldest_age_min} status=${status}"
done

if [[ "$crit" -gt 0 ]]; then
  echo "DLQ_SLO=CRITICAL"
  exit 1
fi
if [[ "$warn" -gt 0 ]]; then
  echo "DLQ_SLO=WARNING"
  exit 0
fi

echo "DLQ_SLO=OK"
