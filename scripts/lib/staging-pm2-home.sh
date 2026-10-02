# shellcheck shell=bash
# P2-1 do plano anti-queda (RCA 2026-10-01): staging com pm2 PRÓPRIO.
#
# Hoje produção e staging dividem um daemon pm2: um `pm2 kill`/reinício do
# serviço derruba os dois, e qualquer `pm2 save` grava os dois. Depois da
# migração (scripts/migrar-pm2-staging.sh) existe o arquivo
# ~/.wabot-staging-pm2-home com o PM2_HOME do staging; os scripts de staging
# que fazem `source` deste arquivo passam a falar SÓ com o pm2 do staging.
# Sem o arquivo (padrão), nada muda.
wabot_staging_pm2_home() {
  local marker="${WABOT_STAGING_PM2_HOME_FILE:-$HOME/.wabot-staging-pm2-home}"
  if [[ -s "$marker" ]]; then
    PM2_HOME="$(head -n 1 "$marker" | tr -d '[:space:]')"
    export PM2_HOME
    echo "  pm2 do staging separado: PM2_HOME=$PM2_HOME"
  fi
}
