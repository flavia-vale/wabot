#!/usr/bin/env bash
set -euo pipefail

# P2.2 - Consistency check between SQLite (source) and Postgres (target)
# Requires sqlite3, psql and envs:
#   SQLITE_DB_PATH
#   PG_URL
# Optional:
#   STRICT=1 to fail on any diff

SQLITE_DB_PATH="${SQLITE_DB_PATH:-}"
PG_URL="${PG_URL:-}"
STRICT="${STRICT:-0}"

if [[ -z "$SQLITE_DB_PATH" || ! -f "$SQLITE_DB_PATH" ]]; then
  echo "ERRO: SQLITE_DB_PATH inválido"
  exit 2
fi
if [[ -z "$PG_URL" ]]; then
  echo "ERRO: PG_URL obrigatório"
  exit 2
fi

need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "ERRO: comando '$1' não encontrado"; exit 2; }; }
need_cmd sqlite3
need_cmd psql
need_cmd node

tables=(
  User WaSession Group Credential Payment BotConfig
  MessageLog AnalyticsEvent AffiliateClick WebhookEvent FollowLog
)

echo "table,sqlite_count,pg_count,diff"
has_diff=0
for t in "${tables[@]}"; do
  s=$(sqlite3 "$SQLITE_DB_PATH" "SELECT COUNT(*) FROM '$t';" 2>/dev/null || echo "ERR")
  p=$(psql "$PG_URL" -Atc "SELECT COUNT(*) FROM \"$t\";" 2>/dev/null || echo "ERR")
  if [[ "$s" == "ERR" || "$p" == "ERR" ]]; then
    echo "$t,$s,$p,ERR"
    has_diff=1
    continue
  fi
  d=$((p - s))
  echo "$t,$s,$p,$d"
  [[ "$d" -ne 0 ]] && has_diff=1
done

# Financial checksum sanity (Payment.amount approved last 30d)
sqlite_sum=$(sqlite3 "$SQLITE_DB_PATH" "SELECT COALESCE(SUM(amount),0) FROM Payment WHERE status='approved' AND createdAt >= datetime('now','-30 day');" 2>/dev/null || echo "ERR")
pg_sum=$(psql "$PG_URL" -Atc "SELECT COALESCE(SUM(amount),0) FROM \"Payment\" WHERE status='approved' AND \"createdAt\" >= NOW() - INTERVAL '30 day';" 2>/dev/null || echo "ERR")
echo "payment_approved_30d_sum,$sqlite_sum,$pg_sum,na"
if [[ "$sqlite_sum" != "$pg_sum" ]]; then has_diff=1; fi

if [[ "$STRICT" == "1" && "$has_diff" -eq 1 ]]; then
  echo "CONSISTENCY=FAIL"
  exit 1
fi

echo "CONSISTENCY=$([[ $has_diff -eq 0 ]] && echo OK || echo WARN)"
