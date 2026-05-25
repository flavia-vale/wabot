#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/wabot-staging}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
APP_ENV="${APP_ENV:-staging}"

[[ -f "$ENV_FILE" ]] || { echo "ERRO: .env não encontrado em $ENV_FILE"; exit 1; }

echo "[Sprint A] Validando matriz de guardrails em $APP_ENV"

extract() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d'=' -f2- || true
}

GRL_MODE="$(extract GLOBAL_RATE_LIMIT_MODE)"
GDD_MODE="$(extract GLOBAL_DEDUP_MODE)"
RFMODE="$(extract REDIS_FAIL_MODE)"
SHARD_COUNT="$(extract SHARD_COUNT)"
SHARD_INDEX="$(extract SHARD_INDEX)"
MAX_SESSIONS="$(extract MAX_SESSIONS_PER_PROCESS)"
CB_MODE="$(extract SESSION_CIRCUIT_BREAKER_MODE)"

: "${GRL_MODE:=auto}"
: "${GDD_MODE:=auto}"
: "${RFMODE:=open}"
: "${SHARD_COUNT:=1}"
: "${SHARD_INDEX:=0}"
: "${MAX_SESSIONS:=200}"
: "${CB_MODE:=closed}"

[[ "$GRL_MODE" =~ ^(auto|on|off)$ ]] || { echo "ERRO: GLOBAL_RATE_LIMIT_MODE inválido: $GRL_MODE"; exit 1; }
[[ "$GDD_MODE" =~ ^(auto|on|off)$ ]] || { echo "ERRO: GLOBAL_DEDUP_MODE inválido: $GDD_MODE"; exit 1; }
[[ "$RFMODE" =~ ^(open|closed)$ ]] || { echo "ERRO: REDIS_FAIL_MODE inválido: $RFMODE"; exit 1; }
[[ "$CB_MODE" =~ ^(open|closed)$ ]] || { echo "ERRO: SESSION_CIRCUIT_BREAKER_MODE inválido: $CB_MODE"; exit 1; }

if ! [[ "$SHARD_COUNT" =~ ^[0-9]+$ ]] || ! [[ "$SHARD_INDEX" =~ ^[0-9]+$ ]]; then
  echo "ERRO: SHARD_COUNT/SHARD_INDEX devem ser inteiros"
  exit 1
fi

if (( SHARD_COUNT < 1 )); then
  echo "ERRO: SHARD_COUNT deve ser >= 1"
  exit 1
fi
if (( SHARD_INDEX < 0 || SHARD_INDEX >= SHARD_COUNT )); then
  echo "ERRO: SHARD_INDEX fora do intervalo [0, SHARD_COUNT)"
  exit 1
fi

if ! [[ "$MAX_SESSIONS" =~ ^[0-9]+$ ]] || (( MAX_SESSIONS < 1 )); then
  echo "ERRO: MAX_SESSIONS_PER_PROCESS deve ser inteiro >= 1"
  exit 1
fi

echo "OK: matriz de guardrails válida"
echo "  GLOBAL_RATE_LIMIT_MODE=$GRL_MODE"
echo "  GLOBAL_DEDUP_MODE=$GDD_MODE"
echo "  REDIS_FAIL_MODE=$RFMODE"
echo "  SHARD_COUNT=$SHARD_COUNT"
echo "  SHARD_INDEX=$SHARD_INDEX"
echo "  MAX_SESSIONS_PER_PROCESS=$MAX_SESSIONS"
echo "  SESSION_CIRCUIT_BREAKER_MODE=$CB_MODE"
