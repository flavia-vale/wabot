#!/usr/bin/env bash
#
# Registra o "retrato" de produção ANTES de uma mudança (ex.: merge em main).
# Somente leitura, exceto: grava o retrato em $RETRATO_DIR e, com BACKUP=1,
# chama o scripts/backup_prod.sh que já existe.
#
#   cd ~/wabot && scripts/ponto_retorno.sh            # só o retrato
#   cd ~/wabot && BACKUP=1 scripts/ponto_retorno.sh   # retrato + backup novo
#
# Não imprime segredos: do .env só entram NOMES de flags não sensíveis.
set -uo pipefail

ROOT="${PROD_DIR:-$PWD}"
RETRATO_DIR="${RETRATO_DIR:-$HOME/wabot-pontos-de-retorno}"
DB="${PROD_DB:-$ROOT/prisma/prod.db}"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/wabot-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RETRATO_DIR"
OUT="$RETRATO_DIR/retrato-$STAMP.txt"

if [ "${BACKUP:-0}" = "1" ]; then
  echo "[ponto_retorno] rodando backup..." >&2
  "$ROOT/scripts/backup_prod.sh" >&2 || echo "[ponto_retorno] ATENÇÃO: backup falhou" >&2
fi

{
  echo "# Retrato de produção — $STAMP"
  echo
  echo "## Código"
  echo "commit: $(git -C "$ROOT" rev-parse HEAD 2>/dev/null)"
  echo "branch: $(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)"
  echo "mensagem: $(git -C "$ROOT" log -1 --pretty=%s 2>/dev/null)"
  echo "alterações locais não commitadas: $(git -C "$ROOT" status --porcelain 2>/dev/null | wc -l)"
  echo "hash do package-lock: $(sha256sum "$ROOT/package-lock.json" 2>/dev/null | cut -c1-16)"
  echo
  echo "## Processos (pm2)"
  pm2 list 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g'
  echo
  echo "## Flags do ambiente (sem valores sensíveis)"
  for k in BOT_SUPERVISOR_MODE SUPERVISOR_NODE_ROUTING SUPERVISOR_NODE_ID SUPERVISOR_NODE_IDS MAX_SESSIONS_PER_PROCESS SUPERVISOR_SHARD_COUNT; do
    v="$(grep -E "^$k=" "$ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2-)"
    echo "$k=${v:-<não definido>}"
  done
  echo
  echo "## Banco"
  if command -v sqlite3 >/dev/null 2>&1 && [ -f "$DB" ]; then
    echo "arquivo: $DB ($(du -h "$DB" | cut -f1))"
    echo "usuários: $(sqlite3 "$DB" 'SELECT COUNT(*) FROM User' 2>&1)"
    echo "sessões WhatsApp: $(sqlite3 "$DB" 'SELECT COUNT(*) FROM WaSession' 2>&1)"
    echo "mensagens na última hora: $(sqlite3 "$DB" "SELECT COUNT(*) FROM MessageLog WHERE sentAt >= datetime('now','-1 hour')" 2>&1)"
    echo "migrations aplicadas: $(sqlite3 "$DB" 'SELECT COUNT(*) FROM _prisma_migrations' 2>&1)"
    echo "última migration: $(sqlite3 "$DB" 'SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1' 2>&1)"
  else
    echo "sqlite3 ou banco não encontrado em $DB"
  fi
  echo
  echo "## Último backup"
  cat "$BACKUP_DIR/last_success.txt" 2>/dev/null || echo "marcador não encontrado em $BACKUP_DIR"
  echo
  echo "## Memória"
  free -h | head -3
} > "$OUT"

cat "$OUT"
echo
echo "Retrato salvo em: $OUT"
