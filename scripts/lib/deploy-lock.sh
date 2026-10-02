# shellcheck shell=bash
# Um deploy (ou operação de pm2) por vez no servidor inteiro.
#
# RCA 2026-10-01: produção e staging dividem o mesmo pm2, e o grupo de
# `concurrency` do GitHub é POR BRANCH — um deploy de main e outro de develop
# rodam juntos. (Trocar para um grupo único não serve: o GitHub CANCELA o
# deploy que estava esperando quando chega outro, e um deploy de produção
# sumiria em silêncio.) A trava fica no servidor: quem chega espera.
#
# Uso, logo depois do `set -euo pipefail` do script:
#   source "$SCRIPT_DIR/lib/deploy-lock.sh"; wabot_deploy_lock bash "$0" "$@"
#
# Roda o script de novo sob `flock -o` e sai com o código dele: o descritor da trava NÃO é herdado pelos
# filhos — sem o `-o`, um daemon do pm2 nascido durante o deploy herdaria a
# trava e ela nunca mais seria solta.
wabot_deploy_lock() {
  if [[ "${WABOT_DEPLOY_LOCK_HELD:-0}" == "1" ]]; then return 0; fi
  # Janela de manutenção aberta (scripts/janela.sh): alguém está mexendo no
  # servidor à mão. O deploy não entra no meio — para com erro claro.
  local janela="${WABOT_JANELA_FILE:-$HOME/.wabot-janela}"
  if [[ -f "$janela" && "${IGNORAR_JANELA:-0}" != "1" ]]; then
    echo "ERRO: janela de manutenção aberta ($(head -n 1 "$janela")). Deploy não executado."
    echo "Feche com scripts/janela.sh fechar e rode o deploy de novo."
    exit 76
  fi
  if ! command -v flock >/dev/null 2>&1; then
    echo "  Aviso: flock ausente; seguindo SEM a trava de deploy único."
    return 0
  fi
  local lock="${WABOT_DEPLOY_LOCK:-$HOME/.wabot-deploy.lock}"
  local wait_s="${WABOT_DEPLOY_LOCK_WAIT_S:-900}"
  export WABOT_DEPLOY_LOCK_HELD=1
  echo "  Trava de deploy: $lock (espera até ${wait_s}s se outro deploy estiver rodando)"
  set +e
  flock -o -w "$wait_s" -E 75 "$lock" "$@"
  local rc=$?
  [[ $rc -eq 75 ]] && echo "ERRO: outro deploy segurou a trava $lock por mais de ${wait_s}s. Nada foi feito."
  exit $rc
}
