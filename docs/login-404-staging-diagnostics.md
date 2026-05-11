# Diagnóstico assertivo — `POST /api/auth/login` retorna 404 no staging

## Leitura do erro `scripts/collect-login-404-diagnostics.sh: No such file or directory`

Se `cd ~/wabot-staging && bash scripts/collect-login-404-diagnostics.sh ...` retorna `No such file or directory`, o staging em `~/wabot-staging` não contém o commit/branch que adicionou esse script. Antes de mexer em código ou reiniciar produção, confirme a revisão que está realmente rodando no staging.

## Análise de risco

- **Erros fatais:** os comandos abaixo são somente leitura, exceto escrever o log em `/tmp`; não reiniciam PM2 e não alteram banco.
- **Breaking changes:** nenhum contrato de API, schema ou prop é alterado.
- **Efeito cascata:** nenhuma dependência global é modificada.
- **Isolamento:** executar em `~/wabot-staging`; não usar `~/wabot-prod` para este diagnóstico.
- **Bloqueio:** se os comandos mostrarem que o staging está em branch/commit antigo, atualizar apenas staging/develop antes de qualquer ação em produção.

## Comando imediato quando o script ainda não existe no staging

Execute em `~/wabot-staging` para gerar um log sem depender do script novo:

```bash
cd ~/wabot-staging && {
  echo "===== timestamp ====="
  date -u

  echo "===== git ====="
  pwd
  git status --short --branch
  git rev-parse HEAD
  git log --oneline -n 8
  find scripts -maxdepth 1 -type f | sort

  echo "===== pm2 status ====="
  pm2 status

  echo "===== pm2 env filtrado ====="
  node - <<'NODE'
const { execFileSync } = require('node:child_process')
const apps = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8' }))
for (const app of apps) {
  const env = app.pm2_env || {}
  const out = {}
  for (const key of ['name', 'pm_id', 'status', 'pid', 'pm_cwd', 'script', 'args', 'NODE_ENV', 'APP_ENV', 'PORT', 'API_PORT', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_FORCE_SAME_ORIGIN_API']) {
    out[key] = key in env ? env[key] : app[key]
  }
  console.log(JSON.stringify(out, null, 2))
}
NODE

  echo "===== manifest proxy dashboard ====="
  cd ~/wabot-staging/dashboard
  test -f .next/server/app-paths-manifest.json && node -e 'const m=require("./.next/server/app-paths-manifest.json"); console.log(m["/api/[...path]/route"] || "MISSING")' || echo "MISSING_MANIFEST"
  test -f .next/server/app/api/'[...path]'/route.js && sha256sum .next/server/app/api/'[...path]'/route.js || echo "MISSING_ROUTE_ARTIFACT"

  echo "===== curl visual /login ====="
  curl -sS -D - -o /tmp/wabot-login-page.html -w '\nHTTP_CODE=%{http_code}\n' --max-time 15 http://178.105.54.0:3006/login

  echo "===== curl visual /api/auth/login ====="
  curl -sS -D - -o /tmp/wabot-login-api-body.txt -w '\nHTTP_CODE=%{http_code}\n' --max-time 15 \
    -X POST -H 'Content-Type: application/json' \
    --data '{"email":"diagnostic@example.invalid","password":"invalid-diagnostic-password"}' \
    http://178.105.54.0:3006/api/auth/login
  echo "--- body first 1200 bytes ---"
  head -c 1200 /tmp/wabot-login-api-body.txt
  echo

  echo "===== curl direto API 3004 ====="
  curl -sS -D - -o /tmp/wabot-api-direct-body.txt -w '\nHTTP_CODE=%{http_code}\n' --max-time 15 \
    -X POST -H 'Content-Type: application/json' \
    --data '{"email":"diagnostic@example.invalid","password":"invalid-diagnostic-password"}' \
    http://127.0.0.1:3004/api/auth/login
  echo "--- body first 1200 bytes ---"
  head -c 1200 /tmp/wabot-api-direct-body.txt
  echo

  echo "===== pm2 logs visual-staging ====="
  pm2 logs visual-staging --lines 80 --nostream

  echo "===== pm2 logs api-staging ====="
  pm2 logs api-staging --lines 80 --nostream
} 2>&1 | sed -E \
  -e 's/(Authorization: Bearer )[A-Za-z0-9._~+\/-]+=*/\1<REDACTED>/Ig' \
  -e 's/(Cookie: )[^\r]*/\1<REDACTED>/Ig' \
  -e 's/(Set-Cookie: )[^\r]*/\1<REDACTED>/Ig' \
  -e 's/(wb_auth=)[A-Za-z0-9._~+\/-]+=*/\1<REDACTED>/Ig' \
  -e 's/eyJ[A-Za-z0-9._~+\/-]+=*/<JWT_REDACTED>/g' \
  | tee /tmp/wabot-login-404-manual.log
```

Envie o arquivo `/tmp/wabot-login-404-manual.log`.

## Como interpretar rapidamente

- `find scripts ...` sem `collect-login-404-diagnostics.sh`: staging está atrás do commit que adicionou o diagnóstico.
- `manifest proxy dashboard` com `MISSING` ou `MISSING_ROUTE_ARTIFACT`: o build visual atual não contém a rota proxy; `/api/auth/login` pode cair no 404/prerender do Next.js.
- `curl visual /api/auth/login` com `x-nextjs-prerender` ou `content-type: text/html`: requisição foi servida pelo Next.js visual, não pela API.
- `curl visual /api/auth/login` com `x-wabot-api-proxy` e `502`: proxy existe, mas a API `3004` não está acessível pelo visual.
- `curl direto API 3004` com JSON `401`, `400` ou `429`: API está viva; foco no visual/proxy/base URL.
- `curl direto API 3004` com `000`, conexão recusada ou timeout: foco em `api-staging`, `JWT_SECRET`, migrations ou porta `3004`.
