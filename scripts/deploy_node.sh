#!/usr/bin/env bash
#
# Atualiza o CÓDIGO de um servidor secundário (nó) do supervisor. SIMULAÇÃO por
# padrão: só mostra o que faria; grava só com APLICAR=1. Rodar NO servidor do nó.
#
# O que faz:  git fetch + checkout fast-forward da ref  →  npm ci  →  prisma generate.
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
  log "(simulação) faria: git fetch origin $REF; git checkout --ff-only; npm ci; npx prisma generate."
  log "(simulação) NÃO rodaria migration e NÃO reiniciaria o supervisor sem REINICIAR_SUPERVISOR=1."
  exit 0
fi

git fetch origin "$REF"
git checkout "$REF"
git merge --ff-only "origin/$REF" || fail "não é fast-forward: resolva à mão (não vou forçar)."
npm ci
npx prisma generate
log "código atualizado para $(git rev-parse --short HEAD). Migration NÃO foi rodada (é do servidor principal)."

if [[ "${REINICIAR_SUPERVISOR:-0}" == "1" ]]; then
  command -v pm2 >/dev/null 2>&1 || fail "pm2 não encontrado."
  log "REINICIANDO o supervisor: todas as sessões deste servidor vão reconectar."
  pm2 restart bot-supervisor --update-env
  log "reiniciado. Confira com: node scripts/diag-nos.mjs"
else
  log "ATENÇÃO: o supervisor NÃO foi reiniciado — os robôs seguem na versão antiga até alguém reiniciar (anunciando antes)."
fi
