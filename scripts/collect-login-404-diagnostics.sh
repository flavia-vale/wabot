#!/usr/bin/env bash
set -u

# Coleta assertiva para investigar POST /api/auth/login retornando 404 HTML do Next.js.
# Uso staging recomendado:
#   cd ~/wabot-staging && bash scripts/collect-login-404-diagnostics.sh http://178.105.54.0:3006

BASE_URL="${1:-http://127.0.0.1:3006}"
API_URL="${API_URL:-http://127.0.0.1:3004}"
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUT:-/tmp/wabot-login-404-diagnostics-${STAMP}.log}"

redact() {
  sed -E \
    -e 's/(Authorization: Bearer )[A-Za-z0-9._~+\/-]+=*/\1<REDACTED>/Ig' \
    -e 's/(Cookie: )[^\r]*/\1<REDACTED>/Ig' \
    -e 's/(Set-Cookie: )[^\r]*/\1<REDACTED>/Ig' \
    -e 's/(wb_auth=)[A-Za-z0-9._~+\/-]+=*/\1<REDACTED>/Ig' \
    -e 's/eyJ[A-Za-z0-9._~+\/-]+=*/<JWT_REDACTED>/g'
}

run() {
  local title="$1"
  shift
  {
    echo
    echo "===== ${title} ====="
    echo "+ $*"
    "$@" 2>&1 | redact
    local status=${PIPESTATUS[0]}
    echo "exit=${status}"
  } | tee -a "$OUT" >/dev/null
}

curl_probe() {
  local title="$1"
  local method="$2"
  local url="$3"
  local body="${4:-}"
  local headers_file body_file code
  headers_file="$(mktemp)"
  body_file="$(mktemp)"
  if [[ -n "$body" ]]; then
    code=$(curl -sS -D "$headers_file" -o "$body_file" -w "%{http_code}" --max-time 15 \
      -X "$method" -H 'Content-Type: application/json' --data "$body" "$url" 2>&1)
  else
    code=$(curl -sS -D "$headers_file" -o "$body_file" -w "%{http_code}" --max-time 15 \
      -X "$method" "$url" 2>&1)
  fi
  {
    echo
    echo "===== ${title} ====="
    echo "+ curl -i -X ${method} ${url}"
    echo "HTTP_CODE=${code}"
    echo "--- response headers ---"
    cat "$headers_file" | redact
    echo "--- response body (first 1200 bytes) ---"
    head -c 1200 "$body_file" | redact
    echo
  } | tee -a "$OUT" >/dev/null
  rm -f "$headers_file" "$body_file"
}

: > "$OUT"
{
  echo "WABOT login 404 diagnostics"
  echo "timestamp_utc=${STAMP}"
  echo "root=${ROOT_DIR}"
  echo "base_url=${BASE_URL}"
  echo "api_url=${API_URL}"
  echo
  echo "ANÁLISE DE RISCO"
  echo "- Somente leitura e curls com credenciais inválidas; não altera banco, schema, PM2, git ou produção."
  echo "- Se executado no staging padrão, valida visual 3006 e API 3004 isoladas."
} | tee -a "$OUT" >/dev/null

run "git revision" git -C "$ROOT_DIR" status --short --branch
run "git HEAD" git -C "$ROOT_DIR" log --oneline -n 5
run "node/npm versions" bash -lc 'node -v && npm -v'

if command -v pm2 >/dev/null 2>&1; then
  run "pm2 status" pm2 status
  run "pm2 whitelisted runtime env" node -e '
const { execFileSync } = require("node:child_process")
const apps = JSON.parse(execFileSync("pm2", ["jlist"], { encoding: "utf8" }))
for (const app of apps) {
  const env = app.pm2_env || {}
  const keep = {}
  for (const key of ["name", "pm_id", "status", "pid", "pm_cwd", "script", "args", "NODE_ENV", "APP_ENV", "PORT", "API_PORT", "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_FORCE_SAME_ORIGIN_API"]) {
    keep[key] = key in env ? env[key] : app[key]
  }
  console.log(JSON.stringify(keep, null, 2))
}'
  run "pm2 logs visual-staging tail" pm2 logs visual-staging --lines 80 --nostream
  run "pm2 logs api-staging tail" pm2 logs api-staging --lines 80 --nostream
else
  run "pm2 missing" bash -lc 'echo "pm2 não encontrado no PATH"'
fi

run "dashboard route source checksum" bash -lc "cd '$ROOT_DIR' && git ls-files -s dashboard/app/api/'[...path]'/route.js && sha256sum dashboard/app/api/'[...path]'/route.js"
run "dashboard build proxy manifest" bash -lc "cd '$DASHBOARD_DIR' && test -f .next/server/app-paths-manifest.json && node -e 'const m=require(\"./.next/server/app-paths-manifest.json\"); console.log(m[\"/api/[...path]/route\"] || \"MISSING\")' && test -f .next/server/app/api/'[...path]'/route.js && sha256sum .next/server/app/api/'[...path]'/route.js"

curl_probe "visual login page" GET "${BASE_URL%/}/login"
curl_probe "visual API login through dashboard proxy" POST "${BASE_URL%/}/api/auth/login" '{"email":"diagnostic@example.invalid","password":"invalid-diagnostic-password"}'
curl_probe "local visual API login through dashboard proxy" POST "http://127.0.0.1:3006/api/auth/login" '{"email":"diagnostic@example.invalid","password":"invalid-diagnostic-password"}'
curl_probe "direct API health" GET "${API_URL%/}/health"
curl_probe "direct API ready" GET "${API_URL%/}/ready"
curl_probe "direct API login" POST "${API_URL%/}/api/auth/login" '{"email":"diagnostic@example.invalid","password":"invalid-diagnostic-password"}'

{
  echo
  echo "===== interpretação rápida ====="
  echo "- Se visual API login tiver x-nextjs-prerender ou text/html: o build/processo visual não está servindo a rota app/api/[...path]."
  echo "- Se visual API login tiver x-wabot-api-proxy e 502: o proxy existe, mas a API 3004 está fora/indisponível."
  echo "- Se direct API login responder JSON 401/400/429: a API está viva; o problema está no visual/proxy/base URL."
  echo "- Se direct API health/ready falhar: investigar api-staging, env JWT_SECRET e migrations."
  echo
  echo "Arquivo gerado: ${OUT}"
} | tee -a "$OUT" >/dev/null

echo "$OUT"
