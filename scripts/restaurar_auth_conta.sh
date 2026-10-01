#!/usr/bin/env bash
#
# Restaura o LOGIN (auth_info) de UMA conta a partir de um backup de servidor
# (backup_no.sh) — o caminho de recuperação quando um servidor morre.
# SIMULAÇÃO por padrão: só mostra o que faria. Grava só com APLICAR=1.
#
# Uso:
#   scripts/restaurar_auth_conta.sh <arquivo.tar.gz|.tar.gz.age> <userId>
#   APLICAR=1 AUTH_INFO_DIR=/pasta/destino/auth_info scripts/restaurar_auth_conta.sh <arquivo> <userId>
#   (arquivo .age: informe AGE_IDENTITY_FILE=<chave-privada>)
#
# NÃO mexe no banco nem religa o robô: depois de restaurar, trocar o servidor da
# conta e religar é com scripts/mover-conta-no.mjs (fase "trocar") ou à mão.
# Recusa sobrescrever uma pasta de login que já tem arquivos, salvo FORCAR=1
# (a antiga vai para <pasta>.antes-<hora>, nunca é apagada).

set -euo pipefail

archive="${1:-}"; user_id="${2:-}"
AUTH_INFO_DIR="${AUTH_INFO_DIR:-/home/deploy/BOTinho-shared/auth_info}"
log() { echo "[restaurar_auth_conta] $*"; }
fail() { log "ERRO: $*"; exit 1; }

[[ -n "$archive" && -n "$user_id" ]] || fail "uso: restaurar_auth_conta.sh <arquivo> <userId>"
[[ -f "$archive" ]] || fail "arquivo não encontrado: $archive"
[[ "$user_id" =~ ^[A-Za-z0-9_-]+$ ]] || fail "userId inválido."

work="$(mktemp -d -t wabot-restore-XXXXXXXX)"
trap 'rm -rf "$work"' EXIT

tarball="$archive"
if [[ "$archive" == *.age ]]; then
  [[ -n "${AGE_IDENTITY_FILE:-}" ]] || fail "backup cifrado: informe AGE_IDENTITY_FILE=<chave privada>."
  command -v age >/dev/null 2>&1 || fail "'age' não está instalado."
  tarball="$work/backup.tar.gz"
  age -d -i "$AGE_IDENTITY_FILE" -o "$tarball" "$archive" || fail "não consegui decifrar o backup."
fi

# Extrai SÓ a pasta desta conta (não espalha logins de outras contas).
tar -C "$work" -xzf "$tarball" "./auth_info/$user_id" 2>/dev/null || fail "a conta $user_id não está neste backup."
src="$work/auth_info/$user_id"
[[ -d "$src" ]] || fail "a conta $user_id não está neste backup."
files="$(find "$src" -type f | wc -l)"
[[ "$files" -gt 0 ]] || fail "a pasta da conta no backup está vazia."
dest="$AUTH_INFO_DIR/$user_id"

log "conta $user_id: $files arquivo(s) no backup → $dest"
if [[ -d "$dest" ]] && [[ -n "$(ls -A "$dest" 2>/dev/null)" ]]; then
  [[ "${FORCAR:-0}" == "1" ]] || fail "já existe login em $dest. Se tem certeza, rode com FORCAR=1 (o antigo é guardado ao lado)."
fi
if [[ "${APLICAR:-0}" != "1" ]]; then
  log "(simulação) nada foi gravado. Rode com APLICAR=1 para restaurar."
  exit 0
fi
if [[ -d "$dest" ]] && [[ -n "$(ls -A "$dest" 2>/dev/null)" ]]; then
  mv "$dest" "$dest.antes-$(date -u +%Y%m%d-%H%M%S)"
fi
mkdir -p "$AUTH_INFO_DIR"
cp -a "$src" "$dest"
log "restaurado. Próximo passo (humano): garantir que NENHUM outro servidor roda esta conta, trocar o servidor dela e religar."
