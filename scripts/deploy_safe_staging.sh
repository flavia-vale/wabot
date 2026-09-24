#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="${ROOT_DIR:-$DEFAULT_ROOT_DIR}"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
BRANCH="${BRANCH:-develop}"
SYNC_GIT="${SYNC_GIT:-0}"
AUTO_STASH_ON_DIRTY="${AUTO_STASH_ON_DIRTY:-0}"
FORCE_RESET_ON_SYNC="${FORCE_RESET_ON_SYNC:-0}"
VISUAL_APP="${VISUAL_APP:-visual-staging}"
API_APP="${API_APP:-api-staging}"
VISUAL_BASE_URL="${VISUAL_BASE_URL:-http://178.105.54.0:3006}"
VISUAL_PORT="${VISUAL_PORT:-3006}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3004}"
# Em janela de teste do cutover, staging também pode rodar em modo remote.
# Nesse cenário, parar bot-supervisor-staging durante migrations mata os
# bot-workers filhos e invalida justamente o teste de que deploy da API não
# derruba WhatsApp. Por isso o supervisor só é preservado quando ele de fato
# gerencia sessões (BOT_SUPERVISOR_MODE=remote). No modo canônico de staging
# (inline) o supervisor fica em STANDBY: não faz fork de nenhum worker, mas
# `import db.js` no boot abre conexão WAL no staging.db — preservá-lo aí não
# mantém nenhuma sessão viva (quem forka é a api-staging, que é parada) e só
# segura o lock que faz o DDL do `prisma migrate deploy` estourar
# `database is locked` (pegadinha #8). Vazio (default) = mode-aware; força 1/0
# só em manutenção explícita.
PRESERVE_SUPERVISOR_DURING_MIGRATION="${PRESERVE_SUPERVISOR_DURING_MIGRATION:-}"

# RCA 2026-07 (mesmo problema visto em produção — ver comentário irmão em
# deploy_safe_dashboard.sh): preservar o supervisor em modo remote durante uma
# migration DDL pendente não é lock transitório, é permanente enquanto os
# bot-workers filhos escrevem no SQLite. Por default o script se auto-corrige:
# se as 5 tentativas preservando o supervisor esgotarem, ele PARA o
# bot-supervisor-staging sozinho, tenta de novo e religa ao final — sem
# disparo manual. Reconecta as sessões WhatsApp de staging automaticamente.
# Rollback sem redeploy: AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION=0.
AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION="${AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION:-1}"

# APP_ENV precisa existir no ambiente do BUILD do Next (headers() é avaliado em
# `npm run build` e gravado no routes-manifest). Staging é HTTP, então força
# 'staging' para manter CSP em report-only e NÃO emitir HSTS — o smoke abaixo
# rejeita HSTS sobre HTTP.
export APP_ENV="${APP_ENV:-staging}"

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

assert_dashboard_security_headers() {
  local url="${VISUAL_BASE_URL%/}/login"
  local headers_file
  local normalized_headers_file

  headers_file=$(mktemp /tmp/wabot_staging_security_headers.XXXXXX)
  normalized_headers_file=$(mktemp /tmp/wabot_staging_security_headers_normalized.XXXXXX)

  if ! curl -fsSI --max-time 10 "$url" -o "$headers_file"; then
    echo "ERRO: não foi possível obter headers de segurança de ${url}."
    rm -f "$headers_file" "$normalized_headers_file"
    exit 1
  fi

  tr -d '\r' < "$headers_file" > "$normalized_headers_file"
  rm -f "$headers_file"

  local required_exact_headers=(
    'X-Content-Type-Options:[[:space:]]*nosniff[[:space:]]*$'
    'X-Frame-Options:[[:space:]]*SAMEORIGIN[[:space:]]*$'
    'Referrer-Policy:[[:space:]]*strict-origin-when-cross-origin[[:space:]]*$'
  )

  for expected_header in "${required_exact_headers[@]}"; do
    if ! grep -Eqi "^${expected_header}" "$normalized_headers_file"; then
      echo "ERRO: header de segurança ausente ou inválido em ${url}: ${expected_header}"
      cat "$normalized_headers_file"
      rm -f "$normalized_headers_file"
      exit 1
    fi
  done

  for required_header in 'Permissions-Policy' 'Content-Security-Policy-Report-Only'; do
    if ! grep -Eqi "^${required_header}:[[:space:]]*.+" "$normalized_headers_file"; then
      echo "ERRO: header de segurança ausente ou vazio em ${url}: ${required_header}"
      cat "$normalized_headers_file"
      rm -f "$normalized_headers_file"
      exit 1
    fi
  done

  if grep -Eqi '^Strict-Transport-Security:' "$normalized_headers_file"; then
    echo "ERRO: staging HTTP não deve enviar Strict-Transport-Security em ${url}. Headers:"
    cat "$normalized_headers_file"
    rm -f "$normalized_headers_file"
    exit 1
  fi

  rm -f "$normalized_headers_file"
  echo "  Headers de segurança do dashboard validados em ${url}"
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


assert_next_static_assets_available() {
  local label="$1"
  local page_url="$2"
  local origin="$3"
  local html_file
  local assets_file

  html_file=$(mktemp /tmp/wabot_next_assets_html.XXXXXX)
  assets_file=$(mktemp /tmp/wabot_next_assets_list.XXXXXX)

  if ! curl -fsS --max-time 15 "$page_url" -o "$html_file"; then
    echo "ERRO: não foi possível baixar HTML de ${label} (${page_url}) para validar assets do Next."
    rm -f "$html_file" "$assets_file"
    exit 1
  fi

  node - "$html_file" > "$assets_file" <<'NODE'
const { readFileSync } = require('node:fs')
const html = readFileSync(process.argv[2], 'utf8')
const assets = new Set()
const re = /(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g
let match
while ((match = re.exec(html))) {
  const value = match[1].replace(/&amp;/g, '&')
  if (/\.(?:js|css)(?:\?|$)/.test(value)) assets.add(value)
}
for (const asset of assets) console.log(asset)
NODE

  if [[ ! -s "$assets_file" ]]; then
    echo "ERRO: HTML de ${label} não referenciou assets JS/CSS em /_next/static. Isso indica build incompleto ou resposta inesperada."
    head -c 1200 "$html_file" || true
    echo
    rm -f "$html_file" "$assets_file"
    exit 1
  fi

  while IFS= read -r asset_path; do
    local asset_url="$asset_path"
    if [[ "$asset_url" == /_next/* ]]; then
      asset_url="${origin%/}${asset_url}"
    fi
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$asset_url" || echo "000")
    echo "  asset ${asset_url} -> HTTP ${code}"
    if [[ "$code" != "200" ]]; then
      echo "ERRO: asset do Next referenciado por ${label} indisponível (HTTP ${code}): ${asset_url}"
      echo "Causa provável: HTML e .next/static fora de sincronia ou build/deploy incompleto. Abortando para não publicar Admin quebrado."
      rm -f "$html_file" "$assets_file"
      exit 1
    fi
  done < "$assets_file"

  rm -f "$html_file" "$assets_file"
  echo "  Assets JS/CSS do Next validados para ${label}"
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



kill_port_listeners() {
  local port="$1"
  local label="$2"

  if [[ -z "$port" ]]; then
    return 0
  fi

  if command -v fuser >/dev/null 2>&1; then
    if fuser -k "${port}/tcp" >/tmp/wabot_fuser_${port}.log 2>&1; then
      echo "  Listeners órfãos de ${label} na porta ${port} encerrados via fuser."
      return 0
    fi
  fi

  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti tcp:"$port" 2>/dev/null | tr '\n' ' ' || true)
    if [[ -n "$pids" ]]; then
      echo "  Encerrando listeners órfãos de ${label} na porta ${port}: ${pids}"
      kill $pids >/dev/null 2>&1 || true
      sleep 2
      pids=$(lsof -ti tcp:"$port" 2>/dev/null | tr '\n' ' ' || true)
      if [[ -n "$pids" ]]; then
        kill -9 $pids >/dev/null 2>&1 || true
      fi
    fi
  fi
}

recreate_frontend_pm2_app() {
  local app_name="$1"
  local port="$2"

  # Apps Next iniciados historicamente via `npm start` podem deixar o processo
  # filho `next start` órfão após `pm2 restart`. O órfão continua segurando a
  # porta e servindo HTML de um build antigo, enquanto .next/static já aponta
  # para outro build — exatamente o 404 em /_next/static visto no /admin.
  # Para dashboard/visual, deploy deve ser start fresco: delete PM2 + limpar
  # listener da porta + start pelo ecosystem (que agora chama o binário do Next
  # diretamente, sem wrapper npm).
  pm2 delete "$app_name" >/dev/null 2>&1 || true
  kill_port_listeners "$port" "$app_name"

  if pm2 start "$ROOT_DIR/ecosystem.config.cjs" --only "$app_name" --update-env >/tmp/wabot_pm2_start_${app_name}.log 2>&1; then
    echo "  PM2 frontend '$app_name' recriado com processo Next fresco."
    return 0
  fi

  echo "ERRO: não foi possível recriar frontend '$app_name' via ecosystem.config.cjs."
  cat /tmp/wabot_pm2_start_${app_name}.log || true
  exit 1
}

ensure_pm2_app_running() {
  local app_name="$1"

  if pm2 describe "$app_name" >/dev/null 2>&1; then
    # `pm2 describe` passar NÃO garante que o restart funcione: se o daemon foi
    # respawnado (ex.: `pm2 update`) o app pode seguir no dump mas com o slot de
    # processo inválido — aí `pm2 restart` falha com 'Process N not found' e, sob
    # set -e, abortaria o deploy. Nesse caso, derruba o registro órfão e recria.
    if pm2 restart "$app_name" --update-env; then
      return 0
    fi
    echo "  Aviso: restart de '$app_name' falhou (registro órfão no PM2). Recriando via ecosystem.config.cjs..."
    pm2 delete "$app_name" >/dev/null 2>&1 || true
  else
    echo "  Aviso: processo PM2 '$app_name' não encontrado. Tentando criar via ecosystem.config.cjs..."
  fi

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
    if [[ "$AUTO_STASH_ON_DIRTY" == "1" || "$FORCE_RESET_ON_SYNC" == "1" ]]; then
      echo "  Aviso: working tree sujo detectado. Aplicando stash automático (rede de recuperação) antes do sync."
      git stash push --include-untracked --message "auto-stash deploy_safe_staging $(date -u +%Y-%m-%dT%H:%M:%SZ)" >/tmp/wabot_staging_autostash.log || true
      git status --short --branch
    else
      echo "ERRO: working tree possui alterações locais. Resolva antes de SYNC_GIT=1 para evitar sobrescrever staging."
      echo "Dica: rode com AUTO_STASH_ON_DIRTY=1 para stash automático (somente staging)."
      exit 1
    fi
  fi
  # Referência do "ANTES". Aqui o sync é feito pelo próprio script, então medir
  # nesta linha funciona — mas o workflow também passa REVISION_BEFORE_DEPLOY,
  # e respeitá-lo mantém as duas pontas com a MESMA regra (em produção medir
  # aqui dentro é tarde demais; ver o comentário em deploy_safe_dashboard.sh).
  REVISION_BEFORE_SYNC="${REVISION_BEFORE_DEPLOY:-$(git rev-parse HEAD 2>/dev/null || true)}"
  if [[ "$FORCE_RESET_ON_SYNC" == "1" ]]; then
    # Staging é um espelho descartável: sincroniza de forma idempotente com
    # origin/$BRANCH. Imune a working tree suja e a arquivos untracked que
    # colidem com novos arquivos do branch (ex: o git novo >=2.41 aborta o
    # fast-forward da worktree no fetch/pull quando há mudanças locais).
    echo "  FORCE_RESET_ON_SYNC=1 -> hard reset para origin/$BRANCH"
    git fetch origin "$BRANCH"
    git checkout -f "$BRANCH"
    git reset --hard "origin/$BRANCH"
    git clean -fd
  else
    git fetch origin
    git checkout "$BRANCH"
    git pull --ff-only origin "$BRANCH"
  fi
else
  echo "[2/9] Sync git pulado (SYNC_GIT=0). Usando checkout atual."
fi

REVISION_AFTER_SYNC="$(git rev-parse HEAD 2>/dev/null || true)"

# Mesma decisão do deploy de produção (ver scripts/deploy_safe_dashboard.sh):
# o supervisor é reiniciado quando — e só quando — os commits deste deploy
# tocaram código que os WORKERS executam. Sem isso, o fix chega ao disco e fica
# dormente na memória dos workers em execução (RCA 2026-08).
# A lista NÃO é "tudo que o worker importa": ela é "o que, se ficar velho no
# worker, muda o comportamento do robô". Reiniciar o supervisor reconecta TODAS
# as sessões, então cada caminho aqui custa uma reconexão da frota inteira.
#
# Deliberadamente DE FORA (alcançados só pelo caminho de e-mail, e o worker só
# os usa para o aviso interno de número repetido — texto velho ali não muda
# nada para a cliente): src/email/, src/domain/painel/whatsappSafety.js,
# src/tutorialVideo.js, src/leadNurture/unsubscribeToken.js.
#
# Guarda: test/deploy-worker-code-paths.test.js calcula o que o bot-worker e o
# supervisor de fato importam e falha se um arquivo novo não estiver nem aqui
# nem na lista de exceções. Foi assim que 33 arquivos carregados pelo worker
# (entre eles src/detector.js e src/messageDedup.js) ficaram anos de fora sem
# ninguém notar: correção de bot chegava ao disco e não valia nos bots.
WORKER_CODE_PATHS_RE='^(src/bot-worker\.js|src/supervisor/|src/core/|src/converters/|src/monitored[A-Za-z]*\.js|src/message[A-Za-z]*\.js|src/send[A-Za-z]*\.js|src/credential[A-Za-z]*\.js|src/detector\.js|src/smartDelay\.js|src/forwardingPolicy\.js|src/conversionDiagnostics\.js|src/waConnectionTelemetry\.js|src/workerMetadata\.js|src/paths\.js|src/manager\.js|src/db\.js|src/logger\.js|src/analytics\.js|src/errorTaxonomy\.js|src/observability/|src/billing/|src/jobs/|src/events/|src/domain/session/|src/instagram/mirroring/|src/offerQueue/sourceTag\.js|prisma/schema\.prisma|package-lock\.json|patches/)'

SUPERVISOR_APP_NAME="${SUPERVISOR_APP:-bot-supervisor-staging}"
STALE_WORKER_TOLERANCE_SEC="${STALE_WORKER_TOLERANCE_SEC:-60}"

# Segunda opinião, independente do git: os bots em execução estão mais VELHOS
# que o código dos workers no disco? Ver o comentário longo em
# deploy_safe_dashboard.sh. Fail-safe: sem medir os dois lados, devolve "não".
supervisor_started_at_epoch() {
  local pid etimes
  pid="$(pm2 pid "$SUPERVISOR_APP_NAME" 2>/dev/null | tail -n 1 | tr -d '[:space:]')"
  [[ -n "$pid" && "$pid" != "0" ]] || return 1
  etimes="$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d '[:space:]')"
  [[ -n "$etimes" ]] || return 1
  echo $(( $(date +%s) - etimes ))
}

newest_worker_code_epoch() {
  git ls-files 2>/dev/null | grep -E "$WORKER_CODE_PATHS_RE" \
    | xargs -r stat -c %Y 2>/dev/null | sort -n | tail -n 1
}

workers_running_stale_code() {
  local started code
  started="$(supervisor_started_at_epoch)" || return 1
  code="$(newest_worker_code_epoch)"
  [[ -n "$code" ]] || return 1
  (( code - started > STALE_WORKER_TOLERANCE_SEC ))
}

RESTART_SUPERVISOR="${RESTART_SUPERVISOR:-auto}"
if [[ "$RESTART_SUPERVISOR" == "auto" ]]; then
  if [[ -n "${REVISION_BEFORE_SYNC:-}" && -n "${REVISION_AFTER_SYNC:-}" && "$REVISION_BEFORE_SYNC" != "$REVISION_AFTER_SYNC" ]] \
     && git diff --name-only "$REVISION_BEFORE_SYNC" "$REVISION_AFTER_SYNC" 2>/dev/null | grep -qE "$WORKER_CODE_PATHS_RE"; then
    RESTART_SUPERVISOR=1
    echo "  Código dos bots mudou neste deploy — supervisor será reiniciado ao final."
  elif workers_running_stale_code; then
    RESTART_SUPERVISOR=1
    echo "  Os bots estão rodando código MAIS ANTIGO que o do servidor — supervisor será reiniciado ao final."
  else
    RESTART_SUPERVISOR=0
    echo "  Nenhuma mudança em código dos bots — supervisor preservado."
  fi
elif [[ "$RESTART_SUPERVISOR" == "0" ]] && workers_running_stale_code; then
  echo "  ATENÇÃO: os bots continuam com código mais antigo que o do servidor (RESTART_SUPERVISOR=0)."
  echo "  As correções deste deploy NÃO valem até rodar: pm2 restart $SUPERVISOR_APP_NAME --update-env"
fi
export RESTART_SUPERVISOR

echo "[3/9] Install root dependencies sem alterar lockfile"
run_npm_ci_with_recovery "root"

echo "[4/9] Apply database migrations no banco isolado de staging"
# Skip se não houver migrations pendentes — evita tocar no DB enquanto
# PM2 está escrevendo, o que dispara SQLITE_BUSY mesmo com busy_timeout=5000
# do src/db.js. Apps que importam src/db.js e podem segurar staging.db:
# api-staging e bot-supervisor-staging.
SUPERVISOR_APP_FOR_MIGRATION="${SUPERVISOR_APP:-bot-supervisor-staging}"
MIGRATE_STOPPED_APPS=""

# Lê o modo efetivo do supervisor do .env (o deploy não exporta essa env; o
# processo PM2 a carrega via dotenv). Só preservamos o supervisor durante a
# migration quando ele REALMENTE gerencia sessões (modo remote); em inline ele
# está em standby e só segura o lock do SQLite. `.env` é gitignored, então lê
# direto do arquivo em ROOT_DIR.
read_env_var_from_file() {
  local var="$1"
  local file="$ROOT_DIR/.env"
  [[ -f "$file" ]] || return 0
  # Última definição vence; ignora comentários; tolera espaços em torno do `=`
  # (dotenv aceita `KEY = value`); remove aspas e espaços.
  grep -E "^[[:space:]]*${var}[[:space:]]*=" "$file" 2>/dev/null \
    | tail -n 1 \
    | sed -E "s/^[[:space:]]*${var}[[:space:]]*=[[:space:]]*//; s/^[\"']//; s/[\"'][[:space:]]*$//; s/[[:space:]]*$//" \
    || true
}

BOT_SUPERVISOR_MODE_EFFECTIVE="${BOT_SUPERVISOR_MODE:-$(read_env_var_from_file BOT_SUPERVISOR_MODE)}"
BOT_SUPERVISOR_MODE_EFFECTIVE="${BOT_SUPERVISOR_MODE_EFFECTIVE:-inline}"

# Resolve a decisão de preservar. Override explícito (1/0) sempre vence; vazio
# = mode-aware (preserva só em remote, onde parar o supervisor derrubaria os
# bot-workers filhos e invalidaria o teste de cutover).
if [[ -n "$PRESERVE_SUPERVISOR_DURING_MIGRATION" ]]; then
  PRESERVE_SUPERVISOR_EFFECTIVE="$PRESERVE_SUPERVISOR_DURING_MIGRATION"
elif [[ "$BOT_SUPERVISOR_MODE_EFFECTIVE" == "remote" ]]; then
  PRESERVE_SUPERVISOR_EFFECTIVE="1"
else
  PRESERVE_SUPERVISOR_EFFECTIVE="0"
fi

pm2_pid_for_app() {
  pm2 pid "$1" 2>/dev/null | tail -n 1 | tr -d '[:space:]' || true
}

wait_pm2_app_stopped_for_migration() {
  local app="$1"
  local timeout_seconds="${2:-45}"
  local waited=0
  local pid=""

  while [ "$waited" -lt "$timeout_seconds" ]; do
    pid="$(pm2_pid_for_app "$app")"
    if [ -z "$pid" ] || [ "$pid" = "0" ]; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done

  echo "  Aviso: $app ainda parece ativo após ${timeout_seconds}s (pid ${pid:-?}); migration pode continuar recebendo SQLITE_BUSY."
  return 1
}

stop_app_for_migration() {
  local app="$1"

  if ! pm2 describe "$app" >/dev/null 2>&1; then
    return 0
  fi

  if pm2 stop "$app" >/dev/null 2>&1; then
    wait_pm2_app_stopped_for_migration "$app" 45 || true
    MIGRATE_STOPPED_APPS="$MIGRATE_STOPPED_APPS $app"
    echo "    - $app parado"
  else
    echo "    - Aviso: não foi possível parar $app via PM2"
  fi
}

restart_apps_stopped_for_migration() {
  for app in $MIGRATE_STOPPED_APPS; do
    pm2 restart "$app" --update-env >/dev/null 2>&1 || true
  done
}

# Roda `prisma migrate deploy` com retry/backoff. Retorna 0 no sucesso, 1 se
# esgotar as tentativas — não usa `exit` para o chamador decidir o que fazer
# (ex.: escalar antes de desistir).
attempt_migrate_deploy() {
  local max_attempts="$1"
  local label="$2"
  local attempt=0

  until npx prisma migrate deploy; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$max_attempts" ]; then
      return 1
    fi
    local wait_s=$((attempt * 3))
    echo "  migrate ($label) falhou (tentativa $attempt/$max_attempts) — aguardando ${wait_s}s..."
    sleep "$wait_s"
  done
  return 0
}

if npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"; then
  echo "  Nenhuma migration pendente — pulando migrate deploy."
else
  # Há migration pendente. DDL como ALTER TABLE precisa de lock exclusivo no
  # SQLite — incompatível com processos segurando conexões WAL. A API staging
  # pode ser parada na janela de deploy, mas o supervisor é preservado por
  # default para não derrubar sessões quando staging está em modo remote durante
  # testes de cutover. O migrate abaixo já usa retry/backoff primeiro — só
  # escala (ver abaixo) se essas tentativas esgotarem.
  echo "  Migrations pendentes — parando processos que travam o banco..."
  stop_app_for_migration "$API_APP"
  if [[ "$PRESERVE_SUPERVISOR_EFFECTIVE" == "1" ]]; then
    echo "    - $SUPERVISOR_APP_FOR_MIGRATION preservado (modo=$BOT_SUPERVISOR_MODE_EFFECTIVE) para manter sessões WhatsApp ativas"
  else
    echo "    - $SUPERVISOR_APP_FOR_MIGRATION parado (modo=$BOT_SUPERVISOR_MODE_EFFECTIVE): em standby ele não forka workers, só segura o lock do SQLite que faz o DDL estourar 'database is locked'"
    stop_app_for_migration "$SUPERVISOR_APP_FOR_MIGRATION"
  fi

  MIGRATE_OK=0
  if attempt_migrate_deploy 5 "preservando $SUPERVISOR_APP_FOR_MIGRATION"; then
    MIGRATE_OK=1
  fi

  # Escalonamento automático (RCA 2026-07): ver comentário irmão em
  # deploy_safe_dashboard.sh. Mesmo mecanismo, aplicado ao supervisor de
  # staging.
  if [[ "$MIGRATE_OK" != "1" && "$PRESERVE_SUPERVISOR_EFFECTIVE" == "1" && "$AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION" != "0" ]]; then
    echo "  Migration presa com $SUPERVISOR_APP_FOR_MIGRATION preservado (modo=$BOT_SUPERVISOR_MODE_EFFECTIVE)."
    echo "  Escalando: parando $SUPERVISOR_APP_FOR_MIGRATION para destravar o lock exclusivo do SQLite"
    echo "  (reconecta as sessões WhatsApp de staging; AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION=0 desativa)."
    stop_app_for_migration "$SUPERVISOR_APP_FOR_MIGRATION"
    if attempt_migrate_deploy 3 "pós-escalonamento"; then
      MIGRATE_OK=1
      echo "  Migration aplicada após parar $SUPERVISOR_APP_FOR_MIGRATION."
    fi
  fi

  if [[ "$MIGRATE_OK" != "1" ]]; then
    echo "ERRO: prisma migrate deploy falhou após esgotar as tentativas."
    restart_apps_stopped_for_migration
    exit 1
  fi

  if [ -n "$MIGRATE_STOPPED_APPS" ]; then
    echo "  Migrations aplicadas. Religando:$MIGRATE_STOPPED_APPS"
    restart_apps_stopped_for_migration
  fi
fi

echo "  Regenerando Prisma Client após validação/aplicação das migrations..."
npx prisma generate

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
recreate_frontend_pm2_app "$VISUAL_APP" "$VISUAL_PORT"

# O supervisor NÃO é reiniciado em todo deploy — o ponto do desacoplamento é
# que deploy da API não derrube as sessões WhatsApp. Mas quando o deploy traz
# código que os workers executam, preservá-lo faria o fix ficar dormente: o
# passo de sync já decidiu isso e RESTART_SUPERVISOR chega aqui como 1 ou 0.
# Escape hatch: RESTART_SUPERVISOR=0 preserva sempre; =1 reinicia sempre.
SUPERVISOR_APP="${SUPERVISOR_APP:-$SUPERVISOR_APP_NAME}"
if [[ "${RESTART_SUPERVISOR:-0}" == "1" ]]; then
  echo "  Reiniciando $SUPERVISOR_APP para os bots carregarem o código novo"
  ensure_pm2_app_running "$SUPERVISOR_APP"
else
  echo "  bot-supervisor preservado (RESTART_SUPERVISOR=0). Sessões continuam ativas."
fi

pm2 save

echo "[8/9] PM2 status"
pm2 status

echo "[9/9] Smoke tests staging"
check_http_with_retry "visual /login" "${VISUAL_BASE_URL%/}/login" 8 2
check_http_with_retry "visual /admin" "${VISUAL_BASE_URL%/}/admin" 8 2
assert_next_static_assets_available "visual /admin" "${VISUAL_BASE_URL%/}/admin" "$VISUAL_BASE_URL"
assert_dashboard_security_headers
echo "  Validando abertura mobile do site (/ e /login)"
"$ROOT_DIR/scripts/smoke_mobile_dashboard.sh" "$VISUAL_BASE_URL" / /login
check_http_with_retry "api /health" "${API_BASE_URL%/}/health" 8 2
assert_login_api_not_next_404

echo "Deploy safe staging concluído. Valide login real em ${VISUAL_BASE_URL%/}/login antes de qualquer produção."
