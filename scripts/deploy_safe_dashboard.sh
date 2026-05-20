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

configure_public_git_dependencies() {
  # Baileys/libsignal pode aparecer no lockfile como git+ssh; em GitHub Actions/VPS
  # sem chave SSH para GitHub, isso falha antes do build. Reescreve apenas GitHub
  # público para HTTPS sem alterar package-lock.
  git config --global --replace-all url."https://github.com/".insteadOf "ssh://git@github.com/"
  git config --global --add url."https://github.com/".insteadOf "git@github.com:"
}

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

verify_next_polyfill() {
  local polyfill="$DASHBOARD_DIR/node_modules/next/dist/build/polyfills/polyfill-nomodule.js"
  [[ -f "$polyfill" ]]
}

verify_next_jest_worker_process_child() {
  local worker="$DASHBOARD_DIR/node_modules/next/dist/compiled/jest-worker/processChild.js"
  [[ -f "$worker" ]]
}

run_npm_ci_with_recovery() {
  local label="$1"
  if npm ci; then
    return 0
  fi
  echo "  Aviso: 'npm ci' falhou em $label. Estado de node_modules pode estar sujo (ex: ENOTEMPTY). Removendo e tentando novamente uma vez..."
  rm -rf node_modules
  npm ci
}

ensure_dashboard_deps_integrity() {
  if verify_next_polyfill && verify_next_jest_worker_process_child; then
    return 0
  fi

  echo "  Aviso: instalação do Next incompleta (arquivos críticos ausentes). Tentando reinstalar dependências do dashboard..."
  npm cache verify || true
  npm cache clean --force || true
  rm -rf node_modules
  npm ci

  if ! verify_next_polyfill || ! verify_next_jest_worker_process_child; then
    echo "ERRO: arquivos críticos do Next seguem ausentes após reinstalação:"
    echo "  - next/dist/build/polyfills/polyfill-nomodule.js"
    echo "  - next/dist/compiled/jest-worker/processChild.js"
    echo "Dica: validar saúde de disco/cache do host de deploy e repetir o pipeline."
    exit 1
  fi
}

cd "$ROOT_DIR"
configure_public_git_dependencies
echo "[1/9] Sync branch $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[2/9] Install root dependencies sem alterar lockfile"
run_npm_ci_with_recovery "root"

echo "[3/9] Apply database migrations"
npx prisma migrate deploy

echo "[4/9] Install dashboard dependencies"
cd "$DASHBOARD_DIR"
run_npm_ci_with_recovery "dashboard"
ensure_dashboard_deps_integrity

echo "[5/9] Guardrail + build dashboard (hard gate)"
npm run guard:config-page
rm -rf .next
npm run build

echo "[5b/9] Verificando integridade do build"
for artifact in .next/BUILD_ID .next/prerender-manifest.json; do
  if [[ ! -f "$artifact" ]]; then
    echo "ERRO: artefato de build ausente: $artifact — abortando deploy."
    exit 1
  fi
done
echo "  Build íntegro: BUILD_ID=$(cat .next/BUILD_ID)"
cd "$ROOT_DIR"
node scripts/verify-dashboard-api-proxy.mjs
cd "$DASHBOARD_DIR"

echo "[6/9] Return to project root"
cd "$ROOT_DIR"

echo "[7/9] Sync PM2 daemon/runtime (best effort)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 update >/tmp/wabot_pm2_update.log 2>&1 || {
    echo "  Aviso: pm2 update falhou; seguindo com restart padrão."
    tail -n 20 /tmp/wabot_pm2_update.log || true
  }
else
  echo "ERRO: pm2 não encontrado no PATH."
  exit 1
fi

echo "[7b/9] Restart PM2 apps"
pm2 restart dashboard --update-env
pm2 restart api --update-env

echo "[8/9] PM2 status"
pm2 status

echo "[9/9] Smoke tests (hard gate com retry)"
for path in /login /admin /dashboard; do
  check_http_with_retry "$path" 8 2
done

echo "  Validando abertura mobile do site (/ e /login)"
"$ROOT_DIR/scripts/smoke_mobile_dashboard.sh" "http://espelhagrupos.com.br" / /login

echo "  Validando proxy /api/auth/login (não pode ser 404/prerender do Next.js)"
api_code=$(curl -s -o /tmp/wabot_login_smoke_body.txt -D /tmp/wabot_login_smoke_headers.txt -w "%{http_code}" \
  --max-time 10 \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"email":"smoke@example.invalid","password":"invalid"}' \
  http://espelhagrupos.com.br/api/auth/login || echo "000")
echo "  POST /api/auth/login -> HTTP ${api_code}"
if [[ "$api_code" == "404" || "$api_code" == "000" ]]; then
  echo "ERRO: /api/auth/login não chegou à API (HTTP ${api_code}). Headers:"
  cat /tmp/wabot_login_smoke_headers.txt || true
  exit 1
fi
if grep -qi "x-nextjs-prerender" /tmp/wabot_login_smoke_headers.txt; then
  echo "ERRO: /api/auth/login foi atendido pelo prerender/404 do Next.js em vez do proxy/API."
  cat /tmp/wabot_login_smoke_headers.txt || true
  exit 1
fi

echo "Deploy safe concluído."
