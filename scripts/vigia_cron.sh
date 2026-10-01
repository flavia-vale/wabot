#!/usr/bin/env bash
#
# Roda o vigia (scripts/vigia.mjs) de tempos em tempos e guarda o histórico.
# NÃO instala nada sozinho: copie a linha de cron abaixo se quiser.
#
#   */5 * * * * cd /home/deploy/wabot && scripts/vigia_cron.sh >/dev/null 2>&1
#
# Variáveis opcionais:
#   VIGIA_DIR         onde guardar log/estado (default: $HOME/wabot-vigia)
#   VIGIA_NOTIFY_CMD  comando chamado SÓ quando o estado passa para 🔴
#                     (recebe o relatório em stdin). Ex.: um curl para um bot.
#                     Vazio = só registra no log.
#   VIGIA_MAX_LOG_KB  tamanho máximo do log antes de rodar (default 2048)
set -uo pipefail

VIGIA_DIR="${VIGIA_DIR:-$HOME/wabot-vigia}"
mkdir -p "$VIGIA_DIR"
LOG="$VIGIA_DIR/vigia.log"
STATE="$VIGIA_DIR/estado-pm2.json"
LAST="$VIGIA_DIR/ultimo-nivel.txt"
LOCK="$VIGIA_DIR/vigia.lock"

# Uma execução por vez (se a anterior travou, esta simplesmente sai).
exec 9>"$LOCK"
flock -n 9 || exit 0

MAX_KB="${VIGIA_MAX_LOG_KB:-2048}"
if [ -f "$LOG" ] && [ "$(du -k "$LOG" | cut -f1)" -gt "$MAX_KB" ]; then
  mv "$LOG" "$LOG.1"
fi

OUT="$(timeout 90 node scripts/vigia.mjs --so-problemas --estado="$STATE" 2>&1)"
CODE=$?
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{ echo "== $NOW (saída $CODE)"; echo "$OUT"; } >> "$LOG"

PREV="$(cat "$LAST" 2>/dev/null || echo ok)"
CUR=ok; [ "$CODE" -ne 0 ] && CUR=red
echo "$CUR" > "$LAST"

# Avisa só na TRANSIÇÃO para vermelho (não repete a cada 5 minutos).
if [ "$CUR" = red ] && [ "$PREV" != red ] && [ -n "${VIGIA_NOTIFY_CMD:-}" ]; then
  echo "$OUT" | sh -c "$VIGIA_NOTIFY_CMD" >> "$LOG" 2>&1 || true
fi
exit 0
