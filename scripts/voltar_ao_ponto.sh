#!/usr/bin/env bash
#
# Ajuda a voltar o CÓDIGO de produção para um commit/branch anterior.
# Por padrão só MOSTRA o que faria (dry-run). Nada de banco, .env, auth_info
# ou pm2 é tocado: os comandos de pm2 são impressos, não executados.
#
#   cd ~/wabot && scripts/voltar_ao_ponto.sh ponto-retorno/2026-10-01-antes-do-merge-main
#   cd ~/wabot && APLICAR=1 scripts/voltar_ao_ponto.sh <commit|branch|tag>
#
# Com APLICAR=1: checkout "solto" (detached) do ponto + npm ci + prisma generate.
#
# AVISOS:
#  - O próximo push em main faz o deploy automático da ponta de main e
#    desfaz este retorno. Para voltar de forma DEFINITIVA, faça um `git revert`
#    do merge pelo fluxo normal (branch -> PR -> develop -> main).
#  - Colunas novas no banco (ex.: WaSession.nodeId) PERMANECEM; são vazias e
#    inofensivas para o código antigo. Não apague nada do banco.
set -euo pipefail

ALVO="${1:-}"
[ -n "$ALVO" ] || { echo "uso: $0 <commit|branch|tag>" >&2; exit 2; }
ROOT="${PROD_DIR:-$PWD}"
cd "$ROOT"

git fetch origin --tags --prune >/dev/null 2>&1 || echo "(aviso: git fetch falhou; usando o que já existe localmente)"
if git rev-parse --verify -q "origin/$ALVO^{commit}" >/dev/null; then REF="origin/$ALVO"; else REF="$ALVO"; fi
HASH="$(git rev-parse --verify "$REF^{commit}")" || { echo "ponto não encontrado: $ALVO" >&2; exit 2; }

echo "Hoje:   $(git rev-parse HEAD) ($(git log -1 --pretty=%s))"
echo "Alvo:   $HASH ($(git log -1 --pretty=%s "$HASH"))"
echo "Mudanças locais não commitadas: $(git status --porcelain | wc -l)"
echo "Arquivos diferentes entre os dois: $(git diff --name-only HEAD "$HASH" | wc -l)"

if [ "${APLICAR:-0}" != "1" ]; then
  echo
  echo "DRY-RUN: nada foi alterado. Para aplicar: APLICAR=1 $0 $ALVO"
else
  if [ -n "$(git status --porcelain)" ]; then
    echo "Há mudanças locais não commitadas — abortando para não perdê-las." >&2
    exit 3
  fi
  git checkout --detach "$HASH"
  npm ci
  npx prisma generate
  echo "Código voltado para $HASH."
fi

cat <<MSG

Próximos passos (NÃO executados por este script; combine antes — reiniciar o
bot-supervisor reconecta TODAS as sessões):
  pm2 restart api --update-env          # só a API/painel, sem derrubar sessões
  pm2 restart dashboard --update-env
  pm2 restart bot-supervisor --update-env   # só se a mudança era do código dos robôs
Depois confira:  node scripts/vigia.mjs
MSG
