#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="${ROOT_DIR:-$DEFAULT_ROOT_DIR}"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
BRANCH="${BRANCH:-main}"

if [[ ! -d "$ROOT_DIR/.git" ]]; then
  echo "ERRO: ROOT_DIR inválido ($ROOT_DIR). Defina ROOT_DIR apontando para a raiz do repositório wabot."
  exit 1
fi

check_http_with_retry() {
  local path="$1"
  local attempts="${2:-8}"
  local sleep_seconds="${3:-2}"
  local url="http://espelhagrupos.com.br${path}"

  for ((i=1; i<=attempts; i++)); do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo "000")
    echo "  tentativa ${i}/${attempts} ${path} -> HTTP ${code}"
    if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" || "$code" == "307" || "$code" == "308" ]]; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "Smoke test falhou para ${path} após ${attempts} tentativas."
  return 1
}

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

echo "[7/7] Smoke tests (hard gate com retry)"
for path in /login /admin /dashboard; do
  check_http_with_retry "$path" 8 2
done

echo "Deploy safe concluído."
