#!/usr/bin/env bash
#
# Religa os apps de produção que SUMIRAM do pm2 — e só eles.
# Roteiro completo: docs/ops/runbook-pm2-sumiu.md (RCA 2026-10-01).
#
#   cd ~/wabot && scripts/religar-producao.sh            # só mostra o que faria
#   cd ~/wabot && APLICAR=1 scripts/religar-producao.sh  # aplica
#
# Garantias (cada uma veio de um erro real de 01/10):
#  - Uma operação por vez: usa a MESMA trava dos deploys. Se outra pessoa ou
#    um deploy estiver mexendo no pm2, sai na hora (nada de reinício duplo).
#  - Nunca mexe em app que já existe no pm2 (nada de restart, nada de
#    `pm2 resurrect`, que reinicia tudo e pode duplicar processos).
#  - Se o bot-supervisor sumiu mas há robôs (bot-worker) deste ambiente vivos,
#    PARA: subir outro supervisor criaria sessões duplicadas (risco de ban).
#  - Salva com scripts/pm2-save-seguro.mjs e roda o vigia no fim.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
APLICAR="${APLICAR:-0}"
LOCK="${WABOT_DEPLOY_LOCK:-$HOME/.wabot-deploy.lock}"
PM2="${PM2_BIN:-pm2}"
cd "$ROOT_DIR"   # pegadinha #9: ecosystem e .env do ambiente CERTO

if command -v flock >/dev/null 2>&1 && [[ "${WABOT_DEPLOY_LOCK_HELD:-0}" != "1" ]]; then
  export WABOT_DEPLOY_LOCK_HELD=1
  # -n: não espera. Se alguém está operando, é para conversar, não para fila.
  set +e
  flock -o -n -E 75 "$LOCK" bash "$0" "$@"
  rc=$?
  [[ $rc -eq 75 ]] && echo "Um deploy ou outra pessoa está mexendo no pm2 agora (trava $LOCK). Espere terminar e rode de novo."
  exit $rc
fi

JANELA_FILE="${WABOT_JANELA_FILE:-$HOME/.wabot-janela}"
if [[ -f "$JANELA_FILE" ]]; then
  echo "Janela de manutenção aberta: $(head -n 1 "$JANELA_FILE")"
  echo "Quem abriu a janela está operando. Fale com essa pessoa antes de religar."
  [[ "${IGNORAR_JANELA:-0}" == "1" ]] || exit 4
fi

mapfile -t FALTANDO < <(node scripts/pm2-faltando.mjs)
if [[ ${#FALTANDO[@]} -eq 0 ]]; then
  echo "Nada faltando no pm2. Nada a fazer."
  exit 0
fi
echo "Faltando no pm2: ${FALTANDO[*]}"

for app in "${FALTANDO[@]}"; do
  if [[ "$app" == "bot-supervisor" ]]; then
    VIVOS="$(pgrep -fc "$ROOT_DIR/src/bot-worker.js" || true)"
    if [[ "${VIVOS:-0}" -gt 0 ]]; then
      echo "PARE: o bot-supervisor sumiu, mas há $VIVOS robô(s) deste ambiente ainda vivos."
      echo "Subir outro supervisor criaria sessões duplicadas. Nada foi feito."
      echo "Veja os pais: ps -eo pid,ppid,etime,args | grep '$ROOT_DIR/src/bot-worker.js' | grep -v grep | head"
      exit 5
    fi
  fi
done

if [[ "$APLICAR" != "1" ]]; then
  echo
  echo "DRY-RUN. Faria, nesta ordem:"
  for app in "${FALTANDO[@]}"; do echo "  pm2 start ecosystem.config.cjs --only $app --update-env"; done
  echo "  node scripts/pm2-save-seguro.mjs"
  echo "  node scripts/vigia.mjs --so-problemas"
  echo "Subir o bot-supervisor reconecta as sessões WhatsApp (elas já estão paradas)."
  echo "Para aplicar: APLICAR=1 $0"
  exit 0
fi

for app in "${FALTANDO[@]}"; do
  echo "Subindo $app..."
  "$PM2" start ecosystem.config.cjs --only "$app" --update-env
done
node scripts/pm2-save-seguro.mjs
ESPERA="${RELIGAR_ESPERA_S:-20}"
echo "Aguardando ${ESPERA} s para o vigia..."
sleep "$ESPERA"
[[ "${RELIGAR_SEM_VIGIA:-0}" == "1" ]] || node scripts/vigia.mjs --so-problemas || true
