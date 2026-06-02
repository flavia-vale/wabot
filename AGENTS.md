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
| `telegram-offer-bot`     | prod     | Bot do Telegram que gera oferta a partir de um link colado    |
| `api-staging`            | staging  | Espelho da API                                                |
| `visual-staging`         | staging  | Espelho do dashboard                                          |
| `bot-supervisor-staging` | staging  | Espelho do supervisor                                         |
| `telegram-offer-bot-staging` | staging | Espelho do bot do Telegram (token SEPARADO do de prod)     |

**Bot do Telegram (`telegram-offer-bot`)**: long-polling em `getUpdates`
(`src/telegram/offerBotRunner.js`, usando a lógica de `src/telegram/offerBot.js`). Exige **um único poller por token** — duas
instâncias com o mesmo `TELEGRAM_OFFER_BOT_TOKEN` dão `409 Conflict` e o bot
para de responder. Prod e staging precisam de tokens **diferentes**. Se o bot
parar de enviar mensagens, suspeite primeiro de: (1) processo morto fora do
PM2 (antes não havia entrada PM2 e ele só subia à mão), (2) 409 por token
duplicado ou webhook setado, (3) token ausente no `.env`. Detalhes em
`docs/telegram/offer-bot.md`.

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
- `grep` precisa listar **5 apps**: `api`, `dashboard`, `bot-supervisor`, `snapshot-cron` e (quando houver) os equivalentes de staging no repo correto.
- `ls` precisa mostrar `protocol.js`, `client.js`, `index.js` (e demais arquivos do supervisor).

Se qualquer item falhar: **BLOQUEAR CUTOVER**. Primeiro promover `develop -> main`, aguardar autodeploy, revalidar pre-flight e só então prosseguir com o runbook de produção.

### Seleção de modo via `BOT_SUPERVISOR_MODE`

A API decide quem gerencia os bots via env var `BOT_SUPERVISOR_MODE`:

- **`inline`** (default histórico): a API faz `fork()` dos workers ela mesma.
  Deploy da API derruba todas as sessões.
- **`remote`**: a API só envia comandos via BullMQ no Redis; o app
  `bot-supervisor` faz `fork()` dos workers. Deploy da API **não** toca
  nas sessões.

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

Rollback: setar `BOT_SUPERVISOR_MODE=inline` + `pm2 restart api/api-staging`.
Janela ≤ 2min.

**Pré-requisito do modo `remote`:** Redis local em `REDIS_URL`
(`redis://127.0.0.1:6379/0` prod, `/1` staging). No modo `inline` o
Redis é opcional.

### Arquivos do supervisor (não confundir)

- `src/supervisor/protocol.js` — contrato (nomes de filas, eventos,
  timeouts). [PROTECTED_CORE]. Mudança breaking exige bumping de
  `PROTOCOL_VERSION`.
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
AUTH_INFO_DIR=/home/deploy/wabot-staging-shared/auth_info
BOT_LOG_DIR=/home/deploy/wabot-staging-shared/logs
AUTO_START_WHATSAPP_SESSIONS=true
DASHBOARD_URL=http://178.105.54.0:3006
API_URL=http://178.105.54.0:3006
# BOT_SUPERVISOR_MODE: 'inline' (default) ou 'remote'. Em 'remote', a API
# delega ciclo de vida dos bots ao app PM2 bot-supervisor-staging via Redis.
BOT_SUPERVISOR_MODE=inline
REDIS_URL=redis://127.0.0.1:6379/1
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
# Ver seção "Processos PM2" para detalhes sobre cutover inline -> remote.
BOT_SUPERVISOR_MODE=inline
REDIS_URL=redis://127.0.0.1:6379/0
```

### `~/wabot/dashboard/.env.local`
```
PORT=3000
NEXT_PUBLIC_FORCE_SAME_ORIGIN_API=true
```

Sem `JWT_SECRET` a API mata o processo no boot
(`src/api/server.js:201-204`), o que faz o smoke test
`assert_login_api_not_next_404` falhar e o deploy automático ficar vermelho.

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

## Agregação de duplicatas em `MessageLog.dedupHits`

Em vez de criar N linhas de `skip:dedup_recent_link` quando o mesmo
link é republicado pela fonte ao longo de 2h, agregamos no contador
`dedupHits` da linha mais recente do mesmo `(userId, destGroup,
convertedUrl)`. Implementado em `registerDedupBlock()` no `bot-worker.js`:

1. Procura a linha mais recente dentro de `linkDedupWindowMs` (default 2h,
   override via env `DEDUP_LINK_WINDOW_MS`)
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
| `skip:dedup_recent_link`         | DEDUP              | Link já enviado nas últimas 2h (per-dest)                    |
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
envio de imagem em staging: o payload do job carrega `image.buffer`
(Buffer real); BullMQ persiste via `JSON.stringify`, e Buffer vira
`{type:'Buffer', data:[...]}` na deserialização. O Baileys não
reconhece como mídia e a oferta sai **sem foto**. Para reabilitar
BullMQ como default sem regressão, antes mover a construção da payload
(fetch + normalize de imagem + `buildMonitoredMessagePayload`) para
dentro do worker pós-dequeue, persistindo só a "receita" (URL, flags,
texto) na fila. Até lá: para forçar persistência, setar
`QUEUE_BACKEND=bullmq` explicitamente — ciente de que ofertas com
imagem podem sair só como texto.

**DLQ:** quando `processSendJob` lança após esgotar `SEND_MAX_ATTEMPTS`,
o BullMQ marca o job como `failed`. Um listener no Worker copia o payload
para a DLQ (`<queueName>-dlq`) com `removeOnComplete: false` —
**jobs ficam indefinidamente** até ação manual. Inspeção via:

- `GET  /api/admin/send-dlq/:userId?limit=100` — lista jobs
- `POST /api/admin/send-dlq/:userId/retry/:jobId` — reenfileira na principal
- `DEL  /api/admin/send-dlq/:userId/job/:jobId` — descarta
- `POST /api/admin/send-dlq/:userId/purge` — drena toda a DLQ

Helpers programáticos: `src/jobs/sendDlq.js`. Todas as ações destrutivas
gravam `AdminAuditLog`.

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

### 8. `prisma migrate deploy` quebra com SQLITE_BUSY se API/supervisor estão rodando

Migrations DML (INSERT/UPDATE) convivem com o WAL ligado; **DDL** (ALTER
TABLE, CREATE INDEX) exige lock exclusivo do SQLite. Enquanto
`api-staging` ou `bot-supervisor-staging` (ou os equivalentes de prod)
seguram conexões abertas no `.db`, qualquer ALTER falha com
`Error: SQLite database error / database is locked`. Os 5s de
`busy_timeout` não bastam — a app nunca solta.

Sintoma observado no autodeploy do PR #651 (2026-05-27): `prisma migrate
deploy` falhou 5x consecutivas dentro do retry loop, deployment abortou.

Correção aplicada nos dois scripts (`deploy_safe_staging.sh` e
`deploy_safe_dashboard.sh`): quando `prisma migrate status` reporta
pendências, o script faz `pm2 stop` na API e no bot-supervisor
**antes** do migrate, e religa logo após (ou no erro). Janela de
indisponibilidade ~10-30s, mas só ocorre em deploy com migration nova
— raro e planejado. Sem migration pendente, o passo é pulado e
sessões/API seguem intocadas.

Se um deploy futuro falhar com `database is locked` mesmo após esse
fix: confirmar que os apps PM2 estão sendo de fato parados (`pm2
describe <app>` retorna ok antes do stop?). Para destravar manualmente
em emergência: `pm2 stop api-staging bot-supervisor-staging && cd
~/wabot-staging && npx prisma migrate deploy && pm2 restart
api-staging bot-supervisor-staging --update-env`.

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

## Triagem de novas demandas (implementar agora vs. backlog)

- **Sempre que surgir uma nova demanda**, pergunte à usuária se vamos
  implementá-la agora ou se ela prefere adicioná-la como issue ao backlog.
- Se a escolha for **backlog**, releia este `AGENTS.md` para entender o
  padrão de como as issues devem ser criadas (fluxo `feature → develop →
  main`, convenções de processos, portas, taxonomias e demais regras
  canônicas) antes de redigir a issue.

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
