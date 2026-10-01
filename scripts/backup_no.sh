#!/usr/bin/env bash
#
# Backup de UM servidor (nó) do supervisor: o login do WhatsApp (auth_info) e o
# .env DESTE servidor. Não há banco aqui — com vários servidores o banco é
# compartilhado e continua no backup do servidor principal (backup_prod.sh).
#
# POR QUE EXISTE: o login de cada conta mora no disco do servidor onde ela
# roda. Se esse servidor morrer, as contas dele ficam fora até alguém restaurar
# o login em outro servidor. Sem backup por servidor, isso é perda total.
# O backup_prod.sh NÃO é tocado (ele exige o banco SQLite e é de um host só).
#
# Uso (cron diário, em cada servidor):
#   NODE_ID=n2 /home/deploy/wabot/scripts/backup_no.sh >> /home/deploy/wabot-backups/backup_no.log 2>&1
#
# Variáveis (mesmo espírito do backup_prod.sh):
#   NODE_ID (OBRIGATÓRIA)  nome do servidor, ex.: n2   NODE_DIR (default /home/deploy/wabot)
#   AUTH_INFO_DIR          default /home/deploy/BOTinho-shared/auth_info
#   BACKUP_DIR             default /home/deploy/wabot-backups     RETENTION_DAYS (30)
#   BACKUP_RCLONE_REMOTE   remotes rclone separados por vírgula    BACKUP_REQUIRE_CLOUD=1 falha sem nuvem
#   BACKUP_AGE_RECIPIENT / BACKUP_AGE_RECIPIENTS_FILE  cifra com age; BACKUP_REQUIRE_ENCRYPTION=1 falha sem cifrar
#   INCLUDE_ENV_FILES=1    inclui o .env do servidor (tem segredos: cifre!)

set -euo pipefail

NODE_ID="${NODE_ID:-}"
NODE_DIR="${NODE_DIR:-/home/deploy/wabot}"
AUTH_INFO_DIR="${AUTH_INFO_DIR:-/home/deploy/BOTinho-shared/auth_info}"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/wabot-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"
BACKUP_AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"
BACKUP_AGE_RECIPIENTS_FILE="${BACKUP_AGE_RECIPIENTS_FILE:-}"
BACKUP_REQUIRE_ENCRYPTION="${BACKUP_REQUIRE_ENCRYPTION:-0}"
BACKUP_REQUIRE_CLOUD="${BACKUP_REQUIRE_CLOUD:-0}"
INCLUDE_ENV_FILES="${INCLUDE_ENV_FILES:-1}"
NODE_ENV_FILE="${NODE_ENV_FILE:-$NODE_DIR/.env}"

timestamp="$(date -u +%Y%m%d-%H%M%S)"
log() { echo "[backup_no ${NODE_ID:-?} $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
fail() { log "ERRO: $*"; exit 1; }

[[ -n "$NODE_ID" ]] || fail "NODE_ID é obrigatório (ex.: NODE_ID=n2)."
[[ "$NODE_ID" =~ ^[a-z0-9-]{1,16}$ ]] || fail "NODE_ID inválido: use só letras minúsculas, números e hífen (até 16)."
command -v tar >/dev/null 2>&1 || fail "tar não está disponível."
[[ -d "$AUTH_INFO_DIR" ]] || fail "Pasta de logins não encontrada em $AUTH_INFO_DIR (sem ela não há o que proteger)."
mkdir -p "$BACKUP_DIR"

stage_dir="$(mktemp -d -t wabot-backup-no-XXXXXXXX)"
trap 'rm -rf "$stage_dir"' EXIT

cp -a "$AUTH_INFO_DIR" "$stage_dir/auth_info"
auth_files="$(find "$stage_dir/auth_info" -type f | wc -l)"
auth_users="$(find "$stage_dir/auth_info" -mindepth 1 -maxdepth 1 -type d | wc -l)"
log "auth_info copiado ($auth_users conta(s), $auth_files arquivo(s))"
[[ "$auth_files" -gt 0 ]] || fail "auth_info vazio: backup abortado para não gravar uma cópia inútil sobre as boas."

if [[ "$INCLUDE_ENV_FILES" == "1" && -f "$NODE_ENV_FILE" ]]; then
  mkdir -p "$stage_dir/env"
  cp -a "$NODE_ENV_FILE" "$stage_dir/env/node.env"
fi

cat > "$stage_dir/manifest.json" <<JSON
{"kind":"node","nodeId":"$NODE_ID","createdAtUtc":"$timestamp","authUsers":$auth_users,"authFiles":$auth_files}
JSON

archive="$BACKUP_DIR/wabot-node-$NODE_ID-$timestamp.tar.gz"
tar -C "$stage_dir" -czf "$archive" .
log "Arquivo criado: $archive ($(stat -c%s "$archive") bytes)"

if [[ -n "$BACKUP_AGE_RECIPIENT" || -n "$BACKUP_AGE_RECIPIENTS_FILE" ]]; then
  command -v age >/dev/null 2>&1 || { rm -f "$archive"; fail "chave age configurada mas 'age' não está instalado."; }
  age_args=()
  [[ -n "$BACKUP_AGE_RECIPIENT" ]] && age_args+=(-r "$BACKUP_AGE_RECIPIENT")
  [[ -n "$BACKUP_AGE_RECIPIENTS_FILE" ]] && age_args+=(-R "$BACKUP_AGE_RECIPIENTS_FILE")
  if ! age "${age_args[@]}" -o "$archive.age" "$archive"; then rm -f "$archive" "$archive.age"; fail "cifragem falhou — backup abortado (sem texto puro)."; fi
  rm -f "$archive"; archive="$archive.age"
  log "Backup cifrado: $archive"
elif [[ "$BACKUP_REQUIRE_ENCRYPTION" == "1" ]]; then
  rm -f "$archive"; fail "BACKUP_REQUIRE_ENCRYPTION=1 mas nenhuma chave configurada."
else
  log "ATENÇÃO: backup SEM cifra — contém logins do WhatsApp e o .env. Configure BACKUP_AGE_RECIPIENT."
fi

deleted="$(find "$BACKUP_DIR" -maxdepth 1 -name "wabot-node-$NODE_ID-*.tar.gz*" -type f -mtime "+$RETENTION_DAYS" -print -delete | wc -l)"
log "Rotação: $deleted arquivo(s) com mais de ${RETENTION_DAYS}d removido(s)"

if [[ -n "$BACKUP_RCLONE_REMOTE" ]]; then
  command -v rclone >/dev/null 2>&1 || fail "BACKUP_RCLONE_REMOTE definido mas rclone não está instalado."
  IFS=',' read -ra remotes <<< "${BACKUP_RCLONE_REMOTE//[[:space:]]/}"
  for remote in "${remotes[@]}"; do
    [[ -z "$remote" ]] && continue
    rclone copy "$archive" "$remote" --no-traverse --quiet || fail "upload falhou para $remote (cópia local existe)."
    rclone delete "$remote" --min-age "${RETENTION_DAYS}d" --include "wabot-node-$NODE_ID-*.tar.gz*" --quiet || true
    log "Upload concluído: $remote"
  done
elif [[ "$BACKUP_REQUIRE_CLOUD" == "1" ]]; then
  fail "BACKUP_REQUIRE_CLOUD=1 mas BACKUP_RCLONE_REMOTE não está configurado."
else
  log "ATENÇÃO: sem cópia externa — perder este servidor = perder o backup junto."
fi

printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$archive" > "$BACKUP_DIR/last_success_node_$NODE_ID.txt"
log "Backup do servidor finalizado."
