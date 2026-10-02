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
#   VIGIA_AUTOCURA=1  (P2-2, DESLIGADO por padrão) quando o vigia acusa app
#                     SUMIDO do pm2, chama `APLICAR=1 scripts/religar-producao.sh`
#                     — no máximo 1 vez a cada 30 min, nunca com janela aberta.
#                     O religar já recusa se houver robôs órfãos ou outra
#                     operação/deploy em andamento.
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

# Autocura (opt-in). Roda ANTES do aviso: o e-mail já sai dizendo que tentou.
AUTOCURA_STAMP="$VIGIA_DIR/ultima-autocura"
if [ "${VIGIA_AUTOCURA:-0}" = "1" ] && [ ! -f "$JANELA_FILE" ] && echo "$OUT" | grep -q "Sumiram do pm2"; then
  ULTIMA="$(cat "$AUTOCURA_STAMP" 2>/dev/null || echo 0)"
  AGORA="$(date +%s)"
  if [ $(( AGORA - ULTIMA )) -ge "${VIGIA_AUTOCURA_INTERVALO_S:-1800}" ]; then
    echo "$AGORA" > "$AUTOCURA_STAMP"
    { echo "   autocura: religando o que sumiu"; APLICAR=1 RELIGAR_ESPERA_S=0 RELIGAR_SEM_VIGIA=1 timeout 300 bash scripts/religar-producao.sh 2>&1 | sed 's/^/   /'; } >> "$LOG"
    OUT="$OUT
(autocura tentou religar às $NOW — ver $LOG)"
  else
    echo "   autocura: já tentou há menos de ${VIGIA_AUTOCURA_INTERVALO_S:-1800}s; só avisando" >> "$LOG"
  fi
fi

# Avisa só na TROCA de estado (não repete a cada execução).
if [ -n "$NOTIFY" ] && [ "$CUR" != "$PREV" ]; then
  ESTADO=vermelho; [ "$CUR" = ok ] && ESTADO=resolvido
  echo "$OUT" | VIGIA_ESTADO="$ESTADO" timeout 60 sh -c "$NOTIFY" >> "$LOG" 2>&1 || true
fi
exit 0
