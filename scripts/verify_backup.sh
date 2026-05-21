#!/usr/bin/env bash
#
# Verify backup — testa que o tar.gz gerado por backup_prod.sh está íntegro
# e restaurável, SEM tocar em prod. Pode rodar via cron logo após o
# backup, ou ad-hoc.
#
# Uso:
#   verify_backup.sh                           # verifica o backup mais recente em BACKUP_DIR
#   verify_backup.sh /caminho/arquivo.tar.gz   # verifica um arquivo específico
#
# Variáveis:
#   BACKUP_DIR              default: /home/deploy/wabot-backups
#   MIN_USER_COUNT          contagem mínima de User para considerar válido (default: 1)
#   MIN_AUTH_FILES          arquivos mínimos em auth_info para considerar válido (default: 0
#                           — staging pode não ter sessão ativa; em prod, suba para 1)
#   REQUIRE_ENV_FILES       1 = exige env/root.env presente (default: 1)
#   MAX_AGE_HOURS           backup mais recente até X horas (default: 26 — cobre diário)
#
# Saída: 0 = ok, !=0 = falha (com log explicativo).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/deploy/wabot-backups}"
MIN_USER_COUNT="${MIN_USER_COUNT:-1}"
MIN_AUTH_FILES="${MIN_AUTH_FILES:-0}"
REQUIRE_ENV_FILES="${REQUIRE_ENV_FILES:-1}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-26}"

log() { echo "[verify_backup $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
fail() { log "FALHA: $*"; exit 1; }

command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 não instalado"
command -v tar >/dev/null 2>&1 || fail "tar não disponível"

# Determina arquivo alvo
if [[ $# -ge 1 ]]; then
  archive="$1"
else
  [[ -d "$BACKUP_DIR" ]] || fail "BACKUP_DIR não existe: $BACKUP_DIR"
  archive="$(ls -t "$BACKUP_DIR"/wabot-prod-*.tar.gz 2>/dev/null | head -n 1 || true)"
  [[ -n "$archive" ]] || fail "Nenhum wabot-prod-*.tar.gz encontrado em $BACKUP_DIR"
fi
[[ -f "$archive" ]] || fail "Arquivo não existe: $archive"

log "Verificando: $archive"

# Idade do backup (skip se MAX_AGE_HOURS=0)
if [[ "$MAX_AGE_HOURS" != "0" ]]; then
  age_seconds=$(( $(date +%s) - $(stat -c %Y "$archive") ))
  age_hours=$(( age_seconds / 3600 ))
  if (( age_hours > MAX_AGE_HOURS )); then
    fail "backup tem ${age_hours}h (limite: ${MAX_AGE_HOURS}h) — cron não está rodando?"
  fi
  log "Idade OK (${age_hours}h)"
fi

# Extrai para tmp e roda checks
tmp_dir="$(mktemp -d -t wabot-verify-XXXXXXXX)"
trap 'rm -rf "$tmp_dir"' EXIT

tar -xzf "$archive" -C "$tmp_dir" \
  || fail "tar -xzf falhou — arquivo corrompido"

# 1) manifest.json deve existir (backup_prod.sh com .env-aware grava ele)
if [[ ! -f "$tmp_dir/manifest.json" ]]; then
  log "Aviso: manifest.json ausente — backup gerado por versão antiga do script"
fi

# 2) prod.db deve existir e passar integrity_check
db_file="$tmp_dir/prod.db"
[[ -f "$db_file" ]] || fail "prod.db ausente no tarball"
integrity="$(sqlite3 "$db_file" "PRAGMA integrity_check;" | head -n 1)"
[[ "$integrity" == "ok" ]] || fail "PRAGMA integrity_check retornou: $integrity"
log "integrity_check OK"

# 3) Schema check: tabelas esperadas existem
for table in User WaSession AdminAuditLog; do
  exists="$(sqlite3 "$db_file" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';")"
  [[ "$exists" == "$table" ]] || fail "tabela $table ausente — schema corrompido ou banco vazio"
done
log "schema OK (User, WaSession, AdminAuditLog presentes)"

# 4) Contagem de User
user_count="$(sqlite3 "$db_file" "SELECT COUNT(*) FROM User;")"
if (( user_count < MIN_USER_COUNT )); then
  fail "User.count=$user_count < MIN_USER_COUNT=$MIN_USER_COUNT (banco vazio?)"
fi
log "User.count=$user_count OK"

# 5) auth_info
if [[ "$MIN_AUTH_FILES" -gt 0 ]]; then
  if [[ ! -d "$tmp_dir/auth_info" ]]; then
    fail "auth_info/ ausente mas MIN_AUTH_FILES=$MIN_AUTH_FILES"
  fi
  auth_count="$(find "$tmp_dir/auth_info" -type f | wc -l)"
  if (( auth_count < MIN_AUTH_FILES )); then
    fail "auth_info tem $auth_count arquivos, mínimo é $MIN_AUTH_FILES"
  fi
  log "auth_info OK ($auth_count arquivos)"
fi

# 6) .env presentes
if [[ "$REQUIRE_ENV_FILES" == "1" ]]; then
  if [[ ! -f "$tmp_dir/env/root.env" ]]; then
    fail "env/root.env ausente — backup não recuperável em DR full"
  fi
  # Sanity: JWT_SECRET tem que estar no root.env (ou senão API não sobe)
  if ! grep -q "^JWT_SECRET" "$tmp_dir/env/root.env"; then
    fail "JWT_SECRET ausente em env/root.env"
  fi
  log "env/root.env OK (JWT_SECRET presente)"
fi

log "OK — backup íntegro e restaurável: $archive"
