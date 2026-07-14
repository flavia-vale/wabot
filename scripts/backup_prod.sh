#!/usr/bin/env bash
#
# Backup do banco SQLite de produção + auth_info (sessões WhatsApp).
# Gera um único arquivo .tar.gz timestampado em $BACKUP_DIR, faz rotação
# por idade e, se rclone estiver configurado, replica para a nuvem.
#
# Uso típico (cron, diário às 03:00 BRT = 06:00 UTC):
#   0 6 * * * /home/deploy/wabot/scripts/backup_prod.sh >> /home/deploy/wabot-backups/backup.log 2>&1
#
# Variáveis opcionais (sobrescrevem defaults):
#   PROD_DIR             Raiz do clone de produção (default: /home/deploy/wabot)
#   PROD_DB              Caminho do .db (default: $PROD_DIR/prisma/prod.db)
#   AUTH_INFO_DIR        Diretório auth_info (default: /home/deploy/BOTinho-shared/auth_info)
#   BACKUP_DIR           Onde salvar (default: /home/deploy/wabot-backups)
#   RETENTION_DAYS       Dias para guardar (default: 30)
#   BACKUP_RCLONE_REMOTE Nome:caminho do remote rclone (ex.: b2-wabot:wabot-backups).
#                        Aceita múltiplos remotes separados por vírgula (ex.:
#                        b2-wabot:wabot-backups,gdrive-wabot:wabot-backups) —
#                        sobe o mesmo arquivo pra cada um. Vazio ou rclone
#                        ausente pula a etapa de nuvem.
#   BACKUP_AGE_RECIPIENT Chave pública age (age1...) para cifrar o backup.
#                        O tarball contém .env, banco e auth_info — em texto
#                        puro ele entrega JWT_SECRET, CREDENTIAL_ENCRYPTION_KEY
#                        e controle das sessões WhatsApp de todos os clientes.
#                        A chave PRIVADA correspondente deve ficar FORA do VPS.
#   BACKUP_AGE_RECIPIENTS_FILE  Alternativa: arquivo com uma chave por linha.
#   BACKUP_REQUIRE_ENCRYPTION   1 = falha se não conseguir cifrar (recomendado
#                        em prod). Default 0 para não quebrar crons existentes
#                        antes da chave ser provisionada.
#   BACKUP_REQUIRE_CLOUD 1 = falha se o upload externo não acontecer
#                        (recomendado em prod). Default 0.

set -euo pipefail

PROD_DIR="${PROD_DIR:-/home/deploy/wabot}"
PROD_DB="${PROD_DB:-$PROD_DIR/prisma/prod.db}"
AUTH_INFO_DIR="${AUTH_INFO_DIR:-/home/deploy/BOTinho-shared/auth_info}"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/wabot-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"
BACKUP_AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"
BACKUP_AGE_RECIPIENTS_FILE="${BACKUP_AGE_RECIPIENTS_FILE:-}"
BACKUP_REQUIRE_ENCRYPTION="${BACKUP_REQUIRE_ENCRYPTION:-0}"
BACKUP_REQUIRE_CLOUD="${BACKUP_REQUIRE_CLOUD:-0}"
# .env do root e do dashboard. Backup ATÔMICO precisa incluir esses
# arquivos: sem JWT_SECRET, DATABASE_URL, etc., restaurar DB+auth_info
# em um VPS novo não traz a aplicação de volta.
INCLUDE_ENV_FILES="${INCLUDE_ENV_FILES:-1}"
ROOT_ENV_FILE="${ROOT_ENV_FILE:-$PROD_DIR/.env}"
DASHBOARD_ENV_FILE="${DASHBOARD_ENV_FILE:-$PROD_DIR/dashboard/.env.local}"

timestamp="$(date -u +%Y%m%d-%H%M%S)"
log_prefix="[backup_prod $(date -u +%Y-%m-%dT%H:%M:%SZ)]"

log() { echo "$log_prefix $*"; }
fail() { log "ERRO: $*"; exit 1; }

command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 não está instalado. Rode: sudo apt-get install -y sqlite3"
command -v tar >/dev/null 2>&1 || fail "tar não está disponível."

[[ -f "$PROD_DB" ]] || fail "Banco de produção não encontrado em $PROD_DB"
mkdir -p "$BACKUP_DIR"

stage_dir="$(mktemp -d -t wabot-backup-XXXXXXXX)"
trap 'rm -rf "$stage_dir"' EXIT

log "Iniciando backup. timestamp=$timestamp stage=$stage_dir"

# 1) Banco SQLite — usa .backup para snapshot consistente mesmo com escritas concorrentes
db_snapshot="$stage_dir/prod.db"
sqlite3 "$PROD_DB" ".backup '$db_snapshot'"
sqlite3 "$db_snapshot" "PRAGMA integrity_check;" | head -n 1 | grep -q "^ok$" \
  || fail "integrity_check do snapshot SQLite falhou."
db_bytes="$(stat -c%s "$db_snapshot")"
log "Snapshot SQLite OK ($db_bytes bytes)"

# 2) auth_info — copia recursiva preservando atributos, depois empacota
if [[ -d "$AUTH_INFO_DIR" ]]; then
  cp -a "$AUTH_INFO_DIR" "$stage_dir/auth_info"
  auth_files="$(find "$stage_dir/auth_info" -type f | wc -l)"
  log "auth_info copiado ($auth_files arquivos)"
else
  log "Aviso: $AUTH_INFO_DIR não existe — pulando auth_info"
fi

# 3) .env files — JWT_SECRET, DATABASE_URL, BOT_SUPERVISOR_MODE, REDIS_URL.
# Sem eles, restaurar em VPS novo deixa a aplicação fora do ar até o
# operador recriar manualmente (e risco de perder JWT_SECRET = invalidar
# todos os tokens emitidos). Armazenados sob env/ no tarball para que o
# layout do staging fique claro.
if [[ "$INCLUDE_ENV_FILES" == "1" ]]; then
  env_count=0
  mkdir -p "$stage_dir/env"
  if [[ -f "$ROOT_ENV_FILE" ]]; then
    cp -a "$ROOT_ENV_FILE" "$stage_dir/env/root.env"
    env_count=$((env_count+1))
  fi
  if [[ -f "$DASHBOARD_ENV_FILE" ]]; then
    cp -a "$DASHBOARD_ENV_FILE" "$stage_dir/env/dashboard.env.local"
    env_count=$((env_count+1))
  fi
  log ".env capturado ($env_count arquivos)"
else
  log "INCLUDE_ENV_FILES=0 — backup NÃO contém .env (recuperação de DR exige reconstrução manual)"
fi

# 4) Manifest com metadata úteis para verify/restore
manifest="$stage_dir/manifest.json"
cat > "$manifest" <<EOF_MANIFEST
{
  "version": 1,
  "timestamp_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "prod_db_path": "$PROD_DB",
  "auth_info_path": "$AUTH_INFO_DIR",
  "include_env_files": $INCLUDE_ENV_FILES,
  "db_bytes": $db_bytes
}
EOF_MANIFEST
log "manifest.json escrito"

# 5) Empacota tudo
archive="$BACKUP_DIR/wabot-prod-$timestamp.tar.gz"
tar -C "$stage_dir" -czf "$archive" .
chmod 600 "$archive"
archive_bytes="$(stat -c%s "$archive")"
log "Arquivo gerado: $archive ($archive_bytes bytes)"

# 6) Criptografia em repouso. Sem fallback silencioso: se a cifragem foi
# pedida e falhar em qualquer ponto, o plaintext é removido e o script aborta
# — backup ausente dispara alerta; backup em texto puro vaza segredos sem
# ninguém perceber.
if [[ -n "$BACKUP_AGE_RECIPIENT" || -n "$BACKUP_AGE_RECIPIENTS_FILE" ]]; then
  command -v age >/dev/null 2>&1 \
    || { rm -f "$archive"; fail "BACKUP_AGE_RECIPIENT definido mas 'age' não está instalado (sudo apt-get install -y age)"; }
  age_args=()
  [[ -n "$BACKUP_AGE_RECIPIENT" ]] && age_args+=(-r "$BACKUP_AGE_RECIPIENT")
  [[ -n "$BACKUP_AGE_RECIPIENTS_FILE" ]] && age_args+=(-R "$BACKUP_AGE_RECIPIENTS_FILE")
  encrypted="$archive.age"
  if ! age "${age_args[@]}" -o "$encrypted" "$archive"; then
    rm -f "$archive" "$encrypted"
    fail "cifragem com age falhou — backup abortado (plaintext removido)"
  fi
  rm -f "$archive"
  archive="$encrypted"
  chmod 600 "$archive"
  archive_bytes="$(stat -c%s "$archive")"
  log "Backup cifrado: $archive ($archive_bytes bytes)"
elif [[ "$BACKUP_REQUIRE_ENCRYPTION" == "1" ]]; then
  rm -f "$archive"
  fail "BACKUP_REQUIRE_ENCRYPTION=1 mas nenhuma chave configurada (BACKUP_AGE_RECIPIENT/BACKUP_AGE_RECIPIENTS_FILE)"
else
  log "ATENÇÃO: backup SEM criptografia — o tarball contém .env (JWT_SECRET, CREDENTIAL_ENCRYPTION_KEY) e auth_info. Configure BACKUP_AGE_RECIPIENT."
fi

# 7) Rotação local — apaga arquivos com mais de $RETENTION_DAYS dias
deleted="$(find "$BACKUP_DIR" -maxdepth 1 -name 'wabot-prod-*.tar.gz*' -type f -mtime "+$RETENTION_DAYS" -print -delete | wc -l)"
log "Rotação local concluída: $deleted arquivo(s) com mais de ${RETENTION_DAYS}d removido(s)"

# 8) Upload para nuvem. Com BACKUP_REQUIRE_CLOUD=1 (recomendado em prod),
# remote ausente/rclone faltando/upload falhando abortam o script — um VPS
# perdido sem cópia externa é perda total de banco + sessões + ledger.
if [[ -n "$BACKUP_RCLONE_REMOTE" ]]; then
  command -v rclone >/dev/null 2>&1 \
    || fail "BACKUP_RCLONE_REMOTE definido mas rclone não está instalado."
  IFS=',' read -ra rclone_remotes <<< "${BACKUP_RCLONE_REMOTE//[[:space:]]/}"
  for remote in "${rclone_remotes[@]}"; do
    [[ -z "$remote" ]] && continue
    log "Subindo para nuvem: $remote"
    rclone copy "$archive" "$remote" --no-traverse --quiet \
      || fail "upload rclone falhou para $remote — backup local existe mas cópia externa incompleta"
    # Rotação na nuvem com mesmo critério
    rclone delete "$remote" --min-age "${RETENTION_DAYS}d" --include 'wabot-prod-*.tar.gz*' --quiet || true
    log "Upload concluído: $remote"
  done
elif [[ "$BACKUP_REQUIRE_CLOUD" == "1" ]]; then
  fail "BACKUP_REQUIRE_CLOUD=1 mas BACKUP_RCLONE_REMOTE não está configurado"
else
  log "ATENÇÃO: upload externo desabilitado (BACKUP_RCLONE_REMOTE vazio) — perda do VPS = perda do backup."
fi

# 9) Marcador de sucesso para monitoramento (alerta de "backup ausente >26h"
# pode checar o mtime deste arquivo em vez de parsear logs).
printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$archive" > "$BACKUP_DIR/last_success.txt"

log "Backup finalizado com sucesso."
