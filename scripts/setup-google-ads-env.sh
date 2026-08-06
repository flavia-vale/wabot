#!/usr/bin/env bash
#
# Configura as variáveis do Google Ads no .env.local do dashboard e reconstrói.
#
# POR QUE PRECISA DE BUILD: variável `NEXT_PUBLIC_*` é gravada DENTRO do código
# no momento do build, não lida em tempo de execução. Editar o .env.local e dar
# `pm2 restart` não muda nada — a tag simplesmente não aparece, e parece que o
# código está quebrado.
#
# Idempotente: rodar de novo atualiza o valor no lugar em vez de duplicar linha.
#
# Uso:
#   bash scripts/setup-google-ads-env.sh                 # prod (~/wabot)
#   bash scripts/setup-google-ads-env.sh --no-build      # só grava o .env.local
#   TARGET_DIR=~/wabot-staging bash scripts/setup-google-ads-env.sh
#
set -euo pipefail

GADS_ID="${GADS_ID:-AW-18361137019}"
GADS_SIGNUP_LABEL="${GADS_SIGNUP_LABEL:-AW-18361137019/PhpoCPW41NwcEPvuorNE}"

TARGET_DIR="${TARGET_DIR:-$HOME/wabot}"
DASHBOARD_DIR="$TARGET_DIR/dashboard"
ENV_FILE="$DASHBOARD_DIR/.env.local"

DO_BUILD=1
PM2_APP="dashboard"
[ "$TARGET_DIR" != "$HOME/wabot" ] && PM2_APP="visual-staging"
for arg in "$@"; do
  [ "$arg" = "--no-build" ] && DO_BUILD=0
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------- preflight ---
say "1/5  Preflight"

[ -d "$DASHBOARD_DIR" ] || { echo "ERRO: $DASHBOARD_DIR não existe"; exit 1; }
echo "  diretório .......... $DASHBOARD_DIR"
echo "  app pm2 ............ $PM2_APP"
echo "  ID ................. $GADS_ID"
echo "  rótulo ............. $GADS_SIGNUP_LABEL"

if [ -f "$ENV_FILE" ]; then
  echo "  .env.local ......... existe ($(wc -l < "$ENV_FILE") linhas)"
  if grep -q '^NEXT_PUBLIC_GADS_ID=' "$ENV_FILE"; then
    echo "  valor atual ........ $(grep '^NEXT_PUBLIC_GADS_ID=' "$ENV_FILE" | cut -d= -f2-)"
  fi
else
  echo "  .env.local ......... NÃO existe, será criado"
fi

# O .env.local do dashboard também carrega PORT e NEXT_PUBLIC_FORCE_SAME_ORIGIN_API.
# Se ele existe e NÃO tem PORT, provavelmente é o arquivo errado — abortar em vez
# de subir o dashboard numa porta default e derrubar o site.
if [ -f "$ENV_FILE" ] && ! grep -q '^PORT=' "$ENV_FILE"; then
  echo
  echo "  AVISO: o .env.local não tem PORT. Confira se é o arquivo certo antes de seguir."
  echo "  (esperado: PORT=3000 em prod, PORT=3006 em staging)"
  read -r -p "  Continuar mesmo assim? [s/N] " ok
  [ "$ok" = "s" ] || { echo "Abortado."; exit 1; }
fi

# ------------------------------------------------------- memória disponível ---
if [ "$DO_BUILD" = "1" ]; then
  say "2/5  Memória"
  free -h | sed 's/^/  /'
  AVAIL_MB=$(free -m | awk '/^Mem:/ {print $7}')
  echo
  echo "  disponível: ${AVAIL_MB} MB"
  if [ "$AVAIL_MB" -lt 1200 ]; then
    echo
    echo "  ATENÇÃO: a build do Next é pesada e há pouca memória livre."
    echo "  O VPS roda prod e staging juntos, e uma build sob pressão pode"
    echo "  travar o event-loop dos bot-workers e derrubar sessões do WhatsApp."
    echo
    echo "  Libere memória antes (~1-1.4 GB) com:"
    echo "    pm2 stop api-staging visual-staging"
    echo
    read -r -p "  Continuar mesmo assim? [s/N] " ok
    [ "$ok" = "s" ] || { echo "Abortado."; exit 1; }
  fi
else
  say "2/5  Memória — pulado (--no-build)"
fi

# -------------------------------------------------------------- .env.local ----
say "3/5  Gravando .env.local"

touch "$ENV_FILE"
BACKUP="$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"
cp "$ENV_FILE" "$BACKUP"
echo "  backup ............. $BACKUP"

upsert_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # Substitui no lugar. Delimitador `|` porque o valor tem `/`.
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    echo "  atualizado ......... ${key}"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    echo "  adicionado ......... ${key}"
  fi
}

upsert_env NEXT_PUBLIC_GADS_ID "$GADS_ID"
upsert_env NEXT_PUBLIC_GADS_SIGNUP_LABEL "$GADS_SIGNUP_LABEL"

echo
echo "  Conteúdo agora:"
grep -E '^(PORT|NEXT_PUBLIC_)' "$ENV_FILE" | sed 's/^/    /'

if [ "$DO_BUILD" = "0" ]; then
  say "Pronto — .env.local gravado, build NÃO executada"
  echo "  A tag só aparece depois de:"
  echo "    cd $DASHBOARD_DIR && rm -rf .next && npm run build && pm2 restart $PM2_APP"
  exit 0
fi

# ------------------------------------------------------------------ build -----
say "4/5  Build do dashboard (alguns minutos)"
cd "$DASHBOARD_DIR"
rm -rf .next
npm run build
pm2 restart "$PM2_APP" --update-env

# ---------------------------------------------------------------- verificar ---
say "5/5  Verificação"
PORT_VALUE="$(grep '^PORT=' "$ENV_FILE" | cut -d= -f2- || echo 3000)"
sleep 5

HITS="$(curl -s --max-time 20 "http://127.0.0.1:${PORT_VALUE}/" | grep -c 'googletagmanager' || true)"
if [ "${HITS:-0}" -gt 0 ]; then
  echo "  OK: a tag do Google Ads está sendo servida (${HITS} ocorrência(s))."
  echo
  echo "  Falta o passo que o checklist exige e ninguém pode pular:"
  echo "    crie uma conta de teste no site e confirme, em"
  echo "    Google Ads > Metas > Conversões, que 'Cadastro' saiu de"
  echo "    'Sem atividade recente' para 'Gravando conversões'."
  echo "    Pode levar ate 24h para aparecer."
else
  echo "  FALHOU: a tag não aparece no HTML."
  echo
  echo "  Verifique, nesta ordem:"
  echo "    1. o código do Google Ads já está em produção? (PR #1398 mergeada)"
  echo "    2. a build terminou sem erro?"
  echo "    3. cat $ENV_FILE  — as duas variáveis estão lá?"
  echo
  echo "  Para reverter o .env.local:  cp $BACKUP $ENV_FILE"
  exit 1
fi
