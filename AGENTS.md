# Wabot — instruções para agentes de IA (Codex / Claude)

Este arquivo é a fonte única de regras para qualquer agente de IA editando
este repo. Codex lê `AGENTS.md` automaticamente; `CLAUDE.md` faz `@AGENTS.md`
para reaproveitar o mesmo conteúdo.

## Fluxo de desenvolvimento (canônico — não pule etapas)

1. Toda feature/fix nasce em uma branch a partir de `develop`.
2. PR é aberta **contra `develop`** (nunca direto para `main`).
3. Ao mergear em `develop`, o GitHub Actions (`.github/workflows/deploy.yml`)
   faz deploy automático para **staging** (`~/wabot-staging` no VPS, branch
   `develop`, PM2 apps `api-staging` + `visual-staging`).
4. Validação manual em `http://178.105.54.0:3006`.
5. Só depois de validado em staging, abrir PR de `develop` → `main`. O merge
   em `main` dispara o mesmo workflow para **produção** (`~/wabot` no VPS,
   branch `main`, PM2 apps `api` + `dashboard`).

Nunca pular staging. Nunca subir direto em `main`. Nunca fazer amend em
commits já mergeados — sempre criar commit novo.

## Ambientes e portas (canônico — não inventar valores)

| Ambiente | Branch  | Diretório no VPS   | PM2 apps                        | Dashboard PORT | API_PORT | URL pública                   |
|----------|---------|--------------------|---------------------------------|----------------|----------|-------------------------------|
| Staging  | develop | `~/wabot-staging`  | `visual-staging`, `api-staging` | `3006`         | `3004`   | `http://178.105.54.0:3006`    |
| Produção | main    | `~/wabot`          | `dashboard`, `api`              | `3000`         | `3001`   | `http://espelhagrupos.com.br` |

O proxy do Next (`dashboard/app/api/[...path]/route.js`) já mapeia
`3006 → 3004` e `3000 → 3001` automaticamente via header `host`.

**Trocar portas exige mudança em 3 lugares ao mesmo tempo:**
1. `apiPortByDashboardPort` em `dashboard/app/api/[...path]/route.js`
2. defaults em `scripts/deploy_safe_staging.sh` (`VISUAL_BASE_URL` / `API_BASE_URL`)
3. esta tabela acima

## `.env` mínimo em cada ambiente

Os arquivos `.env` ficam **fora do repo** (`.gitignore`). Conteúdo mínimo
viável (sem isso a API mata o processo no boot e o smoke test do deploy
falha):

### `~/wabot-staging/.env`
```
NODE_ENV=production
APP_ENV=staging
API_PORT=3004
DATABASE_URL=file:./prisma/staging.db
JWT_SECRET=<segredo exclusivo de staging — NÃO reaproveitar de prod>
AUTH_INFO_DIR=/home/deploy/wabot-staging-shared/auth_info
BOT_LOG_DIR=/home/deploy/wabot-staging-shared/logs
AUTO_START_WHATSAPP_SESSIONS=true
DASHBOARD_URL=http://178.105.54.0:3006
API_URL=http://178.105.54.0:3006
```

### `~/wabot-staging/dashboard/.env.local`
```
PORT=3006
NEXT_PUBLIC_FORCE_SAME_ORIGIN_API=true
```

### `~/wabot/.env` (produção — referência)
```
NODE_ENV=production
APP_ENV=production
API_PORT=3001
DATABASE_URL=file:./prisma/prod.db
JWT_SECRET=<segredo exclusivo de produção>
AUTH_INFO_DIR=/home/deploy/BOTinho-shared/auth_info
BOT_LOG_DIR=/home/deploy/BOTinho-shared/logs
AUTO_START_WHATSAPP_SESSIONS=true
DASHBOARD_URL=http://espelhagrupos.com.br
API_URL=http://espelhagrupos.com.br
```

### `~/wabot/dashboard/.env.local`
```
PORT=3000
NEXT_PUBLIC_FORCE_SAME_ORIGIN_API=true
```

Sem `JWT_SECRET` a API mata o processo no boot
(`src/api/server.js:201-204`), o que faz o smoke test
`assert_login_api_not_next_404` falhar e o deploy automático ficar vermelho.

## Isolamento de bancos (não substituir prod por staging)

Quatro camadas de isolamento em produção:

1. `DATABASE_URL` diferente: `file:./prisma/staging.db` vs `file:./prisma/prod.db`.
2. Diretórios físicos diferentes no VPS: `~/wabot-staging/prisma/` vs `~/wabot/prisma/`.
3. `AUTH_INFO_DIR` absoluto e diferente entre ambientes.
4. `.gitignore` cobre `*.db`, `*.db-journal`, `auth_info/`, `.env`.

O workflow de deploy nunca copia banco entre ambientes — só faz
`git pull` (sem tocar em gitignored) + `npx prisma migrate deploy` (aplica
migrations, não substitui dados).

**Backup:** `scripts/backup_prod.sh` rodando diariamente via cron grava em
`/home/deploy/wabot-backups/` (snapshot consistente com `sqlite3 .backup`
+ tar.gz do `auth_info`, rotação de 30 dias, upload opcional via `rclone`).
Detalhes em `docs/deploy/backup-prod.md`.

## GitHub Secrets exigidos pelo workflow

Settings → Secrets and variables → Actions:

- `REMOTE_HOST` — IP/host do VPS
- `REMOTE_USER` — usuário SSH (geralmente `deploy`)
- `SSH_PRIVATE_KEY` — chave privada com acesso ao VPS
- `REPO_PULL_TOKEN` (opcional, recomendado em staging) — PAT fine-grained
  com `Contents: Read-only` apenas em `flavia-vale/wabot`. **Cole sem
  espaços/quebras de linha** (o workflow sanitiza com `tr -d '[:space:]'`
  defensivamente, mas o hábito correto é colar limpo).

## Ordem do deploy automático em staging

`scripts/deploy_safe_staging.sh` executa, nesta ordem (qualquer falha aborta):

1. Preflight (git status do clone)
2. `git fetch` + `git checkout develop` + `git pull --ff-only`
   (com `AUTO_STASH_ON_DIRTY=1` para sair de dirty tree)
3. `npm ci` na raiz
4. `npx prisma migrate deploy` (precisa `DATABASE_URL` no `.env`)
5. `npm ci` no `dashboard/`
6. `npm run guard:config-page` + `rm -rf .next` + `npm run build`
7. Verificação dos artefatos `.next/BUILD_ID` etc.
8. `pm2 restart api-staging --update-env` e `pm2 restart visual-staging --update-env`
9. Smoke tests:
   - `GET http://178.105.54.0:3006/login`
   - `GET http://127.0.0.1:3004/health`
   - `POST http://178.105.54.0:3006/api/auth/login` — exige resposta JSON (não 404 do Next)

Falha do smoke 9 geralmente é `.env` faltando, `JWT_SECRET` ausente
ou porta divergente do que está em `apiPortByDashboardPort`.

## Pegadinhas conhecidas (lições aprendidas — leia antes de mexer)

### 1. PM2 cacheia env vars no momento do `pm2 start`

Mudar `.env` + `pm2 restart --update-env` **não substitui** variáveis que
o PM2 já cacheou no processo. `dotenv` por padrão não sobrescreve
`process.env` existente. Para forçar uma variável a vir do `.env`:

```bash
pm2 delete api-staging
cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only api-staging
pm2 save
```

(ou o comando original usado pra subir o serviço — `pm2 start src/api/server.js --name api-staging` etc., sem inline env vars).

### 2. Prisma SQLite resolve `file:` relativo ao schema, não ao CWD

`DATABASE_URL=file:./prisma/staging.db` com schema em
`prisma/schema.prisma` resolve para `prisma/prisma/staging.db` (pasta
duplicada). Para evitar:

- ✅ `file:./staging.db` quando o schema está em `prisma/` → resolve para
  `prisma/staging.db`.
- ❌ `file:./prisma/staging.db` → resolve para `prisma/prisma/staging.db`.

Se já existe banco no caminho "errado", **não troque DATABASE_URL sem
migrar os dados primeiro** — o app passa a usar um banco vazio novo.

### 3. `prisma migrate deploy` cria banco vazio se DATABASE_URL aponta para arquivo novo

Migrar não tem proteção contra "banco vazio recém-criado". Antes de mudar
`DATABASE_URL`:

```bash
sqlite3 <banco-atual> "SELECT COUNT(*) FROM User;"   # confere se tem dados
ls -la prisma/                                       # confere onde os .db estão
```

### 4. Secrets do GitHub não removem whitespace automaticamente

Tokens colados com `\n` ou ` ` no início viram URLs malformadas. Sempre
selecionar o token com clique-duplo e colar limpo. Para tokens críticos,
sanitizar no workflow: `TOKEN_CLEAN="$(printf '%s' "${{ secrets.X }}" | tr -d '[:space:]')"`.

### 5. `prisma/dev.db-journal` ficou trackeado por engano no passado

Foi removido do tracking em #328. `.gitignore` cobre `*.db-journal`, mas
arquivos commitados antes da regra continuam trackeados até `git rm --cached`.
Confira periodicamente: `git ls-files | grep -E '\.db$|\.db-journal$'` deve
retornar vazio.

## Regras para qualquer agente de IA neste repo

- **Não trocar portas** sem atualizar os 3 lugares listados acima.
- **Não criar PR para `main` direto** — sempre `feature → develop → main`.
- **Não amend** commits já mergeados; criar commit novo.
- **Não rodar destrutivos** (`reset --hard`, `push --force`, `branch -D`,
  `rm -rf` em paths reais) sem permissão explícita.
- **Não mexer em `.env` ou banco** em produção sem confirmar com a usuária.
- Antes de "consertar" o deploy, conferir se a falha está no workflow
  (Actions) ou no smoke test pós-PM2 (`.env`/porta no VPS) — são causas
  diferentes com correções diferentes.
- Mudanças em banco/migrations sempre passam por staging antes de prod.
- Antes de mudar `DATABASE_URL`, conferir contagem de registros no banco
  atual (`sqlite3 <db> "SELECT COUNT(*) FROM User"`).
- Backups de prod são responsabilidade do `scripts/backup_prod.sh`
  (cron diário). Não tocar nele sem testar restauração.
