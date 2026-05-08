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

# Detecta shadow modules (ex.: Footer.js + Footer.jsx). Caso clássico de
# build silenciosamente quebrado: webpack pega a versão errada por ordem
# de extensão. Aborta o deploy se encontrar.
echo "[2b/7] Verificando shadow modules"
node "$ROOT_DIR/scripts/check_no_shadow_modules.mjs" dashboard

# Limpa lockfile parasita em $HOME que confunde o workspace root do Next.
if [[ -f "$HOME/package-lock.json" && ! -f "$HOME/package.json" ]]; then
  echo "  Removendo lockfile órfão em $HOME/package-lock.json"
  rm -f "$HOME/package-lock.json"
fi

echo "[3/7] Build dashboard (hard gate)"
rm -rf .next
npm run build

# Verifica que o build produziu os artefatos essenciais antes de reiniciar PM2.
# Um .next incompleto causa crash loop imediato no next start → 502 contínuo.
echo "[3b/7] Verificando integridade do build"
for artifact in .next/BUILD_ID .next/prerender-manifest.json; do
  if [[ ! -f "$artifact" ]]; then
    echo "ERRO: artefato de build ausente: $artifact — abortando deploy."
    exit 1
  fi
done
echo "  Build íntegro: BUILD_ID=$(cat .next/BUILD_ID)"

echo "[4/7] Return to project root"
cd "$ROOT_DIR"

echo "[5/7] Restart PM2 apps"
pm2 restart dashboard --update-env
pm2 restart api --update-env

echo "[6/7] PM2 status"
pm2 status

echo "[7/7] Smoke tests (hard gate)"
for path in /login /admin /dashboard; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://178.105.54.0${path}")
  echo "  ${path} -> HTTP ${code}"
  if [[ "$code" != "200" && "$code" != "302" && "$code" != "307" ]]; then
    echo "Smoke test falhou para ${path} (HTTP ${code})."
    exit 1
  fi
done

echo "Deploy safe concluído."
