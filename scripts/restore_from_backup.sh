#!/usr/bin/env bash
#
# Restore from backup — restauração CONSERVADORA do estado de produção
# a partir de um arquivo gerado por backup_prod.sh.
#
# OPERAÇÃO DESTRUTIVA. Por isso:
#  1. Exige --confirm explícito.
#  2. Faz pre-backup do estado atual ANTES de tocar em qualquer arquivo.
#  3. Verifica integridade do arquivo antes de extrair.
#  4. Para PM2 antes (`api`, `bot-supervisor`) e religa no final.
#
# Uso:
#   restore_from_backup.sh <archive.tar.gz> --confirm
#
# Variáveis:
#   PROD_DIR              default: /home/deploy/wabot
#   PROD_DB               default: $PROD_DIR/prisma/prod.db
#   AUTH_INFO_DIR         default: /home/deploy/BOTinho-shared/auth_info
#   RESTORE_ENV           1 = sobrescreve .env do destino com o do backup
#                         (default: 1 — em DR full é o que você quer)
#   SKIP_PM2              1 = não tenta parar/iniciar PM2 (default: 0)
#   PM2_APPS              apps a parar/reiniciar (default: "api bot-supervisor")

set -euo pipefail

ARCHIVE="${1:-}"
CONFIRM="${2:-}"

if [[ -z "$ARCHIVE" || "$CONFIRM" != "--confirm" ]]; then
  cat <<EOF
Uso: $0 <archive.tar.gz> --confirm

Operação destrutiva. Releia o arquivo antes:
  $0 /home/deploy/wabot-backups/wabot-prod-20260601-060000.tar.gz --confirm
EOF
  exit 2
fi

PROD_DIR="${PROD_DIR:-/home/deploy/wabot}"
PROD_DB="${PROD_DB:-$PROD_DIR/prisma/prod.db}"
AUTH_INFO_DIR="${AUTH_INFO_DIR:-/home/deploy/BOTinho-shared/auth_info}"
ROOT_ENV_FILE="${ROOT_ENV_FILE:-$PROD_DIR/.env}"
DASHBOARD_ENV_FILE="${DASHBOARD_ENV_FILE:-$PROD_DIR/dashboard/.env.local}"
RESTORE_ENV="${RESTORE_ENV:-1}"
SKIP_PM2="${SKIP_PM2:-0}"
PM2_APPS="${PM2_APPS:-api bot-supervisor}"

log() { echo "[restore $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
fail() { log "FALHA: $*"; exit 1; }

[[ -f "$ARCHIVE" ]] || fail "arquivo não existe: $ARCHIVE"
command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 não instalado"
command -v tar >/dev/null 2>&1 || fail "tar não disponível"

# 1) Verificação prévia (mesmos checks do verify_backup.sh, mas sem rodar
# script externo para manter atomicidade desta ferramenta).
tmp_extract="$(mktemp -d -t wabot-restore-XXXXXXXX)"
trap 'rm -rf "$tmp_extract"' EXIT
log "Extraindo para $tmp_extract"
tar -xzf "$ARCHIVE" -C "$tmp_extract" || fail "tar extract falhou"

[[ -f "$tmp_extract/prod.db" ]] || fail "prod.db ausente no archive"
integrity="$(sqlite3 "$tmp_extract/prod.db" "PRAGMA integrity_check;" | head -n 1)"
[[ "$integrity" == "ok" ]] || fail "prod.db corrompido (integrity_check=$integrity)"
user_count="$(sqlite3 "$tmp_extract/prod.db" "SELECT COUNT(*) FROM User;" 2>/dev/null || echo 0)"
log "Archive OK: integrity=ok, User.count=$user_count"

if [[ "$RESTORE_ENV" == "1" && ! -f "$tmp_extract/env/root.env" ]]; then
  fail "RESTORE_ENV=1 mas env/root.env não está no archive (use RESTORE_ENV=0 ou um backup mais novo)"
fi

# 2) Pre-backup do estado atual — barato e crítico.
ts="$(date -u +%Y%m%d-%H%M%S)"
pre_backup_dir="/tmp/wabot-pre-restore-$ts"
mkdir -p "$pre_backup_dir"
log "Pre-backup do estado atual em $pre_backup_dir"
if [[ -f "$PROD_DB" ]]; then
  cp -a "$PROD_DB" "$pre_backup_dir/prod.db.before-restore"
fi
if [[ -d "$AUTH_INFO_DIR" ]]; then
  tar -czf "$pre_backup_dir/auth_info.before-restore.tar.gz" -C "$(dirname "$AUTH_INFO_DIR")" "$(basename "$AUTH_INFO_DIR")"
fi
if [[ -f "$ROOT_ENV_FILE" ]]; then
  cp -a "$ROOT_ENV_FILE" "$pre_backup_dir/root.env.before-restore"
fi
if [[ -f "$DASHBOARD_ENV_FILE" ]]; then
  cp -a "$DASHBOARD_ENV_FILE" "$pre_backup_dir/dashboard.env.local.before-restore"
fi
log "Pre-backup OK"

# 3) Para PM2 (opcional)
if [[ "$SKIP_PM2" != "1" ]] && command -v pm2 >/dev/null 2>&1; then
  for app in $PM2_APPS; do
    if pm2 describe "$app" >/dev/null 2>&1; then
      log "pm2 stop $app"
      pm2 stop "$app" >/dev/null
    fi
  done
fi

# 4) Restore propriamente dito
log "Restaurando prod.db"
mkdir -p "$(dirname "$PROD_DB")"
cp -a "$tmp_extract/prod.db" "$PROD_DB"

if [[ -d "$tmp_extract/auth_info" ]]; then
  log "Restaurando auth_info"
  rm -rf "$AUTH_INFO_DIR"
  cp -a "$tmp_extract/auth_info" "$AUTH_INFO_DIR"
else
  log "Aviso: archive sem auth_info — preservando atual"
fi

if [[ "$RESTORE_ENV" == "1" ]]; then
  if [[ -f "$tmp_extract/env/root.env" ]]; then
    log "Restaurando root .env"
    cp -a "$tmp_extract/env/root.env" "$ROOT_ENV_FILE"
    chmod 600 "$ROOT_ENV_FILE"
  fi
  if [[ -f "$tmp_extract/env/dashboard.env.local" ]]; then
    log "Restaurando dashboard .env.local"
    mkdir -p "$(dirname "$DASHBOARD_ENV_FILE")"
    cp -a "$tmp_extract/env/dashboard.env.local" "$DASHBOARD_ENV_FILE"
    chmod 600 "$DASHBOARD_ENV_FILE"
  fi
fi

# 5) Religa PM2
if [[ "$SKIP_PM2" != "1" ]] && command -v pm2 >/dev/null 2>&1; then
  for app in $PM2_APPS; do
    if pm2 describe "$app" >/dev/null 2>&1; then
      log "pm2 start $app"
      pm2 start "$app" --update-env >/dev/null
    fi
  done
fi

log "Restore concluído com sucesso."
log "Pre-backup do estado anterior (preservar até validar): $pre_backup_dir"
log "Verifique manualmente:"
log "  - dashboard carrega?"
log "  - usuários conseguem login?"
log "  - sessões WhatsApp reconectaram?"
log "Se algo estiver errado, restaure de volta com:"
log "  cp $pre_backup_dir/prod.db.before-restore $PROD_DB"
log "  (e auth_info / .env conforme necessário)"
