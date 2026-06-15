#!/usr/bin/env bash
#
# Healthcheck com alertas — roda via cron (a cada 5 min) no VPS e notifica
# quando algo crítico degrada. Complementa (não substitui) um uptime monitor
# EXTERNO: se o VPS inteiro cair, este script cai junto.
#
# Checks:
#   1. Disco: espaço livre mínimo em % (DISK_MIN_FREE_PCT, default 20)
#   2. Backup: BACKUP_DIR/last_success.txt mais novo que BACKUP_MAX_AGE_HOURS (26)
#   3. PM2: todos os apps em PM2_APPS online
#   4. API: GET API_HEALTH_URL responde 200
#
# Notificação (configure pelo menos um):
#   ALERT_TELEGRAM_BOT_TOKEN + ALERT_TELEGRAM_CHAT_ID  -> sendMessage
#   ALERT_WEBHOOK_URL                                   -> POST JSON {"text": ...}
#
# Dedupe: só re-alerta o MESMO conjunto de falhas após ALERT_REMIND_HOURS (6).
# Recuperação: quando tudo volta ao normal após um alerta, envia "recuperado".
#
# Cron sugerido:
#   */5 * * * * /home/deploy/wabot/scripts/healthcheck_alerts.sh >> /home/deploy/wabot-backups/healthcheck.log 2>&1

set -uo pipefail

DISK_PATH="${DISK_PATH:-/}"
DISK_MIN_FREE_PCT="${DISK_MIN_FREE_PCT:-20}"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/wabot-backups}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"
# PM2_APPS="" (vazio explícito) pula o check de PM2
PM2_APPS="${PM2_APPS-api dashboard bot-supervisor}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:3001/health}"
ALERT_TELEGRAM_BOT_TOKEN="${ALERT_TELEGRAM_BOT_TOKEN:-}"
ALERT_TELEGRAM_CHAT_ID="${ALERT_TELEGRAM_CHAT_ID:-}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
ALERT_REMIND_HOURS="${ALERT_REMIND_HOURS:-6}"
STATE_FILE="${STATE_FILE:-/tmp/wabot-healthcheck-state}"

log() { echo "[healthcheck $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

failures=()

# 1) Disco
disk_used_pct="$(df -P "$DISK_PATH" | awk 'NR==2 {gsub("%",""); print $5}')"
if [[ -n "$disk_used_pct" ]]; then
  disk_free_pct=$((100 - disk_used_pct))
  if (( disk_free_pct < DISK_MIN_FREE_PCT )); then
    failures+=("DISCO: apenas ${disk_free_pct}% livre em $DISK_PATH (mínimo ${DISK_MIN_FREE_PCT}%)")
  fi
else
  failures+=("DISCO: não consegui medir $DISK_PATH")
fi

# 2) Backup recente (marcador gravado pelo backup_prod.sh)
marker="$BACKUP_DIR/last_success.txt"
if [[ -f "$marker" ]]; then
  age_hours=$(( ( $(date +%s) - $(stat -c %Y "$marker") ) / 3600 ))
  if (( age_hours > BACKUP_MAX_AGE_HOURS )); then
    failures+=("BACKUP: último sucesso há ${age_hours}h (limite ${BACKUP_MAX_AGE_HOURS}h) — cron parado ou backup falhando")
  fi
else
  failures+=("BACKUP: $marker não existe — backup nunca rodou nesta configuração")
fi

# 3) PM2 apps online (PM2_APPS vazio pula o check — útil em staging parcial)
if [[ -z "${PM2_APPS// /}" ]]; then
  :
elif command -v pm2 >/dev/null 2>&1; then
  for app in $PM2_APPS; do
    status="$(pm2 jlist 2>/dev/null | node -e '
      let raw = ""
      process.stdin.on("data", (c) => { raw += c })
      process.stdin.on("end", () => {
        try {
          const apps = JSON.parse(raw)
          const found = apps.find((a) => a.name === process.argv[1])
          console.log(found ? found.pm2_env.status : "missing")
        } catch { console.log("unknown") }
      })
    ' "$app" 2>/dev/null || echo unknown)"
    if [[ "$status" != "online" ]]; then
      failures+=("PM2: app '$app' está '$status' (esperado: online)")
    fi
  done
else
  failures+=("PM2: comando pm2 não encontrado")
fi

# 4) API health
http_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$API_HEALTH_URL" || true)"
http_code="${http_code:-000}"
if [[ "$http_code" != "200" ]]; then
  failures+=("API: $API_HEALTH_URL respondeu $http_code (esperado 200)")
fi

send_notification() {
  local text="$1"
  local sent=0
  if [[ -n "$ALERT_TELEGRAM_BOT_TOKEN" && -n "$ALERT_TELEGRAM_CHAT_ID" ]]; then
    curl -s --max-time 15 -X POST "https://api.telegram.org/bot${ALERT_TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${ALERT_TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=${text}" >/dev/null && sent=1
  fi
  if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
    payload="$(node -e 'console.log(JSON.stringify({ text: process.argv[1] }))' "$text" 2>/dev/null || printf '{"text":"healthcheck alert (payload encode failed)"}')"
    curl -s --max-time 15 -X POST -H 'content-type: application/json' -d "$payload" "$ALERT_WEBHOOK_URL" >/dev/null && sent=1
  fi
  if (( sent == 0 )); then
    log "AVISO: nenhuma notificação configurada/entregue (ALERT_TELEGRAM_* ou ALERT_WEBHOOK_URL)"
  fi
}

now_epoch="$(date +%s)"
prev_hash=""
prev_at=0
if [[ -f "$STATE_FILE" ]]; then
  prev_hash="$(sed -n 1p "$STATE_FILE")"
  prev_at="$(sed -n 2p "$STATE_FILE")"
  [[ "$prev_at" =~ ^[0-9]+$ ]] || prev_at=0
fi

if (( ${#failures[@]} == 0 )); then
  log "OK — todos os checks passaram"
  if [[ -n "$prev_hash" && "$prev_hash" != "ok" ]]; then
    send_notification "✅ wabot $(hostname): sistema recuperado — todos os checks voltaram a passar."
  fi
  printf 'ok\n%s\n' "$now_epoch" > "$STATE_FILE"
  exit 0
fi

message="🚨 wabot $(hostname) — ${#failures[@]} problema(s):"
for f in "${failures[@]}"; do
  message+=$'\n'"- $f"
  log "FALHA: $f"
done

current_hash="$(printf '%s' "${failures[*]}" | sha256sum | cut -d' ' -f1)"
remind_seconds=$(( ALERT_REMIND_HOURS * 3600 ))
if [[ "$current_hash" == "$prev_hash" ]] && (( now_epoch - prev_at < remind_seconds )); then
  log "Alerta suprimido (mesmas falhas já notificadas há menos de ${ALERT_REMIND_HOURS}h)"
else
  send_notification "$message"
  printf '%s\n%s\n' "$current_hash" "$now_epoch" > "$STATE_FILE"
fi

exit 1
