#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="${ROOT_DIR:-$DEFAULT_ROOT_DIR}"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
BRANCH="${BRANCH:-develop}"
SYNC_GIT="${SYNC_GIT:-0}"
AUTO_STASH_ON_DIRTY="${AUTO_STASH_ON_DIRTY:-0}"
VISUAL_APP="${VISUAL_APP:-visual-staging}"
API_APP="${API_APP:-api-staging}"
VISUAL_BASE_URL="${VISUAL_BASE_URL:-http://178.105.54.0:3006}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3004}"

if [[ ! -d "$ROOT_DIR/.git" ]]; then
  echo "ERRO: ROOT_DIR inválido ($ROOT_DIR). Defina ROOT_DIR apontando para ~/wabot-staging."
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
  local label="$1"
  local url="$2"
  local attempts="${3:-8}"
  local sleep_seconds="${4:-2}"

  for ((i=1; i<=attempts; i++)); do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo "000")
    echo "  tentativa ${i}/${attempts} ${label} -> HTTP ${code}"
    if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" || "$code" == "307" || "$code" == "308" ]]; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "Smoke test falhou para ${label} após ${attempts} tentativas."
  return 1
}

assert_login_api_not_next_404() {
  local url="${VISUAL_BASE_URL%/}/api/auth/login"
  local headers_file="/tmp/wabot_staging_login_headers.txt"
  local body_file="/tmp/wabot_staging_login_body.txt"
  local code

  code=$(curl -s -o "$body_file" -D "$headers_file" -w "%{http_code}" \
    --max-time 10 \
    -X POST \
    -H "Content-Type: application/json" \
    --data '{"email":"smoke@example.invalid","password":"invalid"}' \
    "$url" || echo "000")
  echo "  POST ${url} -> HTTP ${code}"

  if [[ "$code" == "000" || "$code" == "404" ]]; then
    echo "ERRO: /api/auth/login não chegou corretamente ao proxy/API (HTTP ${code}). Headers:"
    cat "$headers_file" || true
    exit 1
  fi

  if [[ "$code" =~ ^5 ]]; then
    echo "ERRO: /api/auth/login retornou erro 5xx. Headers/body:"
    cat "$headers_file" || true
    head -c 1200 "$body_file" || true
    echo
    exit 1
  fi

  if grep -qi "x-nextjs-prerender" "$headers_file"; then
    echo "ERRO: /api/auth/login foi atendido pelo prerender/404 do Next.js em vez do proxy/API."
    cat "$headers_file" || true
    exit 1
  fi

  if ! grep -qi "content-type: .*application/json" "$headers_file"; then
    echo "ERRO: /api/auth/login não retornou JSON. Headers/body:"
    cat "$headers_file" || true
    head -c 1200 "$body_file" || true
    echo
    exit 1
  fi
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

# Build com recuperação após corrupção de node_modules pós-install.
# Observado em staging: npm ci passa e arquivos críticos existem, mas o
# build estoura com erros internos do webpack (ex.: 'WebpackError is not
# a constructor' no minify-webpack-plugin). Causa típica: cópias
# divergentes do webpack resolvidas no runtime. Limpar node_modules +
# cache e reinstalar resolve sem mudar código nem versão.
build_dashboard_with_recovery() {
  if npm run build; then
    return 0
  fi
  echo "  Aviso: 'npm run build' falhou. Limpando node_modules + .next + cache e tentando novamente uma vez..."
  rm -rf node_modules .next
  npm cache clean --force || true
  npm ci
  ensure_dashboard_deps_integrity
  npm run build
}


ensure_pm2_app_running() {
  local app_name="$1"

  if pm2 describe "$app_name" >/dev/null 2>&1; then
    pm2 restart "$app_name" --update-env
    return 0
  fi

  echo "  Aviso: processo PM2 '$app_name' não encontrado. Tentando criar via ecosystem.config.cjs..."
  if pm2 start "$ROOT_DIR/ecosystem.config.cjs" --only "$app_name" --update-env >/tmp/wabot_pm2_start_${app_name}.log 2>&1; then
    echo "  PM2 app '$app_name' criado com sucesso via ecosystem.config.cjs."
    return 0
  fi

  echo "ERRO: não foi possível iniciar '$app_name' via ecosystem.config.cjs."
  cat /tmp/wabot_pm2_start_${app_name}.log || true
  echo "Dica: valide o nome do app no PM2 (pm2 status) e no ecosystem/config de staging."
  exit 1
}

cd "$ROOT_DIR"
configure_public_git_dependencies
echo "[1/9] Preflight staging"
echo "  root=$ROOT_DIR"
echo "  branch alvo=$BRANCH"
echo "  visual=$VISUAL_APP ($VISUAL_BASE_URL)"
echo "  api=$API_APP ($API_BASE_URL)"
git status --short --branch
git log --oneline -n 3

if [[ "$SYNC_GIT" == "1" ]]; then
  echo "[2/9] Sync branch $BRANCH"
  if [[ -n "$(git status --porcelain)" ]]; then
    if [[ "$AUTO_STASH_ON_DIRTY" == "1" ]]; then
      echo "  Aviso: working tree sujo detectado. Aplicando stash automático para seguir com deploy de staging."
      git stash push --include-untracked --message "auto-stash deploy_safe_staging $(date -u +%Y-%m-%dT%H:%M:%SZ)" >/tmp/wabot_staging_autostash.log || true
      git status --short --branch
    else
      echo "ERRO: working tree possui alterações locais. Resolva antes de SYNC_GIT=1 para evitar sobrescrever staging."
      echo "Dica: rode com AUTO_STASH_ON_DIRTY=1 para stash automático (somente staging)."
      exit 1
    fi
  fi
  git fetch origin
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
else
  echo "[2/9] Sync git pulado (SYNC_GIT=0). Usando checkout atual."
fi

echo "[3/9] Install root dependencies sem alterar lockfile"
run_npm_ci_with_recovery "root"

echo "[4/9] Apply database migrations no banco isolado de staging"
# Skip se não houver migrations pendentes — evita tocar no DB enquanto
# PM2 (api-staging / bot-supervisor-staging) está escrevendo, o que dispara
# SQLITE_BUSY mesmo com busy_timeout=5000 do src/db.js.
if npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"; then
  echo "  Nenhuma migration pendente — pulando migrate deploy."
else
  # Há migration pendente: tenta até 5x com backoff (lock costuma ser transitório).
  migrate_attempt=0
  until npx prisma migrate deploy; do
    migrate_attempt=$((migrate_attempt + 1))
    if [ "$migrate_attempt" -ge 5 ]; then
      echo "ERRO: prisma migrate deploy falhou após 5 tentativas."
      exit 1
    fi
    wait_s=$((migrate_attempt * 3))
    echo "  migrate falhou (tentativa $migrate_attempt/5) — aguardando ${wait_s}s..."
    sleep "$wait_s"
  done
fi

echo "[5/9] Install dashboard dependencies sem alterar lockfile"
cd "$DASHBOARD_DIR"
run_npm_ci_with_recovery "dashboard"
ensure_dashboard_deps_integrity

echo "[6/9] Guardrail + build dashboard staging (hard gate)"
npm run guard:config-page
rm -rf .next
build_dashboard_with_recovery

for artifact in .next/BUILD_ID .next/prerender-manifest.json .next/server/app-paths-manifest.json; do
  if [[ ! -f "$artifact" ]]; then
    echo "ERRO: artefato de build ausente: $artifact — abortando staging."
    exit 1
  fi
done

echo "  Build íntegro: BUILD_ID=$(cat .next/BUILD_ID)"

cd "$ROOT_DIR"
node scripts/verify-dashboard-api-proxy.mjs

echo "[7/9] Restart PM2 staging apps"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERRO: pm2 não encontrado no PATH."
  exit 1
fi
ensure_pm2_app_running "$API_APP"
ensure_pm2_app_running "$VISUAL_APP"

# bot-supervisor é INTENCIONALMENTE deixado de fora do restart automático
# em todo deploy. O ponto do desacoplamento é justamente que deploy da API
# não derrube as sessões WhatsApp. Reinicie o supervisor manualmente quando
# houver mudança em:
#   - src/supervisor/*
#   - src/core/sessionCore.js
#   - src/bot-worker.js
# Comando: pm2 restart bot-supervisor-staging --update-env
# Para forçar restart no pipeline (raro), exporte RESTART_SUPERVISOR=1.
SUPERVISOR_APP="${SUPERVISOR_APP:-bot-supervisor-staging}"
if [[ "${RESTART_SUPERVISOR:-0}" == "1" ]]; then
  echo "  RESTART_SUPERVISOR=1 — reiniciando $SUPERVISOR_APP"
  ensure_pm2_app_running "$SUPERVISOR_APP"
else
  echo "  bot-supervisor preservado (RESTART_SUPERVISOR=0). Sessões continuam ativas."
fi

pm2 save

echo "[8/9] PM2 status"
pm2 status

echo "[9/9] Smoke tests staging"
check_http_with_retry "visual /login" "${VISUAL_BASE_URL%/}/login" 8 2
echo "  Validando abertura mobile do site (/ e /login)"
"$ROOT_DIR/scripts/smoke_mobile_dashboard.sh" "$VISUAL_BASE_URL" / /login
check_http_with_retry "api /health" "${API_BASE_URL%/}/health" 8 2
assert_login_api_not_next_404

echo "Deploy safe staging concluído. Valide login real em ${VISUAL_BASE_URL%/}/login antes de qualquer produção."
