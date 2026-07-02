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

## Processos PM2 (canônico)

| App                      | Ambiente | Responsabilidade                                              |
|--------------------------|----------|---------------------------------------------------------------|
| `api`                    | prod     | Fastify HTTP + JWT + rotas                                    |
| `dashboard`              | prod     | Next.js                                                       |
| `bot-supervisor`         | prod     | Ciclo de vida das sessões WhatsApp (fork dos bot-workers)     |
| `snapshot-cron`          | prod     | Cron diário de snapshots de canais                            |
| `api-staging`            | staging  | Espelho da API                                                |
| `visual-staging`         | staging  | Espelho do dashboard                                          |
| `bot-supervisor-staging` | staging  | Espelho do supervisor                                         |

**Por que `bot-supervisor` existe**: historicamente a API fazia `fork()`
dos workers WhatsApp. Toda vez que a API reiniciava (deploy, OOM, bug)
**todas as sessões caíam juntas**, com risco de ban em massa e perda de
mensagens em vôo. O supervisor é um processo PM2 separado que assume o
`fork()` dos workers e fala com a API só via Redis (BullMQ para comandos,
pub/sub para eventos QR/status). Reiniciar a API deixa de tocar nas
sessões.


### Pré-flight obrigatório antes de qualquer cutover em produção (NÃO pular)

Antes de executar qualquer passo de `inline -> remote` em **prod**, rodar e validar:

```bash
grep "name:" ~/wabot/ecosystem.config.cjs
ls ~/wabot/src/supervisor/
```

Critérios de aprovação:
- `grep` precisa listar os **4 apps de prod**: `api`, `dashboard`, `bot-supervisor`, `snapshot-cron` e (quando houver) os equivalentes de staging no repo correto.
- `ls` precisa mostrar `protocol.js`, `client.js`, `index.js` (e demais arquivos do supervisor).

Se qualquer item falhar: **BLOQUEAR CUTOVER**. Primeiro promover `develop -> main`, aguardar autodeploy, revalidar pre-flight e só então prosseguir com o runbook de produção.

### Seleção de modo via `BOT_SUPERVISOR_MODE`

A API decide quem gerencia os bots via env var `BOT_SUPERVISOR_MODE`:

- **`inline`** (default histórico): a API faz `fork()` dos workers ela mesma.
  Deploy da API derruba todas as sessões.
- **`remote`**: a API só envia comandos via BullMQ no Redis; o app
  `bot-supervisor` faz `fork()` dos workers. Deploy da API **não** toca
  nas sessões.

**O supervisor agora respeita a MESMA flag (auto-standby).** Desde o fix do
incidente "WhatsApp caindo toda hora", `src/supervisor/index.js` lê
`BOT_SUPERVISOR_MODE` no boot (via `supervisorManagesSessions` em
`src/supervisor/envGuard.js`) e **só assume as sessões quando o modo é
`remote`**. Em `inline` (ou qualquer outro valor) o supervisor entra em
**standby**: continua vivo (PM2 não fica em churn de restart), mas **não** faz
`fork()`/resume/health-monitor nem consome comandos. Antes, o supervisor subia
e gerenciava sessões **independente do modo** — então com staging em `inline`
(canônico) e `bot-supervisor-staging` de pé, **tanto a `api-staging` quanto o
supervisor davam `fork()` do MESMO worker sobre o MESMO `AUTH_INFO_DIR`**: dois
sockets Baileys com a mesma credencial, o WhatsApp só aceita um device por
registro → conflito/stream-error → reconexão em loop ("caindo toda hora", risco
de ban). Como `api-staging` e `bot-supervisor-staging` carregam o **mesmo
`.env`**, a flag agora governa as duas pontas de forma consistente e a dupla
posse de sessão é impossível por construção. Procure por `STANDBY` no log do
supervisor para confirmar que ele NÃO está disputando sessões com a API inline.
Teste: `test/supervisor-env-guard.test.js`.

**Estado canônico do staging = `inline`.** O staging existe para validar
features no dia a dia, e `inline` é o modo mais simples e estável (a própria
`api-staging` faz `fork()` dos workers, sem depender do `bot-supervisor-staging`
estar de pé e no diretório certo — vide pegadinha #9). O modo `remote` em
staging só deve ser ligado **durante a janela de teste de um cutover** (espelhar
prod) e revertido para `inline` ao terminar. Se o staging ficou "preso" em
`remote` (QR não aparece, status "Falha ao carregar status", comandos estourando
`isRunning timed out`), quase sempre é porque o `.env` ficou com
`BOT_SUPERVISOR_MODE=remote` de uma janela antiga — reverta para `inline`
(rollback abaixo). Lembre que **deploy não mexe nisso**: o `.env` é gitignored e
o workflow só faz `git pull` + `prisma migrate`, então o modo só muda quando
alguém edita o `.env` no VPS.

Cutover seguro (validar staging primeiro):

1. Subir Redis local no VPS (`redis-server`, bind 127.0.0.1, AOF on).
2. Garantir `REDIS_URL=redis://127.0.0.1:6379/1` no `.env` de staging.
3. `pm2 start ecosystem.config.cjs --only bot-supervisor-staging`
4. Setar `BOT_SUPERVISOR_MODE=remote` no `.env` da `api-staging` (NÃO no
   ecosystem) e fazer `pm2 delete api-staging && pm2 start
   ecosystem.config.cjs --only api-staging`. `pm2 restart --update-env`
   NÃO basta (vide pegadinha #1: dotenv não sobrescreve env já cacheada
   pelo PM2 — precisa delete + start). Confirmar pelo dashboard staging
   que QR, status e envio funcionam end-to-end.
5. Teste de aceitação: `pm2 restart api-staging` enquanto há sessão
   conectada — sessão **deve continuar conectada** (esse é o ponto).
6. Repetir para produção (`bot-supervisor` + ajustar `.env` + delete/start `api`).

Rollback: setar `BOT_SUPERVISOR_MODE=inline` no `.env` + **delete + start**
da API (`pm2 delete api-staging && pm2 start ecosystem.config.cjs --only
api-staging && pm2 save`; idem `api` em prod). `pm2 restart --update-env` NÃO
basta (pegadinha #1: PM2 cacheia a env). Confirme no log que **não** aparece
`Manager em modo REMOTE`. Janela ≤ 2min.

**Pré-requisito do modo `remote`:** Redis local em `REDIS_URL`
(`redis://127.0.0.1:6379/0` prod, `/1` staging). No modo `inline` o
Redis é opcional.

### Guard anti-reversão de modo (RCA 2026-07 — Trilho C, não regredir)

`src/ops/modeRegressionGuard.js` (`shouldWarnModeRegression`) é um módulo puro
consumido no boot de `src/api/server.js`: se `APP_ENV=production` **e**
`BOT_SUPERVISOR_MODE != 'remote'` **e** já existe `WaSession.status='connected'`
no banco, a API loga `error` e emite `AnalyticsEvent('ops_mode_regression')`
(allowlist em `src/analytics.js`). Não bloqueia o boot (é aviso, não guard
fail-fast) — o objetivo é pegar o `.env` derivando de volta para `inline` em
produção **antes** do próximo deploy derrubar as sessões, em vez de descobrir
pelo spam de "A sincronização foi concluída" no celular da cliente. Roda só
quando o banco está disponível no boot (`databaseReadyAtBoot`). Teste puro
(sem DB) em `test/ops-mode-regression-guard.test.js`.

### Arquivos do supervisor (não confundir)

- `src/supervisor/protocol.js` — contrato (nomes de filas, eventos,
  timeouts). [PROTECTED_CORE]. Mudança breaking exige bumping de
  `PROTOCOL_VERSION`. **Ordem de deploy (P2-2):** o pub/sub é versionado e
  `decodeEvent` descarta evento de versão diferente — o `client.js` loga isso
  (WARN throttled) em vez de sumir em silêncio. Ainda assim, ao bumpar
  `PROTOCOL_VERSION`, faça deploy de **supervisor e API juntos**; não deixe as
  duas pontas em versões divergentes em regime permanente (QR/status seriam
  descartados e comandos novos viram `Comando desconhecido`).
- `src/supervisor/client.js` — usado pela API quando em modo `remote`.
  Mantém a mesma superfície de `src/core/sessionCore.js` para que rotas
  não mudem ao alternar de modo.
- `src/supervisor/index.js` — entrypoint do app PM2 `bot-supervisor`.
- `src/manager.js` — fachada que escolhe inline vs remote por env var;
  consumido por todas as rotas. **Não importar `sessionCore` direto** —
  sempre via `manager.js`.

## Ambientes e portas (canônico — não inventar valores)

| Ambiente | Branch  | Diretório no VPS   | PM2 apps                        | Dashboard PORT | API_PORT | URL pública                   |
|----------|---------|--------------------|---------------------------------|----------------|----------|-------------------------------|
| Staging  | develop | `~/wabot-staging`  | `visual-staging`, `api-staging`, `bot-supervisor-staging` | `3006`         | `3004`   | `http://178.105.54.0:3006`    |
| Produção | main    | `~/wabot`          | `dashboard`, `api`, `bot-supervisor` | `3000`         | `3001`   | `http://espelhagrupos.com.br` |

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
CREDENTIAL_ENCRYPTION_KEY=<64 chars hex exclusivo de staging — ver seção D-3>
AUTH_INFO_DIR=/home/deploy/wabot-staging-shared/auth_info
BOT_LOG_DIR=/home/deploy/wabot-staging-shared/logs
AUTO_START_WHATSAPP_SESSIONS=true
DASHBOARD_URL=http://178.105.54.0:3006
API_URL=http://178.105.54.0:3006
# BOT_SUPERVISOR_MODE: 'inline' (default) ou 'remote'. Em 'remote', a API
# delega ciclo de vida dos bots ao app PM2 bot-supervisor-staging via Redis.
BOT_SUPERVISOR_MODE=inline
REDIS_URL=redis://127.0.0.1:6379/1
# Converte links de cupom/voucher (Shopee, Amazon, ML) com comissão nossa em vez
# de removê-los. Resolve o shortLink afiliado para a landing web segura
# (/m/cupom-de-desconto) evitando "Oops! Seu navegador não é mais aceito!".
COUPON_LINK_CONVERT=true
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
CREDENTIAL_ENCRYPTION_KEY=<64 chars hex exclusivo de produção — ver seção D-3>
AUTH_INFO_DIR=/home/deploy/BOTinho-shared/auth_info
BOT_LOG_DIR=/home/deploy/BOTinho-shared/logs
AUTO_START_WHATSAPP_SESSIONS=true
DASHBOARD_URL=http://espelhagrupos.com.br
API_URL=http://espelhagrupos.com.br
# Ver seção "Processos PM2" para detalhes sobre cutover inline -> remote.
BOT_SUPERVISOR_MODE=inline
REDIS_URL=redis://127.0.0.1:6379/0
# Converte links de cupom/voucher (Shopee, Amazon, ML) com comissão nossa em vez
# de removê-los. Resolve o shortLink afiliado para a landing web segura
# (/m/cupom-de-desconto) evitando "Oops! Seu navegador não é mais aceito!".
COUPON_LINK_CONVERT=true
```

### `~/wabot/dashboard/.env.local`
```
PORT=3000
NEXT_PUBLIC_FORCE_SAME_ORIGIN_API=true
```

Sem `JWT_SECRET` a API mata o processo no boot
(`src/api/server.js:201-204`), o que faz o smoke test
`assert_login_api_not_next_404` falhar e o deploy automático ficar vermelho.

Sem `CREDENTIAL_ENCRYPTION_KEY` (ou com formato inválido) a API **também** mata
o processo no boot — vide seção "D-3" abaixo. Gere uma por ambiente com:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Liga/desliga staging pelo painel admin (economia de RAM)

Como staging e prod dividem o mesmo VPS, o painel admin de prod tem um botão
para **parar/subir os apps PM2 de staging** quando não há validação em curso,
liberando RAM (parar `visual-staging` + `api-staging` libera ~1-1.4 GB). Backend
em `src/ops/stagingPower.js`; rotas `GET/POST /api/admin/staging-power`
(`tech:read`/`tech:write`, auditado em `AdminAuditLog`); botão em
`dashboard/app/admin/page.js` (`StagingPowerCard`).

- Usa `execFile` (sem shell, sem interpolação); a ação é allowlist `on`/`off`.
- O **`on` sobe do `cwd` de staging** (`STAGING_DIR`, default `~/wabot-staging`)
  para o pm2 resolver o `ecosystem.config.cjs` e o `.env` CERTOS — respeita a
  pegadinha #9 (supervisor/api no diretório errado lê o `.env` errado).
- Só roda no host de **produção** (`APP_ENV != staging`).
- Envs opcionais: `STAGING_PM2_APPS` (default `api-staging visual-staging`),
  `STAGING_DIR`, `PM2_BIN`. Teste: `test/ops-staging-power.test.js`.

## D-3 — Criptografia de credenciais em repouso (canônico)

As credenciais de afiliado (cookie de sessão ML/Amazon, tokens OAuth, secret da
Shopee) ficam no campo `Credential.data` (SQLite). Antes ficavam em **texto
puro**; hoje são cifradas com **AES-256-GCM** na camada de aplicação
(`src/credentialCrypto.js`).

**Formato armazenado** (texto puro, compatível com campo `String` do Prisma, sem
migration de schema): `v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`. O prefixo
`v1` permite rotação futura de chave/algoritmo.

**Chave:** env `CREDENTIAL_ENCRYPTION_KEY` = 64 chars hex (32 bytes). **Diferente
por ambiente** (NÃO reaproveitar staging em prod). `validateEncryptionKey()` no
boot (`src/api/server.js`) mata o processo se ausente/malformada.

**Migração graciosa (não regredir):**
- `decryptCredential` devolve a string original quando ela **não** tem prefixo
  `v1:` — leituras de dados legados em texto puro continuam funcionando antes/
  durante a migração.
- Sem a env configurada (dev/test), encrypt/decrypt viram **no-ops** — mantém os
  testes db-free. A exigência de chave é só no boot da API.
- `encryptCredential` é **idempotente**: não recifra valor já cifrado.

**Pontos acoplados (todos precisam decifrar/cifrar):**
- Leitura: `parseCredentialData` em `src/credentialHealth.js` (cobre painel,
  `offerEngine`, `offerAutomation` automaticamente).
- Leitura direta (único bypass): `src/bot-worker.js` (~linha 353) — decifra antes
  do `JSON.parse`. Por isso o worker tem `import 'dotenv/config'` no topo (precisa
  da env).
- Escrita: `src/api/routes/credentials.js` (PUT) e `src/api/routes/mlOAuth.js`
  (merge OAuth).
- **Chave PIX de afiliado (`AffiliateProfile.pixKey`)** também é cifrada com o
  MESMO esquema (pode ser CPF/telefone/e-mail). Escrita: `applyAffiliate` em
  `src/domain/affiliate/service.js` e `PUT /affiliate/me` em
  `src/api/routes/affiliate.js` chamam `encryptCredential`. Leitura: as rotas
  admin e `getAffiliateMeData` decifram via `presentAffiliateProfile` /
  `decryptCredential`; o antifraude (`pixMatchesReferredUser`) decifra antes de
  comparar. Migração das linhas existentes:
  `scripts/migrate-affiliate-pixkey-encrypt.mjs` (idempotente, mesmas precauções
  de parar API + backup).

**Migração das linhas existentes:** `scripts/migrate-credentials-encrypt.mjs`
(idempotente). **Parar a API antes** (`pm2 stop api`) para evitar SQLITE_BUSY
(pegadinha #8), rodar, religar. Em prod, rodar `scripts/backup_prod.sh` antes.

```bash
# staging
pm2 stop api-staging && cd ~/wabot-staging && node scripts/migrate-credentials-encrypt.mjs && pm2 start ecosystem.config.cjs --only api-staging
# prod (backup antes!)
scripts/backup_prod.sh && pm2 stop api && cd ~/wabot && node scripts/migrate-credentials-encrypt.mjs && pm2 start ecosystem.config.cjs --only api && pm2 save
```

**Rollback:** como `decryptCredential` tolera texto puro, reverter o código
mantém leituras funcionando em ambos os formatos. Testes:
`test/credential-crypto.test.js`.

## A-1 — Proteção contra brute-force no login (canônico)

`src/api/routes/auth.js` rastreia tentativas de login em **dois** mapas
in-memory (funciona sem Redis):
- `loginAttempts` por `(email|ip)` — limite `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`
  (default 8) na janela `LOGIN_RATE_LIMIT_WINDOW_MS` (default 15min). Pega força
  bruta de um IP.
- `loginAttemptsByEmail` só por email — limite
  `LOGIN_RATE_LIMIT_EMAIL_MAX_ATTEMPTS` (default 20). Pega ataque
  **distribuído** (mesma conta de vários IPs), que o limite por IP e o rate
  limit global do servidor não cobririam.

A tentativa é contada **antes** do lookup do usuário (evita enumeration via
timing de rate limit). Bloqueio retorna 429 + `Retry-After`. Tentativas falhadas
e bloqueios geram eventos `login_failed`/`login_blocked` em `AnalyticsEvent`
(com hash curto do email — `acct` — sem PII em claro). Cleanup periódico via
`startLoginAttemptsCleanup()` (top-level, `unref()`). Testes:
`test/auth-rate-limit.test.js`.

## Configurações do Mercado Pago (envs obrigatórias)

Estas variáveis devem estar no `.env` de produção antes de ativar o fluxo de
pagamento via Mercado Pago. Sem elas o endpoint de checkout ou o webhook
falha silenciosamente.

| Env                          | Obrigatória? | O que faz                                                                                   |
|------------------------------|--------------|---------------------------------------------------------------------------------------------|
| `MP_ACCESS_TOKEN`            | Sim          | Token de produção do MP (`APP_USR-...`). Obtido em Credenciais → Produção no painel MP.    |
| `MP_WEBHOOK_SECRET`          | Sim (prod)   | Chave HMAC gerada pelo painel MP (Webhooks → Assinatura). Sem ela, `/api/payments/webhook` retorna 500 em produção. |
| `BILLING_WEBHOOK_AUTOPROCESS`| Recomendada  | `true` ativa processamento imediato do webhook. Default `false` atrasa ativação em até 1h (reconciliação periódica). |

**URL de webhook a registrar no painel MP:**
`https://espelhagrupos.com.br/api/payments/webhook`

Evento a marcar: `payment`.

**Aplicar as envs (pegadinha #1 — PM2 cacheia env vars):**

Mudar `.env` + `pm2 restart --update-env` **não substitui** variáveis já
cacheadas. Para qualquer mudança nas envs do MP fazer:

```bash
pm2 delete api
cd ~/wabot && pm2 start ecosystem.config.cjs --only api
pm2 save
```

**Token de sandbox vs produção:** o MP fornece tokens separados. Usar token
de produção em staging dispara cobranças reais. Para testes, usar token de
sandbox no `.env` de staging.

## E-mail transacional (boas-vindas) — opcional, no-op sem SMTP

O e-mail de boas-vindas pós-signup (`src/email/welcomeEmail.js`) é enviado
por `src/email/mailer.js`, um transporte SMTP provider-agnóstico (nodemailer).
É **opcional**: sem as envs `SMTP_*`, todas as funções viram **no-op
silencioso** (`{ skipped: true }`) — o signup nunca quebra e os testes seguem
db-free/env-free. O envio é fire-and-forget no `POST /register` e só dispara
para e-mails **reais** informados pelo usuário (não para o fallback
`user_*@sistema.com`).

| Env             | Obrigatória? | O que faz                                                       |
|-----------------|--------------|-----------------------------------------------------------------|
| `SMTP_HOST`     | para ativar  | Host do servidor SMTP (ex.: `smtp.gmail.com`). Sem ela → no-op. |
| `SMTP_PORT`     | não          | Porta (default `587`).                                          |
| `SMTP_SECURE`   | não          | `true` para TLS direto (porta 465); default `false`.            |
| `SMTP_USER`     | para ativar  | Usuário de autenticação.                                        |
| `SMTP_PASS`     | para ativar  | Senha / app password.                                           |
| `SMTP_FROM`     | não          | Remetente exibido (default = `SMTP_USER`).                      |

**Contato de suporte (dashboard):** o e-mail e WhatsApp de suporte exibidos no
site vêm de constantes em `dashboard/lib/marketing-content.js`
(`SUPPORT_EMAIL`, `SUPPORT_WHATSAPP_*`, `SUPPORT_HOURS`, `SUPPORT_RESPONSE_SLA`).
O e-mail é overridável por `NEXT_PUBLIC_SUPPORT_EMAIL` (default
`contato@espelhagrupos.com.br`, domínio já registrado — não usar
`@botinho.com.br` sem comprar o domínio). Trocar o e-mail = mudar a env ou o
default nesse arquivo, num lugar só. Teste: `test/welcome-email.test.js`.

## Isolamento de bancos (não substituir prod por staging)

Quatro camadas de isolamento em produção:

1. `DATABASE_URL` diferente: `file:./prisma/staging.db` vs `file:./prisma/prod.db`.
2. Diretórios físicos diferentes no VPS: `~/wabot-staging/prisma/` vs `~/wabot/prisma/`.
3. `AUTH_INFO_DIR` absoluto e diferente entre ambientes.
4. `.gitignore` cobre `*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`,
   `auth_info/`, `.env`.

O workflow de deploy nunca copia banco entre ambientes — só faz
`git pull` (sem tocar em gitignored) + `npx prisma migrate deploy` (aplica
migrations, não substitui dados).

### SQLite em modo WAL (canônico, aplicado em todo boot)

`src/db.js` aplica os seguintes PRAGMAs no primeiro import do PrismaClient:

```
PRAGMA journal_mode = WAL          # rollback journal -> WAL
PRAGMA busy_timeout = 5000         # aguarda até 5s em locks (em vez de 0)
PRAGMA synchronous  = NORMAL       # companion recomendado de WAL
PRAGMA temp_store   = MEMORY
```

Por quê: SQLite default não suporta bem leituras simultâneas com escritas;
em picos (várias sessões escrevendo em `MessageLog`/`AnalyticsEvent`/
`AffiliateClick` ao mesmo tempo) aparecia `SQLITE_BUSY: database is locked`.
WAL + `busy_timeout=5000` eliminam esse erro até dezenas de writers.

Implicações operacionais:
- O banco passa a ter arquivos auxiliares `<db>-wal` e `<db>-shm` no mesmo
  diretório. Os dois estão no `.gitignore`. Backups via `sqlite3 .backup`
  são WAL-safe (a API consolida tudo num snapshot único).
- `journal_mode=WAL` é persistente no arquivo do DB; setar em todo boot é
  idempotente. `busy_timeout` é per-connection — precisa ser reaplicado.
- Escape hatch: `DB_SKIP_PRAGMAS=1` pula a aplicação (útil só em scripts
  one-off; **não usar em prod**).
- Em caso de cópia manual do `.db`, copie também os arquivos `-wal` e
  `-shm` para garantir consistência (ou use `sqlite3 .backup`).

**Backup:** `scripts/backup_prod.sh` rodando diariamente via cron grava em
`/home/deploy/wabot-backups/` (snapshot consistente com `sqlite3 .backup`
+ tar.gz do `auth_info`, rotação de 30 dias, upload opcional via `rclone`).
A `.backup` API é WAL-safe (faz checkpoint implícito). Detalhes em
`docs/deploy/backup-prod.md`.

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

## Dedup das ofertas automáticas (cruzada entre automações, por grupo)

Os **envios automáticos** (`src/offerAutomation/dispatcher.js`) NÃO passam pela
dedup de link do `bot-worker.js` (essa só vale para mensagens encaminhadas de
grupos monitorados). Eles enviam via `sendBroadcast` (manager.js) e têm dedup
própria. Antes, a dedup era só `automation.sentItemIds` — **per-automação**.
Resultado: N automações apontando pro mesmo grupo reenviavam o MESMO produto
(uma vez por automação), porque uma não conhecia o que a outra mandou.

Hoje há uma camada **cruzada por grupo de destino**, na tabela
`OfferAutomationSentLog (userId, destGroupJid, productKey, priceCents, sentAt)`:

1. Antes de enviar, o dispatcher carrega o que já saiu pro grupo dentro de
   `OFFER_AUTOMATION_DEDUP_WINDOW_MS` (default **24h** = "no máximo uma vez por
   dia") e filtra os produtos por `productKey` (de `productDedupKey`).
2. **Exceção por preço:** se o `priceCents` atual difere de todos os preços
   com que aquele produto saiu nas últimas 24h, a oferta **passa** — é uma
   oferta nova de fato (relâmpago da manhã a R$X vs. da tarde a R$Y). Isso
   concilia o "1x/dia" com o pedido histórico de não prender oferta legítima
   que voltou mais barata.
3. Cada envio grava uma linha em `OfferAutomationSentLog`; registros fora da
   janela são podados a cada run (a tabela fica limitada à janela por grupo).
4. `dedupeOffersByProduct` continua colapsando o mesmo produto **dentro de um
   lote** (mantém o primeiro), então mesmo-produto/preços-diferentes no MESMO
   envio vira uma oferta só — a exceção por preço só atua entre execuções.

Teste: `test/offer-automation.test.js`.

## Agregação de duplicatas em `MessageLog.dedupHits`

Em vez de criar N linhas de `skip:dedup_recent_link` quando a mesma
oferta cai no mesmo destino ao longo do dia (várias automações/canais-fonte
apontando pro mesmo grupo, ou a fonte republicando), agregamos no contador
`dedupHits` da linha mais recente do mesmo `(userId, destGroup,
convertedUrl)`. Implementado em `registerDedupBlock()` no `bot-worker.js`:

1. Procura a linha mais recente dentro de `linkDedupWindowMs` (default 24h
   = "no máximo uma vez por dia", override via env `DEDUP_LINK_WINDOW_MS`)
   filtrando por `userId`, `destGroup` e `convertedUrl OR originalUrl`.
2. Se achar → `UPDATE` com `dedupHits = dedupHits + 1`.
3. Senão (estado dessincronizado, fallback raro) → cria linha
   `status='skipped'` com `errorMsg='skip:dedup_recent_link'`.

O painel (`dashboard/app/dashboard/logs/page.js`) renderiza um chip
`+N repetições bloqueadas` ao lado do status quando `dedupHits > 0`,
inclusive em linhas de sucesso (uma promoção que saiu e foi tentada
novamente N vezes pelos canais-fonte mostra ambos: "✓ Enviado +3
repetições bloqueadas").

O endpoint `/api/logs/summary` soma `dedupHits` em vez de contar
linhas, garantindo que o card "Bloqueadas por repetição" reflita o
número real de tentativas bloqueadas e não o número de linhas no
banco. Índice composto `(userId, destGroup, convertedUrl, sentAt)`
suporta o lookup em volume.

## Taxonomia canônica de `MessageLog.errorMsg`

Toda escrita final em `MessageLog.errorMsg` passa por `classifyError()`
em `src/errorTaxonomy.js`. O painel e o endpoint `/api/logs/summary`
agregam contagens via `categorizeErrorMsg()` lendo o prefixo. Prefixos
canônicos (não inventar novos sem atualizar `errorTaxonomy.js` E o
tradutor `explainErrorMsg` em `dashboard/app/dashboard/logs/page.js`):

| Prefixo                          | Categoria          | Significado                                                  |
|----------------------------------|--------------------|--------------------------------------------------------------|
| `skip:dedup_recent_link`         | DEDUP              | Mesma oferta já enviada ao destino nas últimas 24h (per-dest) |
| `skip:dedup_recent_link_global`  | DEDUP              | Idem, via Redis global                                       |
| `skip:blocked_keyword`           | CONFIG_BLOCK       | Palavra-chave bloqueada pelo usuário                         |
| `skip:title_mismatch`            | CONFIG_BLOCK       | Caption não bate com og:title raspado                        |
| `skip:text_too_large`            | CONFIG_BLOCK       | Mensagem acima de MAX_INCOMING_MESSAGE_CHARS                 |
| `skip:no_valid_conversions`      | CONFIG_BLOCK       | Nenhum link convertido com sucesso                           |
| `skip:policy:<...>`              | CONFIG_BLOCK       | Política de encaminhamento do grupo bloqueou                 |
| `skip:decrypt_failed:<detail>`   | DECRYPT            | libsignal: Bad MAC / counter / key issues                    |
| `skip:incoming_error:<detail>`   | INCOMING_ERROR     | Erro genérico no processamento de incoming                   |
| `timeout:send:<destJid>`         | TIMEOUT            | `SEND_MESSAGE_TIMEOUT` após retries                          |
| `timeout:incoming`               | TIMEOUT            | `MSG_QUEUE_TIMEOUT_MS` no preparo da mensagem                |
| `error:queue_full`               | QUEUE_FULL         | Fila interna de envios cheia ou worker encerrando            |
| `error:worker_restart`           | WORKER_RESTART     | Bot reiniciou antes de drenar a fila                         |
| `error:channel_forbidden`        | CHANNEL_FORBIDDEN  | Canal-destino sem permissão (403)                            |
| `error:channel_throttled`        | CHANNEL_THROTTLED  | Canal pediu para esperar                                     |
| `error:baileys:<statusCode>`     | BAILEYS            | Boom/Baileys com `output.statusCode`                         |
| `error:conversion:<motivo>`      | CONVERSION         | Falha de conversão de afiliado                               |
| `error:other:<detail>`           | OTHER              | Catch-all classificado pelo classifyError                    |

Regras de status (`MessageLog.status`):
- `skip:*` → `status='skipped'` (decisão de não enviar; proteção/config)
- `timeout:*` → `status='error'` (tentamos e não conseguimos a tempo)
- `error:*` → `status='error'`
- Sucesso → `status='success'`
- Em vôo → `status='queued'` ou `'sending'`

Strings históricas livres caem em categoria `UNKNOWN` — `categorizeErrorMsg`
é tolerante. Para mudanças destrutivas (renomear prefixo) considerar
backfill via SQL antes do deploy.

## Timeouts no pipeline de mensagens

| Constante                       | Default | Onde     | O que faz                                                          |
|---------------------------------|---------|----------|--------------------------------------------------------------------|
| `PRODUCT_TITLE_FETCH_TIMEOUT_MS`| 3s      | scraper  | Aborta scrape de og:title (`AbortSignal.timeout`); retorna `null`. |
| `MSG_QUEUE_TIMEOUT_MS`          | **25s** | incoming | Aborta `processIncomingMessage` inteiro. `errorMsg=timeout:incoming`. |
| `MSG_QUEUE_WATCHDOG_MS`         | 40s     | incoming | Libera slot travado mesmo após timeout (safety net).               |
| `SEND_MESSAGE_TIMEOUT_BY_ATTEMPT_MS` | [90,60,45]s | send | Por tentativa: 1ª paciente, retries rápidas. Override uniforme via `SEND_MESSAGE_TIMEOUT_MS` (vazio = usa array). |

Defaults foram subidos em 2026-05 (15→25s incoming, 60→90/60/45s send)
após observar timeouts excessivos com Amazon BR lenta (HTML ~1.3MB).
**Não desligar os timeouts** — sem eles, um socket Baileys silenciosamente
morto trava a fila serial inteira até reinício do worker.

## Status honesto da sessão WA no painel: nem falso-offline, nem "conectando" eterno (2026-07)

Dois bugs relacionados, resolvidos juntos, no eixo "o que o cliente vê no painel
enquanto o socket Baileys pisca":

**1. Falso "desconectado" durante reconexão automática.** O heartbeat periódico
do worker (`persistWorkerHeartbeat`, `src/bot-worker.js`) calculava seu próprio
status olhando só `activeSock`/`pendingSock` — e no intervalo real entre um
close transitório e o próximo `startBot()` reconectar de fato (5s no caso
comum, até 5min em cooldowns de flap/quedas-estáveis/replaced), os dois ficam
`null`. Isso sobrescrevia para `disconnected` o `connecting` que
`buildCloseSessionPatch` (`src/core/sessionPersistencePolicy.js`) já grava de
propósito em qualquer close não-terminal. Fix: `scheduleReconnect()` centraliza
todo `setTimeout(startBot, ...)` marcando `reconnectDeadlineMs`; o heartbeat só
reporta `idle` se NÃO há reconexão agendada.

**2. Válvula de segurança contra loop escondido do cliente.** O fix acima
sozinho criava um risco oposto: cooldowns encadeados (flap → replaced →
stable-close) mantêm `hasReconnectScheduled=true` continuamente, então o
cliente NUNCA veria "desconectado" mesmo preso num loop por dezenas de
minutos. `disconnectedSinceMs` (`src/bot-worker.js`) marca a 1ª vez que a
sessão sai de `connected` (não reseta a cada retry dentro do mesmo episódio) e
o heartbeat "desiste" de esconder depois de `WA_HEARTBEAT_MAX_RECONNECTING_MS`
(default 5min, `computeHeartbeatState` em `sessionPersistencePolicy.js`) —
reportando `idle`→`disconnected` mesmo com reconexão ainda agendada. O worker
CONTINUA tentando reconectar sozinho (essa válvula só afeta o que é mostrado,
não a lógica de retry); se reconectar depois do teto, o próximo `open` volta a
marcar `connected` normalmente.

**Importante — durante qualquer cooldown de reconexão o bot está DE FATO fora
do ar** (sem socket ativo, nada é recebido nem espelhado), não é só um detalhe
de status no painel. Por isso `RECONNECT_STABLE_CLOSE_COOLDOWN_MS` (o cooldown
mais longo, para quedas "tipo relógio" de sessão estável) foi reduzido de 30min
para **5min** (2026-07) — 30min de indisponibilidade repetida era caro demais
só para conter uma notificação de re-sync que aparece apenas no celular do
dono da conta (não afeta os grupos). 5min também é o valor de
`WA_HEARTBEAT_MAX_RECONNECTING_MS` acima, de propósito: é o mesmo instante em
que o painel passa a avisar o cliente. `RECONNECT_REPLACED_DELAY_MS` (cooldown
de double-possession) já usa `RECONNECT_MAX_MS` (5min por padrão) — mesma
ordem de grandeza. Só `RECONNECT_FLAP_COOLDOWN_MS` (2min) fica abaixo, o que é
esperado (flapping é o caso mais curto/menos grave).

**3. Painel não pode mascarar o status honesto.** `dashboard/app/painel/whatsapp/page.js`
tinha `isBootstrappingSession = isRunning && !isConnected && status === 'disconnected'`
renderizando "Conectando…" — isso escondia exatamente o sinal que os dois fixes
acima existem para mostrar. Removido: `isAwaitingConnectStart` (estado local do
clique em "Conectar") já cobre a corrida legítima de boot; `status==='disconnected'`
agora sempre renderiza "Desconectado" no painel.

Testes: `test/session-persistence-policy.test.js` (`computeHeartbeatState`).

## Loop de retry-receipt travado derrubando sessão a cada ~50min (RCA 2026-07)

**Sintoma:** cliente reportou queda "de novo hoje". Investigação encontrou uma
sessão caindo em cadência de relógio quase exata (a cada ~50min, por DIAS),
código `500` no close. Antes de investigar fundo parecia o mesmo padrão do
Trilho B (init-queries 408) — mas `init408=0` pra essa sessão (o bump do
Baileys já tinha resolvido aquele sintoma). Causa raiz é outra e mais
específica.

**Causa raiz confirmada:** uma mensagem EDITADA de um canal (`@newsletter`)
seguido pela conta ficou com a sessão de chave dessincronizada — o Baileys não
conseguia decifrá-la e mandava `sendRetryRequest` ("sent retry receipt") pra
pedir reenvio. O WhatsApp reoferecia a mesma mensagem periodicamente; toda vez
que a oferta não era aceita (ack rejeitado), o servidor mandava
`stream:error` com o node de ack daquela mensagem embutido — e o Baileys
**desconhece esse motivo específico**, então cai no default `DisconnectReason.badSession`
(`500`) em `getErrorCodeFromStreamError` (só `"conflict"` tem mapeamento
próprio; qualquer outro motivo vira 500). Ou seja: **`500` não significa
necessariamente sessão corrompida — é o fallback do Baileys pra motivo
desconhecido.** Sempre inspecionar o campo `node` bruto da linha `"stream
errored out"` (não só o `code`) antes de assumir que é badSession de verdade.

**Por que o loop nunca se resolvia sozinho:** o Baileys tem um limite
embutido (`maxMsgRetryCount`, default 5) — depois de 5 tentativas de retry
pra uma mensagem, ele desiste e limpa o contador (`msgRetryCache.del(key)`).
Mas esse contador (`msgRetryCounterCache`) é criado **do zero a cada
`makeWASocket()`** a menos que seja passado explicitamente na config — ou
seja, a cada reconexão. Como a própria mensagem travada estava CAUSANDO a
reconexão (via `stream:error`), o contador nunca sobrevivia até a próxima
tentativa: sempre voltava a 0, nunca chegava a 5, o Baileys nunca desistia, o
WhatsApp nunca parava de reoferecer. Loop que se autoalimenta indefinidamente
— sem outra intervenção, teria continuado pra sempre (a sessão real ficou
presa nisso por pelo menos 3+ dias antes de ser detectada).

**Fix (`src/bot-worker.js`):** `msgRetryCounterCache` e `placeholderResendCache`
(a segunda evita reconsultar `requestPlaceholderResend` pra mensagem que já
pediu) agora são criados **uma vez em escopo de módulo** (`NodeCache` de
`@cacheable/node-cache`, mesma lib que o Baileys usa internamente — já vinha
como dependência transitiva, promovida a dependência direta) e passados
explicitamente pro `makeWASocket()`. Sobrevivem a reconexões dentro do MESMO
processo worker; começam limpos a cada restart do worker (aceitável — não é
esse o vetor do bug). `stdTTL` de 1h e `useClones: false` espelham os defaults
internos do Baileys.

**Não é sobre decrypt/crypto em si.** As falhas de "failed to decrypt
message" (`Bad MAC`/`SessionError`/`MessageCounterError`) que aparecem em
volta são RUÍDO SECUNDÁRIO da mesma mensagem travada tentando decifrar de
novo a cada ciclo — não são a causa da queda, e resetar a sessão inteira da
conta (ou pedir pro cliente reescanear o QR) NÃO ataca a causa raiz. Cuidado
ao diagnosticar: a correlação temporal entre "decrypt failure" e "close" pode
enganar — só a inspeção do `node` bruto do `stream:error` revelou a mensagem
específica travada.

**Não regredir:** não remover `msgRetryCounterCache`/`placeholderResendCache`
do config do `makeWASocket()`, e não recriá-los dentro de `startBotInner()`
(precisam ficar em escopo de módulo, fora da função que roda a cada
reconexão) — senão o bug volta. Guardado por teste estrutural em
`test/bot-worker-retry-cache-wiring.test.js` (lê o source e falha se a
declaração for movida pra dentro de `startBotInner` ou sumir da config do
`makeWASocket`).

**Blindagem contra recorrência (mesmo por causa raiz diferente):** o fix acima
resolve o mecanismo específico encontrado, mas não impede que uma OUTRA causa
volte a travar uma mensagem em loop de reentrega no futuro. Por isso, além do
fix, `src/bot-worker.js` agora rastreia `stuckMessageTimestamps` (Map por
messageId) via `extractAckMessageIdFromStreamErrorNode` +
`registerStuckMessageAndDecide` (`src/core/reconnectPolicy.js`, puras/
testadas): se o MESMO `messageId` aparecer no ack de um `stream:error` 2+
vezes (`WA_STUCK_MSG_THRESHOLD`, default 2) dentro de 2h
(`WA_STUCK_MSG_WINDOW_MS`), emite `logger.error` + `AnalyticsEvent
ops_wa_stuck_message_retry` — visibilidade operacional ANTES do cliente
reclamar, independente de qual bug específico estiver causando o travamento
dessa vez.

## Loop de init-queries 408 derrubando sessões (RCA 2026-07 — Trilho B)

**Causa raiz confirmada (docs/rca-sessoes-whatsapp-caindo-2026-07.md):** cada
sessão de cliente em prod caía ~11-12x/dia. Toda conexão (`opened connection
to WA`) era seguida ~60s depois de `unexpected error in 'init queries'`
(statusCode 408, `executeInitQueries → fetchProps → waitForMessage` sem
resposta do WA) → o WA encerrava o stream (500/428) → reconexão → repete.
Correlação perfeita: `open == init408` nas sessões estabelecidas. Não é
deploy, memória/GC, dupla-posse nem versão de fetch (`fetchLatestBaileysVersion`
respondia normalmente). Interação `@whiskeysockets/baileys` ↔ protocolo WA.

**Fix aplicado (menor risco primeiro, por `docs/handoff-sonnet-execucao-sessoes-whatsapp.md`):**
bump de `@whiskeysockets/baileys` de `^6.7.16` para `^6.7.23` (última da linha
6.7.x — a lib foi renomeada para `baileys` no npm a partir da 6.17.x/7.x, mas
migrar de pacote é mudança maior e fica para uma 2ª rodada se o bump patch não
resolver). **Ainda não validado em staging/prod** — pendente:
1. Merge `develop` → autodeploy staging → rodar a ferramenta de medição do
   handoff (`ratio 408/open` e `quedas`) por ≥60min. Se staging estiver
   `remote`, reiniciar `bot-supervisor-staging --update-env` para carregar o
   código novo; se `inline`, o deploy já recarrega sozinho.
2. Se `408/open` não cair a ~0 em staging, próxima alavanca é fixar uma versão
   WA conhecida-boa em vez do `fetchLatestBaileysVersion()` (`fetchVersionCached`,
   `src/bot-worker.js`), ou migrar para o pacote `baileys` (renomeado).
3. Só depois de aprovado em staging: PR `develop → main` e, **passo manual
   obrigatório**, `pm2 restart bot-supervisor --update-env` em prod — só assim
   os workers já-rodando carregam a lib nova (deploy da API sozinho não toca
   nos workers em modo `remote`). Essa reinicialização reconecta **todas** as
   sessões de uma vez — anunciar/agendar antes, não fazer às cegas.

**Higiene (não afeta a causa raiz):** `unexpected error in 'init queries'` é
rebaixado de `error` para `debug` em `instrumentBaileysLoggerForHealth`
(`src/bot-worker.js`) só para não inflar `bot.log` (~14k linhas/dia
observadas) — não muda a lógica de reconexão nem a métrica de saúde
(`SESSION_HEALTH_SIGNAL_RE`), que continuam olhando o fechamento real da
conexão, não a linha de log.

## Teto de memória por bot-worker (`BOT_WORKER_MAX_OLD_SPACE_MB`)

Os bot-workers são `fork()` da API (modo `inline`) ou do supervisor (modo
`remote`) e **não são alcançados pelo `max_memory_restart` do PM2** — esse só
enxerga os apps PM2, não os filhos forkados. Sem teto, um worker incha sob
scrape pesado (Amazon ~1.3MB + buffers de imagem hi-res) e, num VPS apertado
**sem swap**, a pausa de GC trava o event-loop o bastante para o keepalive do
WhatsApp estourar → o socket cai (408/428) → reconexão em loop, que no celular
vira spam de "A sincronização foi concluída" e, nas mensagens em vôo, a linha
`error:worker_restart` ("O bot reiniciou enquanto essa mensagem estava
esperando para ser enviada"). Quedas repetidas ainda dessincronizam o Signal
(Bad MAC / `badSession` 500).

`src/core/sessionCore.js` passa `--max-old-space-size` no `execArgv` do
`fork()`, resolvido por `resolveWorkerExecArgv()` em
`src/core/workerSpawnOptions.js` (módulo puro/testável p/ não tocar a lógica do
`[PROTECTED_CORE]`):

| Env                            | Default | Efeito                                                       |
|--------------------------------|---------|--------------------------------------------------------------|
| `BOT_WORKER_MAX_OLD_SPACE_MB`  | `384`   | Teto do old-space (heap JS) de cada worker, em MB.           |
|                                | `0`/``  | Escape hatch: desliga o cap (comportamento histórico).       |

Limitação: o flag limita só o heap JS, não a memória externa (Buffers de
mídia). É mitigação de pico de GC, **não** teto rígido de RSS — em VPS
subdimensionado, **swap continua sendo pré-requisito** (a primeira linha de
defesa). Teste: `test/core/worker-spawn-options.test.js`.

## Política de memória (CANÔNICA — LEIA antes de qualquer mudança que afete RAM)

> **REGRA #1 — SUPER SINALIZAR antes de executar.** Qualquer decisão/mudança
> que **possa aumentar significativamente o uso de memória** (novo processo
> PM2, novo worker/serviço, subir limite de heap, ligar BullMQ/Redis, cache
> em memória, manter staging ligado, adicionar dependência pesada, processar
> mídia maior, aumentar concorrência/`instances`, etc.) **DEVE ser destacada
> de forma explícita para a usuária ANTES de aplicar** — com a estimativa de
> RAM adicional e o impacto no VPS atual. Nunca aplicar mudança memory-heavy
> em produção sem esse aviso e o OK explícito.
>
> **REGRA #2 — Sempre oferecer alternativas mais leves.** Ao propor qualquer
> solução, trazer junto opção(ões) que **ocupem menos memória** (ex.: stream
> em vez de buffer, fila persistente em disco/Redis em vez de in-memory,
> processo sob demanda em vez de long-running, lazy import, paginação).
>
> **REGRA #3 — Sempre oferecer limpeza de memória que NÃO prejudique o
> sistema.** Liberações seguras e reversíveis primeiro; nunca sugerir algo que
> derrube sessões, perca dados ou mascare um vazamento. Ver lista abaixo.

### Por que esta política existe (incidente jun/2026 — RCA resumido)

Sintomas: spam de push **"A sincronização foi concluída"** no celular +
mensagens **"O bot reiniciou enquanto essa mensagem estava esperando para ser
enviada"** (`error:worker_restart`).

Causa raiz: **VPS sufocado de RAM, sem swap.** VPS de 3.7 GB, **swap = 0**,
rodando prod **e** staging juntos (10+ bot-workers ~2.4 GB + `api` +
`dashboard`/Next + bots Telegram). Os bot-workers são `fork()` e **não têm
teto de memória** (o `max_memory_restart` do PM2 não alcança filho forkado).
Sob scrape pesado (Amazon ~1.3 MB + buffers de imagem) ou pausa de GC, o
event-loop do worker travava → keepalive do WhatsApp estourava → socket caía
(408/428) → reconexão em loop. Cada reconexão = push de sync; mensagens em vôo
viravam `worker_restart`. Quedas repetidas dessincronizavam o Signal (Bad MAC
/ `badSession` 500). Diagnóstico por `bot.log` (tally de `code`) + tabela
`AnalyticsEvent` (`whatsapp_connected`, `ops_wa_*`) + `free -h`.

Descartados com dados (não regredir o diagnóstico): dupla posse/`connectionReplaced`
(440 recente = 0), worker órfão (todos filhos da API, 1 por userId), API em
churn (1 restart/6h), monitor de heartbeat matando workers ("heartbeat
estagnado" = 0).

Correções aplicadas: **swap de 4 GB em prod** (zerou `worker_restart`) + **teto
de heap por worker** (`BOT_WORKER_MAX_OLD_SPACE_MB`, seção acima) + **botão
liga/desliga staging** (economia de RAM sob demanda) + **vigilância 403**
(`ops_wa_forbidden`).

### Fatos de capacidade (use para estimar antes de sinalizar)

- **Orçamento por sessão WhatsApp ativa:** ~**0,35 GB** de RSS (worker sob o
  teto de 384 MB + overhead). Base fixa (api+dashboard+telegram+OS) ~**2 GB**.
- **Fórmula:** `RAM ≈ 2 GB + N_sessões × 0,35 GB + (staging co-locado? +2 GB) + ~20% folga`.
- **Custo marginal de infra por cliente:** ~R$1,75/mês (marginal) a ~R$2-3/mês
  (com base amortizada). Não é o gargalo do produto — RAM é barata perto do ticket.
- **Swap é pré-requisito, não muleta:** num VPS apertado, swap ativo é a 1ª
  linha de defesa contra pico de GC. Mas swap EM USO constante = sinal de que
  o box está subdimensionado de verdade (dimensionar mais RAM).
- VPS atual é **x86 (AMD)** — rescale Hetzner só dentro da mesma arquitetura
  (CPX/dedicado); ARM (CAX, ~3-6x mais barato por GB) exige servidor novo +
  migração, não rescale.

### Limpezas de memória SEGURAS (não prejudicam o sistema)

Preferir sempre estas antes de qualquer upgrade ou medida agressiva:

- **Adicionar swap** (`fallocate`/`mkswap`/`swapon` + `/etc/fstab`) — rede de
  segurança, sem downtime, reversível.
- **Desligar staging quando não está validando** (botão admin / `pm2 stop
  api-staging visual-staging`) — libera ~1-1.4 GB. Reversível.
- **Confirmar o teto de heap dos workers** (`BOT_WORKER_MAX_OLD_SPACE_MB`)
  está aplicado — força GC em vez de inchar.
- **Parar processos não-essenciais ociosos** (ex.: `bot-supervisor` em modo
  inline já fica em standby; `snapshot-cron` só roda na janela).

Limpezas **PROIBIDAS** sem OK explícito (podem prejudicar): `pm2 restart api`
em massa (derruba sessões em modo inline), matar bot-workers à mão (perde
mensagens em vôo + dessincroniza Signal), `redis-cli FLUSHALL`/`del` em filas
BullMQ (pegadinha #9 — dessincroniza o Worker), reduzir timeouts do pipeline
(seção "Timeouts"), baixar `IMAGE_HTML_MAX_BYTES` < 2MB (quebra scrape Amazon).

## Fila de envio (BullMQ + DLQ)

Cada bot-worker tem uma fila própria de envio (`wabot-send-<userId>`) e
uma DLQ correspondente (`wabot-send-<userId>-dlq`). Configuração via env:

| Env                 | Default                       | Efeito |
|---------------------|-------------------------------|--------|
| `QUEUE_BACKEND`     | `memory`                      | `'memory'` (default) força in-process; `'bullmq'` opt-in via Redis. Vazio = memory. |
| `REDIS_URL`         | (vazio)                       | Necessário **apenas** quando `QUEUE_BACKEND=bullmq`. Sem ele, BullMQ cai em memory-fallback. |
| `BULLMQ_QUEUE_NAME` | `wabot-send-${userId}`        | Nome da fila principal; DLQ é `<name>-dlq`. |
| `SEND_MAX_ATTEMPTS` | 3                             | Retries in-process antes do job ser declarado falha definitiva. |

**Default é `memory` — BullMQ é opt-in explícito.** Já tentamos
auto-ligar BullMQ quando `REDIS_URL` está presente e isso quebrou o
envio de imagem em staging: o payload do job pode carregar `image.buffer`
(Buffer real) ou o proto de relay; BullMQ persiste via `JSON.stringify`,
e Buffer vira `{type:'Buffer', data:[...]}` na deserialização — o Baileys
não reconhece como mídia e a oferta sairia **sem foto**.

**Backend híbrido (P1-2, roteamento por serializabilidade):** o wrapper em
`createSendBackend` (bot-worker.js) hoje roteia **por job**, não desligando
mais BullMQ inteiro:
- Job com `payloadRecipe`/`payload` puro (broadcast, oferta automática,
  agendado) → **BullMQ**: persiste e sobrevive a restart do worker. No
  dequeue, `processSendJob` reconstrói a mídia via `buildPayloadFromRecipe`
  (fetch por URL) e atualiza o `MessageLog` sozinho.
- Job com closure `buildPayload`, proto de relay ou `image.buffer`
  (envio monitorado de mídia "original") → **fila em memória**
  (memory-only): não é serializável sem corromper a mídia. Sai **com foto**
  normalmente; só não persiste em restart (aceitável: está atrelado a estado
  efêmero da mensagem ao vivo). A decisão usa `findUnserializableField`.

Logo, ligar `QUEUE_BACKEND=bullmq` **não** faz mais oferta com imagem sair
como texto — no pior caso ela vai pela fila em memória. Limitação conhecida:
um job recipe-based que sobrevive a restart perde o callback `onDone`
(analytics best-effort), mas o envio e a atualização de status do log
acontecem mesmo assim. Validar em staging antes de tornar default.

**DLQ:** quando `processSendJob` lança após esgotar `SEND_MAX_ATTEMPTS`,
o BullMQ marca o job como `failed`. Um listener no Worker copia o payload
para a DLQ (`<queueName>-dlq`) com `removeOnComplete: false`. A DLQ **não
tem worker**, então os jobs ficam em `waiting` até ação manual ou poda.
Inspeção via:

- `GET  /api/admin/send-dlq/:userId?limit=100` — lista jobs
- `POST /api/admin/send-dlq/:userId/retry/:jobId` — reenfileira na principal
- `DEL  /api/admin/send-dlq/:userId/job/:jobId` — descarta
- `POST /api/admin/send-dlq/:userId/purge` — drena toda a DLQ

Helpers programáticos: `src/jobs/sendDlq.js`. Todas as ações destrutivas
gravam `AdminAuditLog`.

**Retenção (P2-1):** como a DLQ nunca processa jobs, `removeOnComplete/Fail`
não os limpa (nunca completam). A poda é por idade: `pruneDlqOlderThan()`
remove entradas mais velhas que `SEND_DLQ_RETENTION_MS` (default 30 dias) via
`failedAt`. Pensado para rodar no cron de manutenção. Sem isso a DLQ cresce
indefinidamente. **Retry seguro (P2-3):** `retryDlqJob` reenfileira com um
`jobId` único (`dlq-retry:<logId>:<dlqJobId>`), nunca reusando o `logId` cru —
senão um `add` com jobId já presente no histórico (`removeOnComplete:500`)
seria descartado em silêncio e o retry se perderia.

### Fail-mode da dedup global vs. rate-limit (`REDIS_DEDUP_FAIL_MODE`)

O `bot-worker.js` tem duas camadas que dependem do Redis quando em modo
`remote`/global: o **rate-limit por destino** e a **dedup global de envio**
(cross-instância). Quando o Redis pisca, o comportamento desejado nas duas é
**diferente**, por isso o fail-mode foi desacoplado:

| Env                     | Default                  | Governa     | Na falha de Redis                                              |
|-------------------------|--------------------------|-------------|---------------------------------------------------------------|
| `REDIS_FAIL_MODE`       | `open`                   | rate-limit (e fallback da dedup) | `open` deixa passar; `closed` lança e estanca o envio. |
| `REDIS_DEDUP_FAIL_MODE` | herda `REDIS_FAIL_MODE`  | só a dedup global | `open` pode **DUPLICAR** um envio (risco de ban); `closed` derruba só aquela mensagem (oferta perdida, recuperável). |

Por que separar: fazer o rate-limit `closed` trava a fila serial inteira num
blip de Redis (ruim). Já a dedup `closed` só aborta a mensagem corrente no
pipeline de incoming (o `throw` é por-mensagem, **não** trava a fila de envio).
Como o pior cenário do produto é **ban por envio duplicado**, em prod o
recomendado é `REDIS_DEDUP_FAIL_MODE=closed` — mas, por ser mudança de
semântica fail-open/closed, **validar em staging primeiro** (vide
`docs/sprint-0-baseline-and-dod.md`). Default herda `REDIS_FAIL_MODE`, então
sem setar nada o comportamento é idêntico ao histórico. A camada local de
dedup (em disco, por worker) continua sendo a primeira linha e independe do
Redis.

## Sinais operacionais dos gatilhos de escala (`src/observability/operationalSignals.js`)

Para que as decisões de escala (cutover SQLite->Postgres, `WABOT-010`; e ligar
`REDIS_DEDUP_FAIL_MODE=closed`) sejam **objetivas e não subjetivas**, dois
gatilhos são instrumentados como sinais operacionais:

| Sinal             | Onde é registrado                                  | AnalyticsEvent durável  |
|-------------------|----------------------------------------------------|-------------------------|
| `sqlite_busy`     | middleware central em `src/db.js` (`prisma.$use`) ao pegar `SQLITE_BUSY`/`database is locked` | `ops_sqlite_busy`      |
| `dedup_fail_open` | `bot-worker.js`, no caminho fail-open da dedup global | `ops_dedup_fail_open`   |

- `operationalSignals.js` é um **módulo leaf** (não importa `db.js`/`analytics.js`
  no topo) para `db.js` poder consumi-lo sem ciclo de import. A linha durável em
  `AnalyticsEvent` sai via dynamic import lazy e **best-effort** (o contador
  in-memory é a fonte confiável; em `SQLITE_BUSY`, a própria escrita do evento
  pode falhar — e tudo bem).
- Leitura: contadores in-process (total / últimas 1h / 24h) aparecem em
  `getApiMetricsSnapshot()` (campo `operationalSignals`) e no `/metrics`
  Prometheus (`wabot_ops_signal_total{signal=...}` e `wabot_ops_signal_24h{...}`).
  Como `sqlite_busy` é por-processo da API e `dedup_fail_open` vem do worker
  (some do snapshot da API), o **histórico cross-processo** vem dos
  `AnalyticsEvent` no banco — base para o critério "SQLITE_BUSY/semana > 0" do
  `WABOT-010`. Teste: `test/observability-operational-signals.test.js`.

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

### 6. Em prod, o arquivo do banco se chamava `dev.db` até 2026-05-22

Histórico: por meses a produção rodou com `DATABASE_URL` apontando para
`prisma/dev.db` (5.8MB, dados reais), enquanto `prisma/prod.db` e
`prisma/staging.db` existiam como arquivos vazios de 0 bytes no mesmo
diretório — restos de tentativas anteriores de migração que nunca foram
concluídas. Em 2026-05-22 fizemos o rename canônico: parou `api`,
backup defensivo via `sqlite3 .backup`, `mv dev.db prod.db`, ajustou
`DATABASE_URL`, `pm2 delete api && pm2 start` (pegadinha #1), validou.

Risco que isso evita: alguém olhar o AGENTS.md, ver que prod "deve"
usar `prod.db`, trocar `DATABASE_URL` para `file:./prisma/prod.db`,
reiniciar — e a aplicação passar a usar o arquivo vazio de 0 bytes.
Login quebra, sessões somem, parece perda total. Antes de qualquer
mudança de `DATABASE_URL`, sempre conferir `ls -la prisma/*.db` e
`sqlite3 <db> "SELECT COUNT(*) FROM User"`.

### 7. O cron de backup chamava um script órfão (`backup_safe.sh`)

Até 2026-05-22 o `crontab -l` do VPS de prod chamava
`/home/deploy/wabot/scripts/backup_safe.sh` — um arquivo que existia no
diretório `scripts/` mas **não** estava versionado no git (untracked,
copiado à mão em algum momento). Por isso `git pull` nunca tocou nele,
e os bugs nunca foram corrigidos via PR:

- Apontava hardcoded para `prisma/dev.db` (caminho errado depois do
  rename — e tinha um `set -euo pipefail` que aborta o script entre
  `pm2 stop api` e `pm2 start api`, deixando a API offline).
- Resolvia `AUTH_INFO_DIR` via `node -e` **sem carregar `.env`**, então
  caía no default errado. Resultado: 11 dias seguidos de backup
  **sem `auth_info`** (`WARN.txt` em cada snapshot). Se o VPS pegasse
  fogo, o restore não traria as sessões WhatsApp de volta.
- Gravava em `/home/deploy/backups/wabot/` (não no canônico
  `/home/deploy/wabot-backups/`).

Correção: trocou cron para `scripts/backup_prod.sh` (canônico, no repo,
WAL-safe via `sqlite3 .backup`, `AUTH_INFO_DIR` correto, grava em
`/home/deploy/wabot-backups/`). Script órfão renomeado para
`.deprecated`. Os 13 snapshots históricos em `/home/deploy/backups/wabot/`
foram mantidos como rede de segurança até o novo diretório acumular
histórico equivalente.

Lição: se o cron de prod chamar um script, **confirmar que o script
está versionado** (`git ls-files scripts/<nome>`). Scripts untracked
no diretório do clone são bombas-relógio — sobrevivem deploys mas
escapam de qualquer code review.

### 8. `prisma migrate deploy` quebra com SQLITE_BUSY se processos PM2 seguram o SQLite

Migrations DML (INSERT/UPDATE) convivem com o WAL ligado; **DDL** (ALTER
TABLE, CREATE INDEX) exige lock exclusivo do SQLite. Enquanto qualquer
processo PM2 que importa `src/db.js` segura conexão aberta no `.db`,
qualquer ALTER falha com `Error: SQLite database error / database is
locked`. Exemplos: `api`/`api-staging`, `bot-supervisor`/
`bot-supervisor-staging` e, em produção, `snapshot-cron` quando está
rodando. Os 5s de `busy_timeout` não bastam — a app nunca solta.

Sintoma observado no autodeploy do PR #651 (2026-05-27): `prisma migrate
deploy` falhou 5x consecutivas dentro do retry loop, deployment abortou.

Correção aplicada nos dois scripts (`deploy_safe_staging.sh` e
`deploy_safe_dashboard.sh`): quando `prisma migrate status` reporta
pendências, o script faz `pm2 stop` nos apps versionados que podem abrir
Prisma **antes** do migrate, aguarda os PIDs sumirem, e religa os
serviços long-running logo após (ou no erro). Em produção, o
`snapshot-cron` é parado se estiver rodando, mas não é reiniciado fora
da janela do cron para evitar snapshot manual fora de hora. Janela de
indisponibilidade ~10-45s, mas só ocorre em deploy com migration nova
— raro e planejado. Sem migration pendente, o passo é pulado e
sessões/API seguem intocadas.

Se um deploy futuro falhar com `database is locked` mesmo após esse
fix: confirmar que os apps PM2 estão sendo de fato parados (`pm2
describe <app>` retorna ok antes do stop? `pm2 pid <app>` vira `0`?).
Para destravar manualmente em emergência no staging: `pm2 stop
api-staging bot-supervisor-staging && cd
~/wabot-staging && npx prisma migrate deploy && pm2 restart
api-staging bot-supervisor-staging --update-env`.
Em produção, investigar também `snapshot-cron` e
eventuais `bot-worker.js` órfãos antes de repetir o migrate.

### 9. Supervisor iniciado do diretório errado consome a Redis DB errada (fila nunca drena)

O `ecosystem.config.cjs` tem os apps de **prod e staging no mesmo arquivo**, e
os `script` são **caminhos relativos** (`src/supervisor/index.js`). O PM2
resolve o script E o `.env` (via dotenv) a partir do **`cwd` de onde o `pm2
start` foi chamado**. Logo, iniciar o `bot-supervisor-staging` de dentro de
`~/wabot` (prod) — direto, ou porque um `pm2 restart`/`pm2 save` antigo
perpetuou um registro com `exec cwd=/home/deploy/wabot` — faz o supervisor
carregar o `.env` de **produção** (`REDIS_URL=.../0`) e consumir a fila de
comandos na **Redis DB errada**.

Sintoma (incidente 2026-06, staging): processo `online`/`0%`/saudável, mas
`api-staging` estoura **todo** comando com `Comando isRunning falhou: Job wait
isRunning timed out ... no finish notification arrived after 5000ms`. No Redis:
`redis-cli -n 1 llen bull:supervisor-commands:active` = 0 e `:wait` só cresce —
ninguém drena. O dashboard mostra "Falha ao carregar status" e o QR fica
carregando pra sempre. **Não** é CPU/carga (load fica baixo) nem o loop de QR
das sessões (isso é ruído secundário).

Diagnóstico decisivo: `pm2 describe bot-supervisor-staging | grep -iE 'script
path|cwd'`. Se apontar pra `/home/deploy/wabot` (sem `-staging`), está errado.

Correção (delete + start do diretório certo — `restart` NÃO reconfigura, ver
pegadinha #1):
```bash
pm2 delete bot-supervisor-staging
cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only bot-supervisor-staging
pm2 save
```

**Nunca** rodar `redis-cli del bull:supervisor-commands:wait` pra "limpar" o
backlog: o BullMQ usa marcadores internos junto da lista `wait` e o `del`
dessincroniza o Worker (ele para de receber o sinal de job novo). Pra limpar
de verdade, use `queue.obliterate()` via um script Node curto com o próprio
BullMQ, ou simplesmente reinicie o processo.

Blindagem em código (não regredir): `src/supervisor/envGuard.js`
(`checkSupervisorEnvConsistency`) roda no boot de `src/supervisor/index.js` e
**aborta com `process.exit(1)`** se `APP_ENV` não bater com o cwd (staging ↔
`-staging`) ou com a Redis DB canônica (staging→`/1`, prod→`/0`). Assim o
supervisor no diretório errado falha no boot em vez de subir surdo pra fila.
Teste: `test/supervisor-env-guard.test.js`.

## Image scrapers — configuração canônica (PR #422, não regredir)

`src/converters/imageScrapers.js` entrega imagem hi-res para link preview
do WhatsApp em **Mercado Livre, Amazon e Shopee**. Ajustes consolidados
em #422 a partir de fixtures reais de HTML (em `test/fixtures/`).
Antes de mexer, leia esta seção inteira.

### Regras invioláveis

- **Não mexer no caminho do Mercado Livre.** É a referência de qualidade;
  já funciona.
- **Não baixar a barra de qualidade**: `IMAGE_HIRES_MIN_DIMENSION_PX = 800`
  é o mínimo aceitável no maior eixo para preview do WA.
- **Não restaurar regex com slashes escapadas** (`https?:\\\/\\\/`) em
  `AMAZON_INLINE_IMAGE_RE` — a Amazon BR atual serve com slashes normais.
- **Não baixar `IMAGE_HTML_MAX_BYTES`** para menos de 2MB — a página do
  produto Amazon passa de 1.3MB e o `data-a-dynamic-image` fica em
  ~320KB. `readLimitedText` precisa devolver o que coletou ao atingir o
  teto (e não `null`).
- **Não enviar URL com badges/overlays** (`_BO`, `_UF`, `_SR`, `_PI*`,
  `_ZJ*`, `_QL*`) para o WhatsApp. `buildAmazonImageUrlCandidates`
  extrai o ID base de `/images/I/` e gera variantes `_AC_SL1500_`,
  `_SL1500_`, `_AC_UL1500_`, `_AC_SX1500_` limpas.
- **Shopee sem creds devolve `null` e está correto**: o SPA shell (~13KB)
  não tem `og:image`, a API v4/v2 responde `error: 90309999`. Caminho
  real em produção é a API de afiliado em `src/converters/shopee.js`
  (creds `appId`+`secretKey`). Não inventar fallback para "consertar"
  isso sem creds — vai dar `null` mesmo.

### O que precisa coexistir (em 3 lugares acoplados)

1. `IMAGE_HIRES_MIN_DIMENSION_PX` (default 800) em `imageScrapers.js`
   determina o "hi-res aceitável" usado pelo `fetchImageBuffer`.
2. `validateDownloadedImage` precisa devolver `{ buffer, mimetype, width,
   height }` — o `fetchImageBuffer` usa `width/height` para decidir.
3. As fixtures em `test/fixtures/` são HTML capturado de produção
   (Amazon B09VQ39F41 e Shopee SPA shell). Se Amazon/Shopee mudarem
   layout, recapture **antes** de mexer no scraper, não depois.

### Stripping de CDN canônico

| CDN                                | Sufixos/tokens que SEMPRE removemos para chegar no original              |
|------------------------------------|--------------------------------------------------------------------------|
| `m.media-amazon.com/images/I/`     | `_AC_SY*`, `_AC_SX*`, `_SL*`, `_SX*`, `_SY*`, `_BO*`, `_UF*`, `_SR*`, `_PI*`, `_ZJ*`, `_QL*` (substituído por `_AC_SL1500_`) |
| `down-br.img.susercontent.com`     | `_tn`, `_xxs`, `_xs`, `_sm`, `_md`, `_lg`, `@resize_w<n>[_n[lh]]`, query `?x-oss-process=...` |
| `cf.shopee.com.br` ↔ susercontent  | Alterna hostnames quando um responde 404                                 |
| `mlstatic.com`                     | `D_NQ_NP_` → `D_NQ_NP_2X_` (não tocar — referência)                      |

### Prova de funcionamento (PR #422)

```
Amazon B09VQ39F41 → 1000x1000 jpeg
Amazon B0CDJ4L7CZ → 1000x679 jpeg
amzn.to short     → 1500x300 jpeg
```

`node --test test/image-scrapers.test.js` → 12/12 pass.

## Resolução de short link da Shopee (canônico — não regredir)

TODAS as fontes de título/preço/imagem da Shopee (API de afiliado GraphQL,
API pública v4 e título via slug) dependem de extrair `(shopId, itemId)` da
URL. Para `s.shopee.com.br`/`shope.ee` isso exige resolver o short link — e
**não pode** ser feito com `fetch(redirect:'follow')` lendo `res.url`:

- A Shopee intercala hop anti-bot no **fim** da cadeia (`verify/traffic`),
  então o `res.url` final perde a URL do produto que passou num hop
  intermediário.
- O short link pode responder 200 com interstitial de redirect via
  JS/meta-refresh em vez de redirect HTTP.
- A cadeia pode exigir cookies setados em hops anteriores (o fetch do Node
  não propaga `Set-Cookie` entre redirects).

Quando a resolução falhava, tudo morria junto e o painel mostrava "Não
conseguimos ler título e preço desse link" (regressão de produção, 2026-06).

Fonte única de verdade em `src/converters/shopee.js`:
- `resolveShopeeShortLink()` — segue redirects **manualmente** com cookie jar,
  para no primeiro hop cuja URL já contém os IDs e extrai o alvo do corpo
  HTML quando não há redirect HTTP. Consumido por `productInfoScraper.js` e
  `imageScrapers.js` — **não** reimplementar resolução local nesses arquivos.
- `extractShopeeIds()` — parsing único de `(shopId, itemId)`, inclusive
  URL-encoded em query param (`verify/traffic?next=...`).

Testes: `test/shopee-shortlink-resolve.test.js` + regressões em
`test/product-info-scraper.test.js`.

### Conversão de link de cupom — TODAS as lojas (`COUPON_LINK_CONVERT`, default OFF)

Links que **não são de produto** (cupom/voucher/campanha, sem ID de produto)
historicamente eram **removidos** (Shopee) ou **descartados/`null`** (Amazon, ML)
na mensagem espelhada. Isso é ruim: o cupom muitas vezes é parte essencial da
oferta (o preço anunciado só fecha com ele), substituí-lo por um link fixo da
conta não serve (as páginas de cupom mudam o tempo todo na origem) e mandar o
original credita a comissão ao afiliado do grupo de origem (concorrente).

**Solução: converter o cupom como afiliado da cliente.** O flag único
`COUPON_LINK_CONVERT` (default OFF, lido em runtime via
`src/converters/couponPolicy.js → shouldConvertCouponLinks()`) governa o caminho
de cupom em TODOS os conversores. É um **interruptor de rollout seguro**: os
caminhos com risco real só passam a valer depois de validados em staging.
Rollback em prod = desligar a env (sem redeploy). Os caminhos de **produto ficam
inalterados** em todos os conversores.

Como cada loja credita o cupom (mecanismo é diferente por afiliado):

| Loja   | Cupom com flag ON | Risco | Notas |
|--------|-------------------|-------|-------|
| **Magalu** | já convertia (sempre): `partner_id` em qualquer URL | nenhum | independe do flag (comportamento pré-existente) |
| **Amazon** | `?tag=` na URL da loja (`amazon.com.br`), não no encurtador | baixo, sem WebView | `convert()` em `amazon.js`, fallback aditivo quando não há ASIN |
| **Shopee** | resolve → `stripAffiliateTracking` (preserva o caminho) → `generateShortLink` → devolve o short link **como-está** | baixo | o short link da API abre direto o app |
| **ML** | ⚠️ **a definir / em teste** | ⚠️ **comissão** | pendurar `partner_id` em página não-produto NÃO credita (vai pro dono do código — ver `mercadolivre.js:700`). Em avaliação: tentar `createLink` no link de cupom e validar em staging. |

`stripAffiliateTracking()` (Shopee) remove só o tracking de terceiros
(`utm_source=an_<id>`, `utm_medium=affiliates`, `af_*`/`deep_and_*`,
`gads_t_sig`, etc.) e **preserva a identidade do cupom** (`path` +
`promotionId`/`voucherCode`/`signature`) — sem isso a API recusa com "Invalid
origin URL".

**Causa raiz do "Oops! Seu navegador não é mais aceito!" (resolvida 2026-06) —
NÃO REGREDIR:** o `unsupported.html` é uma **parede do lado do cliente**: a
Shopee detecta o User-Agent do WebView do WhatsApp e bloqueia **qualquer página
web** `shopee.com.br/...`. O que escapa é o short link `s.shopee.com.br/XXX` da
`generateShortLink`, que ao ser tocado **abre direto o app** (deep-link),
exatamente como os links de produto. Um probe contra a API real
(`scripts/shopee-linktype-probe.mjs`) provou que a API gera um short link
app-deeplink para a origem **natural** do cupom (qualquer caminho `/m/...`,
`/buyer/voucher`, etc.). Há duas invariantes importantes:

1. **Nunca reescrever a origem para landing web** (`/m/cupom-de-desconto` ou
   similar). Essa reescrita transformava um link que abriria o app numa página
   web que SEMPRE cai no `unsupported.html`. A correção é preservar o caminho
   original e devolver o short link da API como-está.
2. **Nunca encurtar `unsupported.html` como `originUrl`.** Alguns short links de
   concorrente resolvem server-side para `https://shopee.com.br/unsupported.html?...`
   (por causa do UA/anti-bot fora do app). Se essa URL for enviada para
   `generateShortLink`, a Shopee gera um shortLink nosso que nasce quebrado e
   cai no mesmo erro no WhatsApp. Quando `resolveShopeeShortLink()` terminar em
   `unsupported.html`, `convert()` deve descartar essa URL resolvida e tentar a
   conversão usando o **short link original** (`s.shopee.com.br/...`) como
   `originUrl`; se a API recusar, aí sim cai no strip seguro. Não remover
   preventivamente o cupom só porque a resolução server-side caiu na parede web.

**Não reintroduzir nenhuma reescrita de cupom para landing web, não usar
`unsupported.html` como origem de afiliado e não remover cupom antes de tentar o
fallback pelo short link original.**

Invariante de segurança em TODOS os caminhos: **o link original de terceiro
NUNCA é encaminhado.** Se a conversão falhar, cai no strip seguro (não vaza
comissão).

**O que só um teste real em staging resolve (não dá para validar no sandbox):**
(1) o ML credita cupom de algum jeito? **Validar clicando no link num celular
ANTES de ligar em prod.** Testes: `test/shopee-affiliate-info.test.js` e
`test/converters-amazon.test.js`.

## Motor único de oferta (`src/converters/offerEngine.js`) — não duplicar lógica

O **Painel "Criar oferta"** (`/m/op/offer` → `POST
/api/link-conversion/scrape-offer`) monta uma oferta (título + preço + link) a
partir de um link colado. A busca de título/preço (converter → resolver URL →
scrapar com credenciais → fallback) vive em **um só lugar**:
**`buildScrapedOffer()` em `src/converters/offerEngine.js`**. Mantido como ponto
único para que qualquer futuro consumidor de oferta reaproveite a mesma lógica
em vez de duplicá-la.

Qual link aparece na oferta final é controlado pela flag `keepOriginalLink`:

| Consumidor              | `keepOriginalLink` | `displayUrl` (link na oferta) |
|-------------------------|--------------------|-------------------------------|
| Painel "Criar oferta"   | `true` (**temporário**, 2026-06) | link **original** colado pelo usuário |

**MODO TEMPORÁRIO (2026-06):** como a conversão só funcionava bem para links
do próprio afiliado, o painel "Criar oferta" usa `keepOriginalLink: true`: a UI
avisa que o link colado precisa ser o do próprio afiliado, e a rota
`/scrape-offer` devolve `conversion: null` e `conversionWarning: null` (a UI não
exibe mais status de conversão). A conversão ainda roda **internamente** só para
buscar título/preço (resolve short link/`/up/`, cookie ML). Contrato histórico a
restaurar quando a conversão voltar: painel com `keepOriginalLink: false` (link
convertido na oferta) + metadados de conversão na resposta.

**Regras:**
- **Não duplicar** a lógica de converter/scrapar/fallback fora de
  `offerEngine.js`. Qualquer novo consumidor de oferta deve chamar
  `buildScrapedOffer()`.
- Exceção no scraper **não** vira erro pro usuário: o motor degrada para
  fallback mínimo (`inferTitleFromUrl` + `scrapeWarning`).
- Links de recomendação ML `/up/MLBU...` são reconhecidos como landing em
  `isMercadoLivreLandingUrl` (`productInfoScraper.js`) e resolvidos para a URL
  canônica do produto via `wid=MLB...` do fragmento — defesa em profundidade
  mesmo quando o link não passa pela conversão.

Testes: `test/offer-engine.test.js` (motor),
`test/link-conversion-route.test.js`.

## Triagem de novas demandas (implementar agora vs. backlog)

- **Sempre que surgir uma nova demanda**, pergunte à usuária se vamos
  implementá-la agora ou se ela prefere adicioná-la como issue ao backlog.
- Se a escolha for **backlog**, releia este `AGENTS.md` para entender o
  padrão de como as issues devem ser criadas (fluxo `feature → develop →
  main`, convenções de processos, portas, taxonomias e demais regras
  canônicas) antes de redigir a issue.

## Regras para qualquer agente de IA neste repo

- **MEMÓRIA — SUPER SINALIZAR.** Qualquer mudança que **possa aumentar muito o
  uso de RAM** deve ser destacada explicitamente para a usuária **antes** de
  executar (com estimativa de RAM e impacto no VPS). Sempre trazer junto
  **alternativas mais leves** e **opções de limpeza de memória que NÃO
  prejudiquem o sistema**. Detalhes e listas em "Política de memória" acima.
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
