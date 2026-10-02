#!/usr/bin/env bash
#
# P2-1 do plano anti-queda (RCA 2026-10-01): tira o STAGING do pm2 da produção
# e põe num pm2 próprio (PM2_HOME separado). Depois disso, reiniciar/matar o
# pm2 de um ambiente não derruba o outro, e o `pm2 save` de um não grava o outro.
#
#   ~/wabot/scripts/migrar-pm2-staging.sh                 # só mostra o plano
#   scripts/janela.sh abrir "migrar pm2 do staging"
#   APLICAR=1 ~/wabot/scripts/migrar-pm2-staging.sh       # aplica (staging fica fora ~1 min)
#   REVERTER=1 APLICAR=1 ~/wabot/scripts/migrar-pm2-staging.sh   # desfaz
#
# RAM (REGRA #1 — precisa de OK): +1 daemon pm2, ~60–80 MB fixos.
# Produção NÃO é tocada: só os apps *-staging saem do pm2 principal.
# Exige janela de manutenção aberta para aplicar.
set -euo pipefail

STAGING_DIR="${STAGING_DIR:-$HOME/wabot-staging}"
NEW_HOME="${STAGING_PM2_HOME:-$HOME/.pm2-staging}"
MARKER="${WABOT_STAGING_PM2_HOME_FILE:-$HOME/.wabot-staging-pm2-home}"
JANELA_FILE="${WABOT_JANELA_FILE:-$HOME/.wabot-janela}"
PM2="${PM2_BIN:-pm2}"
MAIN_HOME="${MAIN_PM2_HOME:-$HOME/.pm2}"
APLICAR="${APLICAR:-0}"
REVERTER="${REVERTER:-0}"
SAFE_SAVE="$STAGING_DIR/scripts/pm2-save-seguro.mjs"
[[ -f "$SAFE_SAVE" ]] || SAFE_SAVE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/pm2-save-seguro.mjs"

apps_in() { PM2_HOME="$1" "$PM2" jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{for(const p of JSON.parse(s))if(/-staging$/.test(p.name))console.log(p.name)}catch{}})'; }

if [[ "$REVERTER" == "1" ]]; then FROM="$NEW_HOME"; TO="$MAIN_HOME"; else FROM="$MAIN_HOME"; TO="$NEW_HOME"; fi
mapfile -t APPS < <(apps_in "$FROM")
echo "De:   PM2_HOME=$FROM"
echo "Para: PM2_HOME=$TO"
echo "Apps de staging a mover: ${APPS[*]:-(nenhum)}"
[[ ${#APPS[@]} -gt 0 ]] || { echo "Nada a mover."; exit 0; }

if [[ "$APLICAR" != "1" ]]; then
  echo
  echo "DRY-RUN. Faria:"
  echo "  1. PM2_HOME=$FROM pm2 delete ${APPS[*]}"
  echo "  2. cd $STAGING_DIR && PM2_HOME=$TO pm2 start ecosystem.config.cjs --only $(IFS=,; echo "${APPS[*]}") --update-env"
  if [[ "$REVERTER" == "1" ]]; then echo "  3. salvar o pm2 principal (pm2-save-seguro) e desligar o pm2 do staging"; else echo "  3. salvar os dois (pm2-save-seguro, permitindo os apps movidos saírem do dump de origem)"; fi
  if [[ "$REVERTER" == "1" ]]; then echo "  4. apagar $MARKER"; else echo "  4. gravar $TO em $MARKER (deploys de staging passam a usar esse pm2)"; fi
  echo "Precisa de janela aberta: scripts/janela.sh abrir \"migrar pm2 do staging\""
  exit 0
fi

[[ -f "$JANELA_FILE" ]] || { echo "ERRO: abra a janela antes (scripts/janela.sh abrir \"migrar pm2 do staging\")."; exit 4; }
mkdir -p "$TO"
PM2_HOME="$FROM" "$PM2" delete "${APPS[@]}"
(cd "$STAGING_DIR" && PM2_HOME="$TO" "$PM2" start ecosystem.config.cjs --only "$(IFS=,; echo "${APPS[*]}")" --update-env)
if [[ "$REVERTER" == "1" ]]; then
  # O pm2 do staging ficou vazio: o guarda (corretamente) não salva pm2 vazio.
  # Apaga o dump dele e desliga esse daemon (devolve os ~60–80 MB).
  rm -f "$FROM/dump.pm2"
  PM2_HOME="$FROM" "$PM2" kill >/dev/null 2>&1 || true
else
  PM2_HOME="$FROM" PM2_SAVE_ALLOW_REMOVE="${APPS[*]}" node "$SAFE_SAVE"
fi
PM2_HOME="$TO" node "$SAFE_SAVE"
if [[ "$REVERTER" == "1" ]]; then rm -f "$MARKER"; else echo "$TO" > "$MARKER"; fi
echo
echo "Feito. Para o staging voltar sozinho num reboot, rode UMA vez (pede senha):"
if [[ "$REVERTER" == "1" ]]; then
  echo "  sudo systemctl disable --now pm2-deploy-staging"
else
  echo "  sudo env PATH=\$PATH PM2_HOME=$TO \$(command -v pm2) startup systemd -u $(id -un) --hp $HOME --service-name pm2-deploy-staging"
fi
echo "Confira: PM2_HOME=$TO pm2 list   e   pm2 list   (produção intacta)"
