#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="${ROOT_DIR:-$DEFAULT_ROOT_DIR}"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
BRANCH="${BRANCH:-main}"
FORCE_RESET_ON_SYNC="${FORCE_RESET_ON_SYNC:-0}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"
# A blindagem das sessões WhatsApp depende de o bot-supervisor continuar vivo
# enquanto a API/dashboard são reciclados. Preservá-lo durante a migration só
# faz sentido em modo remote, onde ele de fato forka os bot-workers: pará-lo aí
# mata os filhos e derruba as conexões Baileys dos clientes. No modo canônico
# (inline) ele fica em STANDBY — não forka worker nenhum, mas `import db.js` no
# boot abre conexão WAL no prod.db, e essa conexão sozinha segura o lock que faz
# o DDL do `prisma migrate deploy` estourar 'database is locked' (pegadinha #8).
# Vazio (default) = mode-aware (preserva só em remote); força 1/0 só em janela
# explícita de manutenção/cutover.
PRESERVE_SUPERVISOR_DURING_MIGRATION="${PRESERVE_SUPERVISOR_DURING_MIGRATION:-}"

# RCA 2026-07: preservar o bot-supervisor em modo remote durante uma migration
# DDL pendente não é um lock transitório — os bot-workers filhos escrevem no
# SQLite continuamente, então NUNCA existe janela livre pro `prisma migrate
# deploy` conseguir o lock exclusivo. As 5 tentativas com backoff sempre
# esgotam e o deploy automático fica preso até alguém disparar manualmente o
# workflow_dispatch com stop_supervisor_for_migration=true. Isso já aconteceu
# 2x seguidas em produção (2026-07-14 e 2026-07-15) e exigiu intervenção
# humana nas duas. Por default agora o script se auto-corrige: se as 5
# tentativas preservando o supervisor esgotarem, ele PARA o bot-supervisor
# sozinho (fecha workers + conexão Prisma via shutdown() do supervisor — não é
# kill duro), tenta de novo, e religa ao final — sem precisar de disparo
# manual. Isso reconecta TODAS as sessões WhatsApp automaticamente, sem aviso
# prévio, toda vez que uma migration de schema for mergeada em main enquanto
# BOT_SUPERVISOR_MODE=remote estiver ativo. Rollback sem redeploy: setar
# AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION=0 (no .env ou inline no comando SSH)
# volta ao comportamento antigo (fail-safe + runbook manual).
AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION="${AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION:-1}"

# APP_ENV precisa existir no ambiente do BUILD, não só no runtime do PM2.
# O Next.js avalia next.config headers() em tempo de `npm run build` e grava
# o resultado em .next/routes-manifest.json; `next start` só serve o manifest.
# Sem isto, o build de produção gera CSP em report-only e sem HSTS (o fallback
# de quando APP_ENV não é 'production'), independentemente do env do PM2.
export APP_ENV="${APP_ENV:-production}"

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
  # Reinicia o app se ele existir; senão, cria a partir do ecosystem.config.cjs.
  # Sob `set -e`, um `pm2 restart <app>` cru aborta o deploy inteiro quando o
  # processo não está registrado no PM2 do VPS (ex.: daemon respawnado pelo
  # `pm2 update`, dump não salvo, ou app nunca criado). Espelha o helper do
  # deploy_safe_staging.sh para tornar o restart idempotente.
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
  echo "Dica: valide o nome do app no PM2 (pm2 status) e no ecosystem.config.cjs de produção."
  exit 1
}

check_http_with_retry() {
  local path="$1"
  local attempts="${2:-8}"
  local sleep_seconds="${3:-2}"
  local url="https://espelhagrupos.com.br${path}"

  for ((i=1; i<=attempts; i++)); do
    local code
    code=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo "000")
    echo "  tentativa ${i}/${attempts} ${path} -> HTTP ${code}"
    if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" || "$code" == "307" || "$code" == "308" ]]; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "Smoke test falhou para ${path} após ${attempts} tentativas."
  return 1
}


assert_next_static_assets_available() {
  local label="$1"
  local page_url="$2"
  local origin="$3"
  local html_file
  local assets_file

  html_file=$(mktemp /tmp/wabot_next_assets_html.XXXXXX)
  assets_file=$(mktemp /tmp/wabot_next_assets_list.XXXXXX)

  if ! curl -fsSL --max-time 15 "$page_url" -o "$html_file"; then
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
    code=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 15 "$asset_url" || echo "000")
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
# Ponto de referência do "ANTES" do deploy.
#
# ⚠️ Não pode ser medido aqui dentro em produção. O passo "Deploy via SSH" do
# .github/workflows/deploy.yml faz `git fetch/checkout/reset --hard origin/main`
# ANTES de chamar este script, então quando chegamos nesta linha o clone JÁ está
# no commit novo — `git rev-parse HEAD` devolveria o DEPOIS nos dois lados, o
# diff sairia vazio e a detecção de "código dos bots mudou" nunca dispararia.
#
# Foi exatamente isso que aconteceu (RCA 2026-08-31): desde que o auto-restart
# foi criado, TODO deploy de produção imprimiu "Nenhuma mudança em código dos
# bots" e o bot-supervisor nunca foi reiniciado — enquanto em staging, cujo
# workflow não faz o reset inline, a mesma lógica funcionava. Resultado: todo
# fix em bot-worker.js chegava ao disco de produção e ficava dormente na
# memória dos workers.
#
# Por isso o workflow passa REVISION_BEFORE_DEPLOY, capturado antes do reset.
REVISION_BEFORE_SYNC="${REVISION_BEFORE_DEPLOY:-$(git rev-parse HEAD 2>/dev/null || true)}"
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

REVISION_AFTER_SYNC="$(git rev-parse HEAD 2>/dev/null || true)"

# Em modo `remote` o deploy reinicia a API mas NÃO os bot-workers — de propósito,
# para não derrubar as sessões. O preço era que toda correção em bot-worker.js ou
# no pipeline de mensagem chegava ao disco e continuava SEM VALER, porque os
# workers em execução seguem com o módulo antigo em memória. Isso já custou três
# fixes seguidos entregues "verdes" e sem efeito (RCA 2026-08, seção "código novo
# não carregado pelos bots" do AGENTS.md), e a descoberta veio da cliente
# reclamando pela terceira vez.
#
# Agora o próprio deploy decide: se os commits que acabaram de entrar tocaram
# código que os WORKERS executam, o supervisor é reiniciado ao final. Se tocaram
# só API/dashboard/docs/testes, ele é preservado (nenhuma sessão cai).
#
# ⚠️ Reiniciar o supervisor RECONECTA TODAS AS SESSÕES WHATSAPP de uma vez.
# Por isso a detecção é conservadora: só os caminhos abaixo, que são exatamente
# os que o processo do worker carrega.
WORKER_CODE_PATHS_RE='^(src/bot-worker\.js|src/supervisor/|src/core/|src/converters/|src/monitored[A-Za-z]*\.js|src/messageProcessor\.js|src/manager\.js|src/db\.js|src/logger\.js|src/analytics\.js|src/errorTaxonomy\.js|src/observability/|src/billing/|prisma/schema\.prisma|package-lock\.json)'

worker_code_changed_in_sync() {
  [[ -n "$REVISION_BEFORE_SYNC" && -n "$REVISION_AFTER_SYNC" ]] || return 1
  [[ "$REVISION_BEFORE_SYNC" != "$REVISION_AFTER_SYNC" ]] || return 1
  git diff --name-only "$REVISION_BEFORE_SYNC" "$REVISION_AFTER_SYNC" 2>/dev/null \
    | grep -qE "$WORKER_CODE_PATHS_RE"
}

SUPERVISOR_APP_NAME="${SUPERVISOR_APP:-bot-supervisor}"
# Mesma folga do guard da API (src/ops/staleWorkerCodeGuard.js): num deploy
# normal o sync e o restart acontecem quase juntos.
STALE_WORKER_TOLERANCE_SEC="${STALE_WORKER_TOLERANCE_SEC:-60}"

# SEGUNDA OPINIÃO, independente do git: o processo que está rodando é mais VELHO
# que o código dos workers no disco?
#
# A comparação por commit responde "este deploy trouxe código de bot?"; esta
# responde "os bots estão rodando o código que está no disco?" — que é a
# pergunta que de fato importa e que continua valendo quando o commit anterior
# se perde (sync feito fora do script, deploy anterior que não reiniciou,
# RESTART_SUPERVISOR=0 de uma janela antiga). É o mesmo sinal que a API já
# calcula em src/ops/codeVersion.js, aqui aplicado só aos caminhos que o worker
# de fato carrega — usar `src/` inteiro reiniciaria as sessões a cada deploy de
# rota da API, que é o oposto do que queremos.
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

# Fail-safe: sem conseguir medir os dois lados devolve "não" (preserva as
# sessões). Perder um restart é recuperável; reconectar todas as sessões por
# causa de uma medição furada, não.
workers_running_stale_code() {
  local started code
  started="$(supervisor_started_at_epoch)" || return 1
  code="$(newest_worker_code_epoch)"
  [[ -n "$code" ]] || return 1
  (( code - started > STALE_WORKER_TOLERANCE_SEC ))
}

# 'auto' (default) = reinicia só quando o código dos workers mudou.
# '1' = sempre reinicia. '0' = nunca (preserva sessões mesmo com código novo,
# assumindo que o fix vai ficar dormente até alguém reiniciar à mão).
RESTART_SUPERVISOR="${RESTART_SUPERVISOR:-auto}"
if [[ "$RESTART_SUPERVISOR" == "auto" ]]; then
  if worker_code_changed_in_sync; then
    RESTART_SUPERVISOR=1
    echo "  Código dos bots mudou neste deploy — bot-supervisor será reiniciado ao final."
    echo "  (isso reconecta TODAS as sessões WhatsApp; RESTART_SUPERVISOR=0 desativa)"
    git diff --name-only "$REVISION_BEFORE_SYNC" "$REVISION_AFTER_SYNC" 2>/dev/null \
      | grep -E "$WORKER_CODE_PATHS_RE" | sed 's/^/    /' | head -20
  elif workers_running_stale_code; then
    RESTART_SUPERVISOR=1
    echo "  Os bots estão rodando código MAIS ANTIGO que o do servidor — bot-supervisor será reiniciado ao final."
    echo "  (rede de segurança: pega deploy que ficou dormente e sync feito fora deste script)"
    echo "  (isso reconecta TODAS as sessões WhatsApp; RESTART_SUPERVISOR=0 desativa)"
  else
    RESTART_SUPERVISOR=0
    echo "  Nenhuma mudança em código dos bots — bot-supervisor preservado, sessões intactas."
  fi
elif [[ "$RESTART_SUPERVISOR" == "0" ]] && workers_running_stale_code; then
  # Escolha explícita de preservar as sessões. Legítima — mas não pode ser
  # silenciosa: enquanto o supervisor não reiniciar, as correções deste deploy
  # não valem para nenhum cliente.
  echo "  ATENÇÃO: os bots continuam com código mais antigo que o do servidor (RESTART_SUPERVISOR=0)."
  echo "  As correções deste deploy NÃO valem para os clientes até rodar:"
  echo "    pm2 restart $SUPERVISOR_APP_NAME --update-env && pm2 save"
fi
export RESTART_SUPERVISOR

echo "[2/9] Install root dependencies sem alterar lockfile"
run_npm_ci_with_recovery "root"

echo "[3/9] Apply database migrations"
# Skip se não houver migrations pendentes — evita tocar no DB enquanto
# PM2 está escrevendo, o que dispara SQLITE_BUSY mesmo com busy_timeout=5000
# do src/db.js. Apps que importam src/db.js e podem segurar prod.db:
# api, bot-supervisor e snapshot-cron.
MIGRATE_STOPPED_APPS_PROD=""
MIGRATE_STOPPED_NO_RESTART_APPS_PROD=""

# Lê o modo efetivo do supervisor do .env (o deploy não exporta essa env; o
# processo PM2 a carrega via dotenv). Preserva o supervisor durante a migration
# só quando ele REALMENTE gerencia sessões (modo remote). `.env` é gitignored,
# então lê direto do arquivo em ROOT_DIR.
read_env_var_from_file_prod() {
  local var="$1"
  local file="$ROOT_DIR/.env"
  [[ -f "$file" ]] || return 0
  grep -E "^[[:space:]]*${var}[[:space:]]*=" "$file" 2>/dev/null \
    | tail -n 1 \
    | sed -E "s/^[[:space:]]*${var}[[:space:]]*=[[:space:]]*//; s/^[\"']//; s/[\"'][[:space:]]*$//; s/[[:space:]]*$//" \
    || true
}

BOT_SUPERVISOR_MODE_EFFECTIVE="${BOT_SUPERVISOR_MODE:-$(read_env_var_from_file_prod BOT_SUPERVISOR_MODE)}"
BOT_SUPERVISOR_MODE_EFFECTIVE="${BOT_SUPERVISOR_MODE_EFFECTIVE:-inline}"

# Override explícito (1/0) sempre vence; vazio = mode-aware.
if [[ -n "$PRESERVE_SUPERVISOR_DURING_MIGRATION" ]]; then
  PRESERVE_SUPERVISOR_EFFECTIVE="$PRESERVE_SUPERVISOR_DURING_MIGRATION"
elif [[ "$BOT_SUPERVISOR_MODE_EFFECTIVE" == "remote" ]]; then
  PRESERVE_SUPERVISOR_EFFECTIVE="1"
else
  PRESERVE_SUPERVISOR_EFFECTIVE="0"
fi

pm2_pid_for_app_prod() {
  pm2 pid "$1" 2>/dev/null | tail -n 1 | tr -d '[:space:]' || true
}

wait_pm2_app_stopped_for_migration_prod() {
  local app="$1"
  local timeout_seconds="${2:-45}"
  local waited=0
  local pid=""

  while [ "$waited" -lt "$timeout_seconds" ]; do
    pid="$(pm2_pid_for_app_prod "$app")"
    if [ -z "$pid" ] || [ "$pid" = "0" ]; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done

  echo "  Aviso: $app ainda parece ativo após ${timeout_seconds}s (pid ${pid:-?}); migration pode continuar recebendo SQLITE_BUSY."
  return 1
}

stop_app_for_migration_prod() {
  local app="$1"
  local restart_after="${2:-1}"

  if ! pm2 describe "$app" >/dev/null 2>&1; then
    return 0
  fi

  if pm2 stop "$app" >/dev/null 2>&1; then
    wait_pm2_app_stopped_for_migration_prod "$app" 45 || true
    if [ "$restart_after" = "1" ]; then
      MIGRATE_STOPPED_APPS_PROD="$MIGRATE_STOPPED_APPS_PROD $app"
      echo "    - $app parado"
    else
      MIGRATE_STOPPED_NO_RESTART_APPS_PROD="$MIGRATE_STOPPED_NO_RESTART_APPS_PROD $app"
      echo "    - $app parado (não será reiniciado fora da janela do cron)"
    fi
  else
    echo "    - Aviso: não foi possível parar $app via PM2"
  fi
}

restart_apps_stopped_for_migration_prod() {
  for app in $MIGRATE_STOPPED_APPS_PROD; do
    pm2 restart "$app" --update-env >/dev/null 2>&1 || true
  done
  if [ -n "$MIGRATE_STOPPED_NO_RESTART_APPS_PROD" ]; then
    echo "  Apps parados para liberar o banco e preservados sem restart imediato:$MIGRATE_STOPPED_NO_RESTART_APPS_PROD"
  fi
}

# Roda `prisma migrate deploy` com retry/backoff. Retorna 0 no sucesso, 1 se
# esgotar as tentativas — não usa `exit` para o chamador decidir o que fazer
# (ex.: escalar antes de desistir).
attempt_migrate_deploy_prod() {
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
  # SQLite — incompatível com processos segurando conexões WAL. A API e o cron
  # podem ser parados na janela de deploy, mas o bot-supervisor é o dono das
  # sessões WhatsApp em modo remote; pará-lo aqui desfaz a blindagem prometida
  # ("deploy da API não derruba sessões"). Por isso ele é preservado por
  # default e o migrate usa retry/backoff primeiro — só escala (ver abaixo)
  # se essas tentativas esgotarem.
  echo "  Migrations pendentes — parando processos que travam o banco..."
  stop_app_for_migration_prod "api" 1
  if [[ "$PRESERVE_SUPERVISOR_EFFECTIVE" == "1" ]]; then
    echo "    - bot-supervisor preservado (modo=$BOT_SUPERVISOR_MODE_EFFECTIVE) para manter sessões WhatsApp ativas"
  else
    echo "    - bot-supervisor parado (modo=$BOT_SUPERVISOR_MODE_EFFECTIVE): em standby ele não forka workers, só segura o lock do SQLite que faz o DDL estourar 'database is locked'"
    stop_app_for_migration_prod "bot-supervisor" 1
  fi
  stop_app_for_migration_prod "snapshot-cron" 0

  MIGRATE_OK=0
  if attempt_migrate_deploy_prod 5 "preservando bot-supervisor"; then
    MIGRATE_OK=1
  fi

  # Escalonamento automático (RCA 2026-07, ver comentário de
  # AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION no topo do arquivo): quando o
  # bot-supervisor foi preservado (modo=remote) e mesmo assim as 5 tentativas
  # esgotaram, o lock não é transitório — não existe janela livre enquanto ele
  # segue forkando workers que escrevem no SQLite continuamente. Em vez de
  # abortar e esperar disparo manual do workflow, para o bot-supervisor
  # (fecha workers + Prisma via shutdown() dele, não é kill duro), tenta de
  # novo (deve resolver rápido) e religa ao final via
  # restart_apps_stopped_for_migration_prod — reconecta TODAS as sessões
  # WhatsApp como efeito colateral.
  if [[ "$MIGRATE_OK" != "1" && "$PRESERVE_SUPERVISOR_EFFECTIVE" == "1" && "$AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION" != "0" ]]; then
    echo "  Migration presa com bot-supervisor preservado (modo=$BOT_SUPERVISOR_MODE_EFFECTIVE)."
    echo "  Escalando: parando bot-supervisor para destravar o lock exclusivo do SQLite"
    echo "  (reconecta TODAS as sessões WhatsApp; AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION=0 desativa este escalonamento)."
    stop_app_for_migration_prod "bot-supervisor" 1
    if attempt_migrate_deploy_prod 3 "pós-escalonamento"; then
      MIGRATE_OK=1
      echo "  Migration aplicada após parar bot-supervisor."
    fi
  fi

  if [[ "$MIGRATE_OK" != "1" ]]; then
    echo "ERRO: prisma migrate deploy falhou após esgotar as tentativas."
    if [[ "$PRESERVE_SUPERVISOR_EFFECTIVE" == "1" ]]; then
      echo "  Causa provável (pegadinha #8 do AGENTS.md): bot-supervisor segue"
      echo "  (modo=$BOT_SUPERVISOR_MODE_EFFECTIVE) segurando conexão WAL no SQLite; sob"
      echo "  escrita contínua dos bot-workers, o migrate não encontra a janela de lock"
      echo "  exclusivo que uma DDL (CREATE TABLE/ALTER TABLE) precisa."
      if [[ "$AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION" == "0" ]]; then
        echo "  AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION=0 — escalonamento automático desativado."
      else
        echo "  O escalonamento automático (parar bot-supervisor) também falhou — algo além"
        echo "  do lock de migration está impedindo o prisma migrate deploy."
      fi
      echo "  Deploy NÃO foi aplicado a propósito (fail-safe) — código já está em"
      echo "  \$BRANCH mas o schema do banco ficou parado na versão anterior; \`api\`"
      echo "  já foi religada com o código novo (sem quebrar, pois nada no boot exige"
      echo "  a tabela nova ainda)."
      echo "  Para destravar manualmente (janela curta, reconecta TODAS as sessões WA"
      echo "  — anunciar antes):"
      echo "    pm2 stop bot-supervisor"
      echo "    cd $ROOT_DIR && npx prisma migrate deploy"
      echo "    pm2 restart bot-supervisor --update-env && pm2 save"
    fi
    restart_apps_stopped_for_migration_prod
    exit 1
  fi

  if [ -n "$MIGRATE_STOPPED_APPS_PROD" ] || [ -n "$MIGRATE_STOPPED_NO_RESTART_APPS_PROD" ]; then
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

echo "[7/9] Verificando PM2 sem reciclar daemon"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERRO: pm2 não encontrado no PATH."
  exit 1
fi

# `pm2 update` faz stop/delete de TODOS os apps, para o daemon e restaura o
# dump.pm2. Em produção isso reinicia `bot-supervisor` e mata os bot-workers
# filhos — exatamente o oposto da blindagem remote. Só permita em janela manual
# explícita, ciente de que as sessões WhatsApp podem reconectar/cair.
if [[ "${PM2_UPDATE_DURING_DEPLOY:-0}" == "1" ]]; then
  echo "  ATENÇÃO: PM2_UPDATE_DURING_DEPLOY=1 — pm2 update recicla o daemon e pode derrubar sessões WhatsApp."
  pm2 update >/tmp/wabot_pm2_update.log 2>&1 || {
    echo "  Aviso: pm2 update falhou; seguindo com restart padrão."
    tail -n 20 /tmp/wabot_pm2_update.log || true
  }
else
  echo "  Pulando pm2 update para preservar bot-supervisor e sessões WhatsApp."
fi

SUPERVISOR_PID_BEFORE="$(pm2 pid bot-supervisor 2>/dev/null | tail -n 1 | tr -d '[:space:]' || true)"

echo "[7b/9] Restart PM2 apps"
recreate_frontend_pm2_app "dashboard" "$DASHBOARD_PORT"
ensure_pm2_app_running "api"

# bot-supervisor (prod) é preservado por padrão para não derrubar as sessões,
# MAS o passo [1/9] já decidiu por você: se os commits deste deploy tocaram
# código que os workers executam (WORKER_CODE_PATHS_RE), RESTART_SUPERVISOR
# chega aqui como 1 e o supervisor reinicia — senão o fix ficaria no disco sem
# valer (RCA 2026-08). Escape hatch: RESTART_SUPERVISOR=0 preserva sempre;
# RESTART_SUPERVISOR=1 reinicia sempre.
if [[ "${RESTART_SUPERVISOR:-0}" == "1" ]]; then
  echo "  Reiniciando bot-supervisor para os bots carregarem o código novo (sessões reconectam)"
  pm2 restart bot-supervisor --update-env
else
  echo "  bot-supervisor preservado. Sessões WhatsApp continuam ativas."
fi

SUPERVISOR_PID_AFTER="$(pm2 pid bot-supervisor 2>/dev/null | tail -n 1 | tr -d '[:space:]' || true)"
if [[ "${RESTART_SUPERVISOR:-0}" != "1" && -n "$SUPERVISOR_PID_BEFORE" && "$SUPERVISOR_PID_BEFORE" != "$SUPERVISOR_PID_AFTER" ]]; then
  echo "ERRO: bot-supervisor reiniciou durante o deploy (${SUPERVISOR_PID_BEFORE} -> ${SUPERVISOR_PID_AFTER})."
  echo "Isso quebra a blindagem WhatsApp; investigue comandos PM2 que reciclam o daemon/processo."
  exit 1
fi

API_PID_AFTER="$(pm2 pid api 2>/dev/null | tail -n 1 | tr -d '[:space:]' || true)"
if [[ -n "$API_PID_AFTER" ]]; then
  API_OWNED_WORKERS="$(ps -eo pid=,ppid=,cmd= | awk -v api="$API_PID_AFTER" '$2 == api && $0 ~ /\/home\/deploy\/wabot\/src\/bot-worker\.js/ { print }' || true)"
  if [[ -n "$API_OWNED_WORKERS" ]]; then
    echo "ERRO: há bot-worker de produção filho da API; modo remote não está efetivo:"
    echo "$API_OWNED_WORKERS"
    exit 1
  fi
fi

echo "[8/9] PM2 status"
pm2 status

echo "[9/9] Smoke tests (hard gate com retry)"
for path in /login /admin /painel; do
  check_http_with_retry "$path" 8 2
done
assert_next_static_assets_available "dashboard /admin" "https://espelhagrupos.com.br/admin" "https://espelhagrupos.com.br"

echo "  Validando abertura mobile do site (/ e /login)"
"$ROOT_DIR/scripts/smoke_mobile_dashboard.sh" "https://espelhagrupos.com.br" / /login

echo "  Validando proxy /api/auth/login (não pode ser 404/prerender do Next.js)"
api_code=$(curl -s -o /tmp/wabot_login_smoke_body.txt -D /tmp/wabot_login_smoke_headers.txt -w "%{http_code}" \
  --max-time 10 \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"email":"smoke@example.invalid","password":"invalid"}' \
  https://espelhagrupos.com.br/api/auth/login || echo "000")
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
