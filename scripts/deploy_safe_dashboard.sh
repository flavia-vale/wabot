#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/wabot}"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
BRANCH="${BRANCH:-main}"

cd "$ROOT_DIR"
echo "[1/7] Sync branch $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[2/7] Install dashboard dependencies"
cd "$DASHBOARD_DIR"
npm ci

echo "[3/7] Build dashboard (hard gate)"
rm -rf .next
npm run build

echo "[4/7] Return to project root"
cd "$ROOT_DIR"

echo "[5/7] Restart PM2 apps"
pm2 restart dashboard --update-env
pm2 restart api --update-env

echo "[6/7] PM2 status"
pm2 status

echo "[7/7] Smoke tests"
curl -I --max-time 10 http://178.105.54.0/admin || true
curl -I --max-time 10 http://178.105.54.0/dashboard || true

echo "Deploy safe concluído."
