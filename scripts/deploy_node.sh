#!/usr/bin/env bash
#
# Atualiza o CÓDIGO de um servidor secundário (nó) do supervisor. SIMULAÇÃO por
# padrão: só mostra o que faria; grava só com APLICAR=1. Rodar NO servidor do nó.
#
# O que faz:  git fetch + checkout fast-forward da ref  →  dependências (só se o
#             package-lock mudou, instaladas AO LADO e trocadas de uma vez)  →
#             prisma generate (só se o schema mudou).
# Revisão C7: `npm ci` direto apagava node_modules com os robôs RODANDO — um
# robô que carregasse uma biblioteca nesses segundos quebrava.
# O que NÃO faz (de propósito):
#   - NÃO roda migration do banco (o banco é compartilhado: a migration roda UMA
#     vez, no deploy do servidor principal — rodar em dois lugares corre risco);
#   - NÃO reinicia o supervisor. Reiniciar RECONECTA todas as sessões deste
#     servidor; é decisão humana e anunciada (REINICIAR_SUPERVISOR=1 faz, depois
#     de você ter avisado). Sem isso o código novo fica no disco e os robôs seguem
#     na versão antiga — o script avisa isso no fim.
#
# Uso:
#   NODE_DIR=/home/deploy/wabot scripts/deploy_node.sh               # simulação
#   APLICAR=1 REF=main scripts/deploy_node.sh                         # só código
#   APLICAR=1 REINICIAR_SUPERVISOR=1 scripts/deploy_node.sh           # + reinício (avise antes!)

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# Uma operação de deploy por vez neste servidor + respeita janela de manutenção.
# shellcheck source=lib/deploy-lock.sh
source "$SCRIPT_DIR/lib/deploy-lock.sh"
wabot_deploy_lock bash "$0" "$@"

NODE_DIR="${NODE_DIR:-/home/deploy/wabot}"
REF="${REF:-main}"
log() { echo "[deploy_node] $*"; }
fail() { log "ERRO: $*"; exit 1; }

cd "$NODE_DIR" || fail "pasta não encontrada: $NODE_DIR"
[[ -d .git ]] || fail "$NODE_DIR não é um clone git."
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "há alterações locais não commitadas; não vou sobrescrever."
[[ "$REF" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "REF inválida."

if [[ -f .env ]] && ! grep -q '^SUPERVISOR_NODE_ID=' .env; then
  log "AVISO: .env sem SUPERVISOR_NODE_ID — este servidor se identificaria como n1 (o principal). Confira antes de reiniciar."
fi

log "servidor: $(hostname) | pasta: $NODE_DIR | ref: $REF | commit atual: $(git rev-parse --short HEAD)"
if [[ "${APLICAR:-0}" != "1" ]]; then
  log "(simulação) faria: git fetch origin $REF; git checkout --ff-only; dependências só se o package-lock mudar (instaladas ao lado e trocadas de uma vez); prisma generate só se o schema mudar."
  log "(simulação) NÃO rodaria migration e NÃO reiniciaria o supervisor sem REINICIAR_SUPERVISOR=1."
  exit 0
fi

lock_hash() { sha256sum package-lock.json 2>/dev/null | cut -c1-64; }
schema_hash() { sha256sum prisma/schema.prisma 2>/dev/null | cut -c1-64; }
SCHEMA_ANTES="$(schema_hash)"

git fetch origin "$REF"
git checkout "$REF"
git merge --ff-only "origin/$REF" || fail "não é fast-forward: resolva à mão (não vou forçar)."

MARCA="node_modules/.wabot-lock-hash"
if [[ -d node_modules && -f "$MARCA" && "$(cat "$MARCA")" == "$(lock_hash)" ]]; then
  log "package-lock igual ao instalado: dependências NÃO foram reinstaladas."
  if [[ "$(schema_hash)" != "$SCHEMA_ANTES" ]]; then
    log "schema do banco mudou: gerando o cliente Prisma."
    npx prisma generate
  fi
else
  # Instala numa pasta AO LADO e troca de uma vez: os robôs em execução nunca
  # veem node_modules vazio (só a troca, que é um rename).
  NOVO="$NODE_DIR/.deps-novas.$$"
  rm -rf -- "$NOVO"
  mkdir -p "$NOVO"
  cp package.json package-lock.json "$NOVO/"
  [[ -d patches ]] && cp -r patches "$NOVO/"
  [[ -d prisma ]] && cp -r prisma "$NOVO/"
  log "instalando dependências em pasta separada ($NOVO)..."
  (cd "$NOVO" && npm ci) || { rm -rf -- "$NOVO"; fail "npm ci falhou; node_modules em uso NÃO foi tocado."; }
  lock_hash > "$NOVO/node_modules/.wabot-lock-hash"
  [[ -d node_modules ]] && mv node_modules ".deps-velhas.$$"
  mv "$NOVO/node_modules" node_modules
  rm -rf -- ".deps-velhas.$$" "$NOVO"
  log "dependências trocadas."
fi
log "código atualizado para $(git rev-parse --short HEAD). Migration NÃO foi rodada (é do servidor principal)."

if [[ "${REINICIAR_SUPERVISOR:-0}" == "1" ]]; then
  command -v pm2 >/dev/null 2>&1 || fail "pm2 não encontrado."
  log "REINICIANDO o supervisor: todas as sessões deste servidor vão reconectar."
  # delete + start (não `restart --update-env`): só assim o pm2 relê o .env
  # (pegadinha #1). Depois, salva pelo guarda (nunca `pm2 save` cru).
  pm2 delete bot-supervisor >/dev/null 2>&1 || true
  pm2 start ecosystem.node.config.cjs --only bot-supervisor
  node scripts/pm2-save-seguro.mjs || log "AVISO: pm2-save-seguro recusou salvar — confira 'pm2 list'."
  log "reiniciado. Confira com: node scripts/diag-nos.mjs"
else
  log "ATENÇÃO: o supervisor NÃO foi reiniciado — os robôs seguem na versão antiga até alguém reiniciar (anunciando antes)."
fi
