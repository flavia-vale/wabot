#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="${ROOT_DIR:-$DEFAULT_ROOT_DIR}"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
BRANCH="${BRANCH:-main}"
FORCE_RESET_ON_SYNC="${FORCE_RESET_ON_SYNC:-0}"

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

# Build com recuperação após corrupção de node_modules pós-install.
# Observado em prod: npm ci passa e arquivos críticos existem, mas o
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

cd "$ROOT_DIR"
configure_public_git_dependencies
echo "[1/9] Sync branch $BRANCH"
git fetch origin
git checkout "$BRANCH"

if [[ "$FORCE_RESET_ON_SYNC" == "1" ]]; then
  # Loga commits locais que seriam descartados (trilha de auditoria).
  local_ahead="$(git log "origin/$BRANCH..HEAD" --oneline 2>/dev/null || true)"
  if [[ -n "$local_ahead" ]]; then
    echo "  Aviso: commits locais descartados pelo hard reset (não estão no remote):"
    echo "$local_ahead" | sed 's/^/    /'
  fi
  echo "  FORCE_RESET_ON_SYNC=1 -> hard reset para origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  git pull --ff-only origin "$BRANCH"
fi

echo "[2/9] Install root dependencies sem alterar lockfile"
run_npm_ci_with_recovery "root"

echo "[3/9] Apply database migrations"
# Skip se não houver migrations pendentes — evita tocar no DB enquanto
# PM2 (api / bot-supervisor) está escrevendo, o que dispara SQLITE_BUSY
# mesmo com busy_timeout=5000 do src/db.js. Mesmo padrão do
# deploy_safe_staging.sh.
MIGRATE_STOPPED_APPS_PROD=""

restart_apps_stopped_for_migration_prod() {
  for app in $MIGRATE_STOPPED_APPS_PROD; do
    pm2 restart "$app" --update-env >/dev/null 2>&1 || true
  done
}

if npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"; then
  echo "  Nenhuma migration pendente — pulando migrate deploy."
else
  # Há migration pendente. DDL como ALTER TABLE precisa de lock exclusivo no
  # SQLite — incompatível com api e bot-supervisor segurando conexões WAL.
  # Paramos os dois antes de migrar e religamos logo depois. Janela de
  # indisponibilidade ~10-30s, mas SÓ ocorre quando há migration pendente
  # (eventos raros, planejados).
  echo "  Migrations pendentes — parando processos que travam o banco..."
  for app in "api" "bot-supervisor"; do
    if pm2 describe "$app" >/dev/null 2>&1; then
      if pm2 stop "$app" >/dev/null 2>&1; then
        MIGRATE_STOPPED_APPS_PROD="$MIGRATE_STOPPED_APPS_PROD $app"
        echo "    - $app parado"
      fi
    fi
  done
  sleep 2

  migrate_attempt=0
  until npx prisma migrate deploy; do
    migrate_attempt=$((migrate_attempt + 1))
    if [ "$migrate_attempt" -ge 5 ]; then
      echo "ERRO: prisma migrate deploy falhou após 5 tentativas."
      restart_apps_stopped_for_migration_prod
      exit 1
    fi
    wait_s=$((migrate_attempt * 3))
    echo "  migrate falhou (tentativa $migrate_attempt/5) — aguardando ${wait_s}s..."
    sleep "$wait_s"
  done

  if [ -n "$MIGRATE_STOPPED_APPS_PROD" ]; then
    echo "  Migrations aplicadas. Religando:$MIGRATE_STOPPED_APPS_PROD"
    restart_apps_stopped_for_migration_prod
  fi
fi

echo "  Regenerando Prisma Client após validação/aplicação das migrations..."
npx prisma generate

echo "[4/9] Install dashboard dependencies"
cd "$DASHBOARD_DIR"
run_npm_ci_with_recovery "dashboard"
ensure_dashboard_deps_integrity

echo "[5/9] Guardrail + build dashboard (hard gate)"
npm run guard:config-page
rm -rf .next
build_dashboard_with_recovery

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

# bot-supervisor (prod) é INTENCIONALMENTE preservado: ver comentário
# detalhado em scripts/deploy_safe_staging.sh. Reinicie manualmente quando
# mudar src/supervisor/*, src/core/sessionCore.js ou src/bot-worker.js.
# Para forçar restart nesse pipeline, exporte RESTART_SUPERVISOR=1.
if [[ "${RESTART_SUPERVISOR:-0}" == "1" ]]; then
  echo "  RESTART_SUPERVISOR=1 — reiniciando bot-supervisor"
  pm2 restart bot-supervisor --update-env
else
  echo "  bot-supervisor preservado. Sessões WhatsApp continuam ativas."
fi

# telegram-offer-bot: garante UM ÚNICO poller após o deploy. O passo [7/9]
# roda `pm2 update`, que respawna o daemon e reinicia processos gerenciados —
# se nesse meio sobrar um poller manual (fora do PM2) ou um processo não
# salvo no dump, dois pollers colidem no mesmo token e ambos param com
# `409 Conflict` (long-polling getUpdates exige um poller por token). Para
# tornar o deploy auto-recuperável, recriamos o app de forma determinística:
# delete + start a partir do ecosystem (start fresco recarrega o token do
# .env via dotenv — evita a pegadinha #1) + pm2 save. Best-effort: falha aqui
# não aborta o deploy, mas é logada para inspeção.
echo "[7c/9] Garante telegram-offer-bot (poller único)"
if pm2 delete telegram-offer-bot >/dev/null 2>&1; then
  echo "  telegram-offer-bot anterior removido (evita poller duplicado)."
fi
if pm2 start ecosystem.config.cjs --only telegram-offer-bot >/tmp/wabot_pm2_telegram.log 2>&1; then
  echo "  telegram-offer-bot iniciado como poller único."
  pm2 save >/dev/null 2>&1 || true
else
  echo "  AVISO: não foi possível iniciar telegram-offer-bot — deploy segue."
  tail -n 20 /tmp/wabot_pm2_telegram.log || true
fi

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
