#!/usr/bin/env bash
set -euo pipefail

# P2.1 - Prepara staging para Postgres sem tocar produção.
# Requisitos de env:
#   STAGING_ROOT (default: ~/wabot-staging)
#   DATABASE_URL (postgresql://...)
#   API_HEALTH_URL (default: http://127.0.0.1:3004/health)
#   API_READY_URL  (default: http://127.0.0.1:3004/ready)

STAGING_ROOT="${STAGING_ROOT:-$HOME/wabot-staging}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:3004/health}"
API_READY_URL="${API_READY_URL:-http://127.0.0.1:3004/ready}"

if [[ ! -d "$STAGING_ROOT" ]]; then
  echo "ERRO: STAGING_ROOT não encontrado: $STAGING_ROOT"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERRO: DATABASE_URL (Postgres) obrigatório"
  exit 2
fi

if [[ "$DATABASE_URL" != postgresql://* && "$DATABASE_URL" != postgres://* ]]; then
  echo "ERRO: DATABASE_URL não parece Postgres"
  exit 2
fi

cd "$STAGING_ROOT"
echo "[1/6] git pull staging"
git pull origin develop

echo "[2/6] install deps"
npm install
( cd dashboard && npm install )

echo "[3/6] prisma migrate deploy (schema postgres dedicado)"
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy --schema prisma/schema.postgres.prisma

echo "[4/6] restart staging apps"
pm2 restart api-staging visual-staging

echo "[5/6] smoke health/ready"
curl -fsS "$API_HEALTH_URL" >/dev/null
curl -fsS "$API_READY_URL" >/dev/null

echo "[6/6] done"
echo "P2.1 staging Postgres preparado com sucesso."
