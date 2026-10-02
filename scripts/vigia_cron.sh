#!/usr/bin/env bash
#
# Roda o vigia (scripts/vigia.mjs) de tempos em tempos e guarda o histórico.
# NÃO instala nada sozinho: copie a linha de cron abaixo se quiser.
#
#   */3 * * * * cd /home/deploy/wabot && scripts/vigia_cron.sh >/dev/null 2>&1
#
# Variáveis opcionais:
#   VIGIA_DIR         onde guardar log/estado (default: $HOME/wabot-vigia)
#   VIGIA_NOTIFY_CMD  comando chamado SÓ na troca de estado (🔴 ao entrar,
#                     🟢 ao sair; recebe o relatório em stdin e VIGIA_ESTADO=
#                     vermelho|resolvido). Padrão: e-mail para a administradora
#                     via scripts/vigia-notificar.mjs. VIGIA_EMAIL=0 desliga.
#   Janela de manutenção aberta (scripts/janela.sh) = registra no log, não avisa.
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

NOTIFY="${VIGIA_NOTIFY_CMD:-}"
if [ -z "$NOTIFY" ] && [ "${VIGIA_EMAIL:-1}" != "0" ]; then NOTIFY="node scripts/vigia-notificar.mjs"; fi
JANELA_FILE="${WABOT_JANELA_FILE:-$HOME/.wabot-janela}"
if [ -f "$JANELA_FILE" ]; then
  echo "   (janela de manutenção aberta: $(head -n 1 "$JANELA_FILE") — sem aviso)" >> "$LOG"
  NOTIFY=""
fi

# Avisa só na TROCA de estado (não repete a cada execução).
if [ -n "$NOTIFY" ] && [ "$CUR" != "$PREV" ]; then
  ESTADO=vermelho; [ "$CUR" = ok ] && ESTADO=resolvido
  echo "$OUT" | VIGIA_ESTADO="$ESTADO" timeout 60 sh -c "$NOTIFY" >> "$LOG" 2>&1 || true
fi
exit 0
