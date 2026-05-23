#!/usr/bin/env bash
set -euo pipefail

# P0.1 runbook executor (staging-first): BOT_SUPERVISOR_MODE inline -> remote
# Usage examples:
#   bash scripts/p0_1_cutover_remote.sh --env staging
#   bash scripts/p0_1_cutover_remote.sh --env production --yes

ENVIRONMENT=""
YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENVIRONMENT="${2:-}"
      shift 2
      ;;
    --yes)
      YES=1
      shift
      ;;
    *)
      echo "Unknown arg: $1"
      exit 2
      ;;
  esac
done

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Use --env staging|production"
  exit 2
fi

if [[ "$ENVIRONMENT" == "staging" ]]; then
  ROOT_DIR="${ROOT_DIR:-$HOME/wabot-staging}"
  API_APP="api-staging"
  SUPERVISOR_APP="bot-supervisor-staging"
  REDIS_EXPECTED="redis://127.0.0.1:6379/1"
else
  ROOT_DIR="${ROOT_DIR:-$HOME/wabot}"
  API_APP="api"
  SUPERVISOR_APP="bot-supervisor"
  REDIS_EXPECTED="redis://127.0.0.1:6379/0"
fi

if [[ ! -d "$ROOT_DIR" ]]; then
  echo "ERRO: ROOT_DIR não encontrado: $ROOT_DIR"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERRO: pm2 não encontrado"
  exit 1
fi

if ! command -v redis-cli >/dev/null 2>&1; then
  echo "ERRO: redis-cli não encontrado"
  exit 1
fi

echo "[1/8] Preflight"
cd "$ROOT_DIR"
grep "name:" ecosystem.config.cjs | sed -n '1,20p'
ls src/supervisor/

echo "[2/8] Redis liveness"
redis-cli -h 127.0.0.1 -p 6379 ping

echo "[3/8] Validar .env"
if [[ ! -f .env ]]; then
  echo "ERRO: .env não encontrado em $ROOT_DIR"
  exit 1
fi
if ! grep -q "^REDIS_URL=${REDIS_EXPECTED}$" .env; then
  echo "ERRO: REDIS_URL inesperado. Esperado: $REDIS_EXPECTED"
  grep '^REDIS_URL=' .env || true
  exit 1
fi
if ! grep -q "^BOT_SUPERVISOR_MODE=remote$" .env; then
  echo "ERRO: BOT_SUPERVISOR_MODE não está em remote"
  grep '^BOT_SUPERVISOR_MODE=' .env || true
  exit 1
fi

echo "[4/8] Garantir supervisor ativo"
pm2 start ecosystem.config.cjs --only "$SUPERVISOR_APP" >/dev/null || true
pm2 status "$SUPERVISOR_APP"

echo "[5/8] Reiniciar API via delete+start (pegadinha #1)"
if [[ "$YES" -ne 1 ]]; then
  echo "Dry-run safety: reexecute com --yes para aplicar delete+start"
  exit 0
fi
pm2 delete "$API_APP" || true
pm2 start ecosystem.config.cjs --only "$API_APP"


echo "[6/8] Confirmar modo efetivo"
pm2 logs "$API_APP" --lines 80 --nostream | rg -n "Manager em modo REMOTE|BOT_SUPERVISOR_MODE"

echo "[7/8] Teste funcional base"
if [[ "$ENVIRONMENT" == "staging" ]]; then
  curl -fsS "http://127.0.0.1:3004/health" >/dev/null
  curl -fsS "http://178.105.54.0:3006/login" >/dev/null
else
  curl -fsS "http://127.0.0.1:3001/health" >/dev/null
fi

echo "[8/8] Aceite manual obrigatório"
echo "- Reinicie $API_APP com sessão conectada e valide que a sessão NÃO cai."
echo "- Se falhar: rollback imediato para BOT_SUPERVISOR_MODE=inline + pm2 restart $API_APP"
