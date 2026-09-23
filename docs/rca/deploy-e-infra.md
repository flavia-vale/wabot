# deploy-e-infra — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

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
   ecosystem.config.cjs --only api-staging` (pegadinha #1 — delete+start,
   não `restart --update-env`). Confirmar pelo dashboard staging que QR,
   status e envio funcionam end-to-end.
5. Teste de aceitação: `pm2 restart api-staging` enquanto há sessão
   conectada — sessão **deve continuar conectada** (esse é o ponto).
6. Repetir para produção (`bot-supervisor` + ajustar `.env` + delete/start `api`).

Rollback: setar `BOT_SUPERVISOR_MODE=inline` no `.env` + delete+start da API
(pegadinha #1; `idem` `api` em prod, `pm2 save` ao final). Confirme no log
que **não** aparece `Manager em modo REMOTE`. Janela ≤ 2min.

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

### Aviso "código novo não carregado pelos bots" (RCA 2026-08 — não regredir)

Em `remote`, o deploy reinicia a `api` mas **não** o `bot-supervisor` — de
propósito, para não derrubar as sessões. O preço é que **toda correção em
`bot-worker.js` ou no pipeline de mensagem (`messageProcessor.js`, `core/*`)
chega ao disco do VPS e continua SEM VALER**, porque os workers em execução
seguem com o módulo antigo em memória. Isso era **totalmente silencioso**: os
três fixes de assinatura de grupo de origem (#1383, #1389, #1391) foram para
`main`, o deploy ficou verde, e mesmo assim os 11 bot-workers de produção
rodavam código de 4 dias antes — a cliente seguia recebendo a assinatura e não
havia aviso em lugar nenhum. Foi descoberto só porque a cliente reclamou pela
terceira vez.

Como o aviso funciona:

- O supervisor publica o próprio boot no Redis (`SUPERVISOR_BOOTED_AT_KEY`,
  chave **separada** do heartbeat — o heartbeat é lido como `Boolean(value)`
  por `isSupervisorAlive` e mudar o formato dele arriscaria a liveness).
  Aditivo: **não** exige bump de `PROTOCOL_VERSION`.
- `src/ops/codeVersion.js` calcula "quando o código mudou" pelo **mtime mais
  recente dentro de `src/`** (o `git pull` do deploy só reescreve arquivo
  alterado). Ignora `node_modules`/`test` de propósito — `npm ci` mexe em
  `node_modules` em todo deploy e criaria alarme falso.
- `src/ops/staleWorkerCodeGuard.js` (`shouldWarnStaleWorkerCode`) é puro/
  testável e compara os dois, com folga de 60s para o deploy normal (pull e
  restart quase simultâneos). A API roda a checagem ~20s após o boot
  (`STALE_CODE_CHECK_DELAY_MS`), loga `error` e emite
  `AnalyticsEvent('ops_stale_worker_code')` (allowlist em `src/analytics.js`).

**Só avisa — nunca reinicia nada.** Reiniciar o supervisor reconecta TODAS as
sessões WhatsApp de uma vez; isso é decisão humana e continua valendo a regra
de anunciar/agendar antes. Fail-safe em todos os caminhos: sem dado confiável
(supervisor fora do ar, modo `inline`, chave ausente) **não** avisa — alarme
falso recorrente treina a pessoa a ignorar justamente este alerta.

**Desde 2026-08-26 o deploy faz isso sozinho — quando é o caso.** Os dois
scripts (`deploy_safe_dashboard.sh` e `deploy_safe_staging.sh`) guardam o commit
ANTES do pull, comparam com o de depois e, se os arquivos que entraram batem em
`WORKER_CODE_PATHS_RE` (`src/bot-worker.js`, `src/supervisor/`, `src/core/`,
`src/converters/`, `src/monitored*.js`, `src/messageProcessor.js`,
`src/manager.js`, `src/db.js`, `src/logger.js`, `src/analytics.js`,
`src/errorTaxonomy.js`, `src/observability/`, `src/billing/`,
`prisma/schema.prisma`, `package-lock.json`), reiniciam o supervisor ao final do
deploy. Deploy que mexe só em dashboard/rotas/docs/testes **não** reinicia nada e
as sessões seguem intactas.

`RESTART_SUPERVISOR` aceita `auto` (default), `1` (sempre reinicia) e `0` (nunca
— o fix fica dormente até alguém reiniciar à mão). A lista de caminhos é
deliberadamente conservadora: reiniciar o supervisor reconecta TODAS as sessões,
então caminho novo só entra ali se o processo do worker de fato o carregar.
Guardas: `test/deploy-safe-dashboard.test.js`, `test/deploy-safe-staging.test.js`.

Aplicar o código novo nos bots à mão (quando o deploy não rodou, ou com
`RESTART_SUPERVISOR=0`):

```bash
cd ~/wabot && pm2 restart bot-supervisor --update-env && pm2 save
# confere que os workers renasceram (etime baixo):
ps -eo pid,lstart,etime,cmd | grep "wabot/src/bot-worker" | grep -v staging | grep -v grep
```

Teste: `test/ops-stale-worker-code-guard.test.js` (puro, sem Redis/DB).

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
# WA_WEB_VERSION: pin manual da versão do WhatsApp Web anunciada no handshake.
# Ausente = resolve sozinho (registro público -> Baileys -> cache). Só preencher
# quando o WhatsApp cortar a versão vigente e todas as sessões caírem com 405 —
# ver seção "failure 405 derrubando TODAS as sessões".
# WA_WEB_VERSION=2.3000.1044015310
# Converte links de cupom/voucher (Shopee, Amazon, ML) com comissão nossa em vez
# de removê-los. Resolve o shortLink afiliado para a landing web segura
# (/m/cupom-de-desconto) evitando "Oops! Seu navegador não é mais aceito!".
COUPON_LINK_CONVERT=true
# Banner de marca "CUPOM + loja" no card de preview (specs/008-coupon-brand-banner).
# Default OFF (ausente = desligado). Ligado aqui em staging para validação —
# gatilho passa pela blindagem tripla em couponBrandCardPolicy.js
# (shouldUseCouponBrandCard): só aparece com linkKind==='coupon' E sinal de
# texto de cupom/vitrine E URL sem ASIN/MLB. Produto por short link continua
# saindo com foto (não regride #1205/#1208).
COUPON_BRAND_CARD_ENABLED=true
# Encurta o link da SHEIN (oneLink) via API de afiliado. Default LIGADO (ausente
# = liga); só o valor exatamente 'false' desliga ('0'/'off'/'no' não têm efeito).
# Desligar não para nenhuma oferta — só volta a publicar o link longo da SHEIN.
# Aplicar exige pm2 delete + start (pegadinha #1). Ver seção "SHEIN: encurtamento
# de link".
# SHEIN_SHORTLINK_ENABLED=false
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
# Para onde vão os avisos internos de falha de pagamento (ver "Plano B da
# cobrança"). Ausente = flaviaroberta.1496@gmail.com. ADMIN_ALERT_ENABLED=false
# desliga; só o valor exatamente 'false' tem efeito.
# ADMIN_ALERT_EMAIL=flaviaroberta.1496@gmail.com
# WA_WEB_VERSION: pin manual da versão do WhatsApp Web (botão de emergência do
# incidente 405 — ver seção própria). Ausente = resolve sozinho.
# WA_WEB_VERSION=2.3000.1044015310
# Converte links de cupom/voucher (Shopee, Amazon, ML) com comissão nossa em vez
# de removê-los. Resolve o shortLink afiliado para a landing web segura
# (/m/cupom-de-desconto) evitando "Oops! Seu navegador não é mais aceito!".
COUPON_LINK_CONVERT=true
# Banner de marca "CUPOM + loja" no card de preview (specs/008-coupon-brand-banner).
# Permanece AUSENTE/OFF em produção até validação explícita em staging (US1/US2/US3
# completas, blindagem tripla contra #1205/#1208 confirmada). Não setar aqui sem OK.
# Encurta o link da SHEIN (oneLink) via API de afiliado. Default LIGADO (ausente
# = liga); só o valor exatamente 'false' desliga ('0'/'off'/'no' não têm efeito).
# Desligar não para nenhuma oferta — só volta a publicar o link longo da SHEIN.
# Aplicar exige pm2 delete + start (pegadinha #1). Ver seção "SHEIN: encurtamento
# de link".
# SHEIN_SHORTLINK_ENABLED=false
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

## Cópia velha na borda reprovando deploy bom (RCA 2026-09-10 — não regredir)

O deploy de produção ficou vermelho duas vezes seguidas com a home devolvendo
**404**. O deploy tinha subido inteiro: build íntegro, PM2 no ar, `/login`,
`/admin` e `/painel` em 200, todos os arquivos de JS e CSS em 200. O que
reprovava era só a home, e só através da Cloudflare:

```
HTTP/2 404          cf-cache-status: HIT        age: 13522
cache-control: max-age=14400, s-maxage=31536000
```

Pedindo a mesma home com um parâmetro descartável na ponta (o que obriga a
borda a buscar do servidor) vinham **200 e 160 KB de página real**. Ou seja: o
site estava de pé; a Cloudflare é que guardava um 404 antigo — a home devolveu
404 na janela de restart do Next de um deploy anterior, e a resposta ficou
guardada com validade de um ano.

**O ciclo que fechava sozinho:** o smoke roda DENTRO do passo de SSH (etapa 9/9
de `deploy_safe_dashboard.sh`) e lê a home através da Cloudflare; a limpeza do
cache é um passo POSTERIOR, que só rodava com o deploy verde. Cópia velha
reprova o deploy → deploy reprovado não limpa o cache → a cópia velha continua
lá. Sem alguém limpar na mão pelo painel, todo deploy seguinte nascia vermelho
e **a home ficava 404 para quem visitava o site** — a página principal do
produto, e o destino da maior parte das buscas do Google.

Dois consertos:

- **`always()` na condição do passo "Purgar cache da Cloudflare"**
  (`.github/workflows/deploy.yml`). Ele passa a rodar mesmo com o passo
  anterior vermelho, e continua só em `main`. **Limpar o cache nunca piora
  nada**: a borda só volta a buscar do servidor, que é a fonte da verdade.
- **`diagnose_edge_cache`** em `scripts/smoke_mobile_dashboard.sh`: quando a
  falha vem com `cf-cache-status: HIT`, o script refaz o pedido furando o cache
  e diz em qual dos dois casos estamos. "O site está quebrado" e "a borda
  guardou uma resposta velha" chegavam como o MESMO vermelho e pedem ações
  opostas.

**Não regredir:** o diagnóstico **não muda o veredito** — resposta velha na
borda é problema de verdade para quem visita, então o smoke continua
reprovando; o que muda é o deploy seguinte já nascer com o cache limpo. E não
voltar a condicionar a limpeza do cache ao sucesso do deploy: é literalmente o
que fecha o ciclo. Teste: `test/deploy-smoke-cache-da-borda.test.js` (sobe um
servidor local que imita a borda e cobre os dois casos, mais a guarda
estrutural do `always()` no YAML).

⚠️ **Enquanto a home estiver 404 na borda, o conserto no código não basta** —
ele só age no próximo deploy. Para destravar agora: painel da Cloudflare →
Caching → Purge Everything. Confirmar com:

```bash
curl -s -o /dev/null -D - https://espelhagrupos.com.br/ | grep -iE "^HTTP/2|cf-cache-status|^age"
```

## Minutos do GitHub Actions (repo PRIVADO — 2.000 min/mês no plano gratuito)

Repo privado consome minutos. Medição de 2026-09-02 (amostra de 30 runs em 12h)
apontava **~3.450 min/mês** — acima do teto. Onde estava o desperdício e o que
foi feito (não regredir sem refazer a conta):

| Repetição encontrada | Correção |
|---|---|
| `deploy.yml` e `backend-lint.yml` disparavam em `push` **e** `pull_request` nas MESMAS branches. Como o fluxo canônico é PR `develop → main`, todo push em develop com a PR aberta rodava tudo **2x no mesmo commit** | `backend-lint` só em `pull_request`; `pull_request` do `deploy.yml` limitado a `branches: [develop]` |
| No `push`, o `deploy.yml` gastava ~1m50 com npm ci ×2 + lint + `next build` + smoke **no runner**, e o `deploy_safe_*.sh` refazia tudo no VPS logo em seguida | steps do gate ganharam `if: github.event_name == 'pull_request'` |
| `cancel-in-progress: false` fazia PR com N commits enfileirar N builds completos | `cancel-in-progress` agora é `true` em `pull_request` (e continua `false` em `push` — **nunca** cancelar deploy no meio do SSH) |
| Push só de documentação disparava deploy completo | `paths-ignore` (`docs/**`, `specs/**`, `*.md`) **só no `push`** |

**Três armadilhas nessa configuração:**

1. **`paths-ignore` não pode usar `**.md`.** `dashboard/public/pricing.md` e
   `dashboard/public/materiais/*.md` são servidos publicamente e precisam subir.
   `*.md` casa só a raiz do repo — é o que está lá, de propósito.
2. **`paths-ignore` fica só no `push`.** Check pulado numa PR conta como
   pendente para branch protection; aplicá-lo ao `pull_request` travaria PRs de
   documentação para sempre.
3. **Nada depois do SSH pode precisar de `node_modules`.** Sem o `npm ci` no
   caminho de push, os steps finais têm que rodar com Node pelado —
   `notify-indexnow.mjs` só importa `dashboard/lib/*.mjs`/`.js` puros. Passo
   novo ali que exija dependência precisa reativar o `npm ci` (com `if`
   próprio), não remover o gate.

**O que se perde com o gate PR-only:** o aviso antecipado antes de tocar o VPS.
Quem reprova build quebrado num push passa a ser o próprio `deploy_safe_*.sh`,
que aborta em qualquer falha antes do restart do PM2. A PR continua com o gate
completo (lint + build + smoke + `quality:gate` + `no-undef`).

## IndexNow — notificação automática de URLs ao Bing (2026-07, canônico)

A cada deploy de **produção** (`main`), o step "Notificar IndexNow (produção)"
em `.github/workflows/deploy.yml` (logo após a purga da Cloudflare) roda
`node scripts/notify-indexnow.mjs`, que faz `POST` para
`https://api.indexnow.org/indexnow` com a lista completa de URLs indexáveis
(`getIndexableSeoRoutes()` de `dashboard/lib/seo-registry.mjs` — a MESMA fonte
usada pelo `sitemap.xml`). Bing, Yandex e DuckDuckGo consomem o protocolo
IndexNow; ChatGPT/Copilot puxam do índice do Bing, então a automação também
alimenta essas IAs indiretamente.

- **Chave de verificação NÃO é segredo** — o IndexNow exige um arquivo
  público `https://espelhagrupos.com.br/<chave>.txt` contendo a própria
  chave, para provar posse do domínio. Por ser público por design, a chave
  fica hardcoded no próprio `scripts/notify-indexnow.mjs` (constante
  `INDEXNOW_KEY`) e replicada no arquivo estático
  `dashboard/public/<chave>.txt` — **os dois valores têm que ser idênticos**.
  Não precisa de GitHub secret.
- **Só roda em `main`** (`github.ref == 'refs/heads/main'`, mesma guarda do
  purge da Cloudflare) — staging não é indexado, não faz sentido notificar.
- **Não bloqueia o deploy**: a etapa de SSH já rodou antes desse step; falha
  aqui só marca o step como vermelho no Actions (3 tentativas com backoff,
  igual ao padrão do purge da Cloudflare), sem exigir ação manual — o
  IndexNow tem TTL curto e o próximo deploy tenta de novo.
- **Google NÃO usa IndexNow** (não implementa o protocolo) — Google segue
  via sitemap + rastreamento natural, fora do escopo deste script. Não tentar
  usar a Google Indexing API para páginas comuns: ela é restrita a
  `JobPosting`/`BroadcastEvent` nos termos de uso do Google.
- **Trocar a chave** (rotação): gerar novo valor
  (`node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`),
  criar o novo `dashboard/public/<chave-nova>.txt`, atualizar
  `INDEXNOW_KEY` em `notify-indexnow.mjs` e remover o `.txt` antigo no mesmo
  PR — os dois arquivos nunca podem divergir.
- ⚠️ **O `.txt` deve conter APENAS a chave, sem quebra de linha no fim.**
- **Rotacionar a chave não é de graça:** o IndexNow amarra o host à chave que
  validou. Trocar por uma chave nova pode passar a devolver
  `403 UserForbiddedToAccessSite` mesmo com o `.txt` novo servindo 200. Não
  rotacione sem necessidade real, e valide com um POST manual antes de mergear.

### RCA 2026-07-31 — deploy de produção vermelho por causa do IndexNow

Dois commits com **1 minuto de diferença** (`c0201487` e `5bee4a71`)
implementaram o IndexNow em paralelo e deixaram **dois** arquivos de chave em
`dashboard/public/`. O script passou a apontar para a chave do segundo commit
(`76ef5ca2…`, com `\n` no fim, 33 bytes), que o IndexNow **rejeitava com 403
`UserForbiddedToAccessSite`** — enquanto a chave do primeiro (`fa4326c7…`, 32
bytes, sem `\n`) respondia **202**. Os dois `.txt` serviam 200 em produção, então
o problema não era acessibilidade: era qual chave o IndexNow tinha validado.

Resultado: **todo deploy de `develop` → `main` aparecia como FALHO** desde
27/07, apesar de o deploy em si ter concluído (a etapa de SSH roda antes deste
step). O script dizia "não bloqueia o deploy" e mesmo assim fazia `exit 1`, sem
`continue-on-error` no workflow — a mensagem contradizia o comportamento.

Correções: script aponta para a chave que funciona, `.txt` órfão removido,
`continue-on-error: true` no step (o purge da Cloudflare **não** ganhou o mesmo
tratamento — cache velho é problema do cliente e deve reprovar o workflow) e
mensagem de erro com o passo a passo de diagnóstico. Guarda de regressão sem
rede em `test/indexnow-key.test.js`: exige exatamente um `.txt`, que o nome bata
com `INDEXNOW_KEY` e que o conteúdo não tenha quebra de linha.

## A marca d'água não saía porque os BOTS ESTAVAM COM CÓDIGO VELHO (RCA 2026-08-31 — não regredir)

Cliente configurou o destino em **"Preview com marca d'água"** e as ofertas
continuaram saindo sem marca. O código da composição estava certo, testado e em
`main` desde 30/08. **O que não estava era rodando.**

**Causa raiz — a detecção de "código dos bots mudou" nunca funcionou em
produção.** O auto-restart do supervisor (2026-08-26) decide comparando o commit
ANTES e DEPOIS do sync, dentro de `deploy_safe_dashboard.sh`. Só que o passo
"Deploy via SSH" do `.github/workflows/deploy.yml` faz
`git fetch/checkout/reset --hard origin/main` **antes** de chamar o script:
quando o script media `git rev-parse HEAD`, o clone **já estava no commit novo**,
os dois lados davam o mesmo valor, o diff saía vazio e a decisão virava sempre
"nenhuma mudança em código dos bots".

Evidência nos logs do próprio deploy (run 2199, 30/08 21:22, produção):

```
HEAD is now at 5534fe86 Merge pull request #1524      ← workflow, ANTES do script
[1/9] Sync branch main
HEAD is now at 5534fe86 ...                            ← mesmo commit
  Nenhuma mudança em código dos bots — bot-supervisor preservado, sessões intactas.
│ 285 │ bot-supervisor │ ... │ uptime 6h │             ← não reiniciou
```

E, no MESMO commit, meia hora antes, em staging (run 2197) — cujo workflow
**não** tem o reset inline:

```
  Código dos bots mudou neste deploy — supervisor será reiniciado ao final.
  Reiniciando bot-supervisor-staging para os bots carregarem o código novo
```

É por isso que a marca no card funcionou em staging e não em produção: em
produção o `bot-worker.js` que os workers tinham em memória sequer conhecia o
parâmetro `watermark` de `buildManualLinkPreview`.

**Consequência maior que a marca d'água:** desde 26/08, **nenhum** fix em
`bot-worker.js`, `src/core/`, `src/converters/` etc. passou a valer em produção
por conta do deploy. Ao investigar qualquer relato de "corrigimos e a cliente
continua vendo o problema", **confira primeiro o uptime do `bot-supervisor`
contra a data do fix** — antes de procurar defeito no código.

**Conserto, em duas camadas:**

1. O workflow captura `REVISION_BEFORE_DEPLOY` **antes** do reset inline e passa
   ao script, que passa a usá-lo em vez de medir HEAD tarde demais. **Não mover
   essa captura para depois do reset** — é literalmente o bug.
2. Rede de segurança independente do git (`workers_running_stale_code`, nos dois
   scripts): compara o mtime dos arquivos que o worker carrega
   (`WORKER_CODE_PATHS_RE`, nunca `src/` inteiro — senão todo deploy de rota da
   API reconectaria as sessões) com o horário de início do processo do
   supervisor. Código no disco mais novo que o processo → reinicia. Isso cobre
   sync feito fora do script e deploy anterior que ficou dormente. Fail-safe:
   sem conseguir medir os dois lados, **não** reinicia (preservar sessão é o
   default seguro). Com `RESTART_SUPERVISOR=0` a preservação continua valendo,
   mas o deploy passa a **dizer em alto e bom som** que as correções não estão
   valendo e qual comando aplica.

⚠️ O primeiro deploy de produção com este conserto **vai reiniciar o
bot-supervisor** — é o comportamento prometido desde 26/08 e nunca cumprido — e
isso **reconecta todas as sessões WhatsApp de uma vez**. Anunciar antes.

O aviso `ops_stale_worker_code` (guard na API, RCA 2026-08) provavelmente vinha
disparando esse tempo todo: ele mora só no log da API e num `AnalyticsEvent`, e
ninguém lê. Aviso que não chega a uma pessoa não conta como aviso.

Testes: `test/deploy-supervisor-restart-detection.test.js` — roda a função de
verdade extraída do script num repositório git temporário e **reproduz o bug**
(sem o commit anterior a decisão é "preserva"), além de travar a ordem
captura-antes-do-reset no YAML do workflow.

### Achado secundário da mesma investigação: a marca podia sair invisível

Medido, não deduzido: texto **branco a 50% sobre foto branca não altera um único
pixel** — o desvio-padrão da imagem marcada é idêntico ao da original. Foto
oficial de loja (Amazon/Mercado Livre/Shopee) é fundo branco liso por padrão de
catálogo, então o card era justamente onde isso apareceria.

**Isto NÃO era a causa do relato acima** (a marca nem chegava a ser composta),
mas é um defeito real e foi corrigido junto: o texto ganhou **contorno na cor
oposta** (`WATERMARK_STROKE_COLORS`, `src/core/destinationWatermark.js`), fino e
mais transparente que o preenchimento. Não empurrar isso para a cliente como
"escolha a outra cor": a cor é gosto; marca que some conforme a foto é defeito
nosso. Guarda **funcional** (renderiza imagem e mede a variação de pixels):
`test/watermark-contraste.test.js`.

Junto, toda perda de marca ganhou nome próprio no log: os três caminhos (card,
foto do espelhamento, receita de fila/automáticas) são best-effort de propósito
e eram mudos — `renderDestinationWatermark` devolve `watermarkApplied:false` em
silêncio com foto pequena demais, e card sem foto cai no preview automático do
WhatsApp, que mostra a foto da loja sem marca. Agora `reportWatermarkMissing`
(bot-worker.js) loga `warn` + emite `ops_watermark_missing` com a etapa.

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

### 6. Nome do arquivo do banco em prod é `prod.db` (não `dev.db`)

Risco: alguém trocar `DATABASE_URL` para um caminho que resolve num arquivo
vazio de 0 bytes sem perceber. Login quebra, sessões somem, parece perda
total. Antes de qualquer mudança de `DATABASE_URL`, sempre conferir
`ls -la prisma/*.db` e `sqlite3 <db> "SELECT COUNT(*) FROM User"`.

### 7. Cron de backup deve chamar script versionado

`scripts/backup_prod.sh` (canônico, no repo, WAL-safe via `sqlite3 .backup`,
`AUTH_INFO_DIR` correto) é o único script que o cron de prod deve chamar.
Se o cron de prod chamar um script, **confirmar que está versionado**
(`git ls-files scripts/<nome>`) — scripts untracked no diretório do clone
sobrevivem a deploys mas escapam de qualquer code review, e bugs neles
nunca são corrigidos via PR.

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

**Caso especial que o fix acima NÃO cobre — bot-supervisor em modo `remote`
(RCA 2026-07, aconteceu 2x seguidas em produção, 2026-07-14 e 2026-07-15):**
quando `BOT_SUPERVISOR_MODE=remote`, o `bot-supervisor` é preservado por
default durante a migration (senão derruba os bot-workers filhos — ver
comentário no topo dos dois scripts). Só que aí o lock **não é transitório**:
os workers escrevem no SQLite continuamente, então nunca existe uma janela
livre para o DDL, e as 5 tentativas de retry sempre esgotam. Antes disso
exigia disparo manual do `workflow_dispatch` com
`stop_supervisor_for_migration=true`. Agora os dois scripts se
auto-corrigem: se as 5 tentativas preservando o supervisor esgotarem, eles
escalam sozinhos — param o `bot-supervisor` (fecha workers + Prisma via
`shutdown()`, não é kill duro), tentam de novo (resolve rápido) e religam ao
final. **Isso reconecta TODAS as sessões WhatsApp automaticamente, sem aviso
prévio, toda vez que uma migration de schema for mergeada em `main`/`develop`
enquanto o modo efetivo for `remote`.** Rollback sem redeploy: env
`AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION=0` (no `.env` ou inline no SSH)
volta ao comportamento antigo (fail-safe + runbook manual, exige disparo do
workflow). Testes:
`test/deploy-safe-dashboard.test.js`, `test/deploy-safe-staging.test.js`.

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

### 10. Dois PRs desenvolvidos em paralelo sobre o mesmo recurso podem mergear SEM conflito e ainda assim quebrar `develop` (RCA 2026-08-28)

**Sintoma:** dois PRs implementando a mesma feature de forma independente
(imagem/marca d'água por destino) foram mergeados em `develop` em sequência,
um em cima do outro. Como os dois adicionavam blocos de código quase idênticos
em regiões PRÓXIMAS mas não idênticas dos mesmos arquivos, o merge automático
do GitHub **não viu conflito textual nenhum** — simplesmente concatenou as
duas versões. Isso aconteceu **duas vezes seguidas** no mesmo dia: uma 3ª
sessão, trabalhando em paralelo num incidente não relacionado, tentou
consertar o mesmo problema de novo por conta própria e a correção dela também
colidiu (dessa vez numa fixture de teste, não no código de produção).

Dois efeitos, achados só depois do merge:

1. `src/core/imageModePolicy.js` ficou com **duas declarações** do mesmo
   `const`/`function` — `SyntaxError: Identifier already declared`. O lint
   (`backend-lint.yml`, job `no-undef`) pegou isso e reprovou a PR — **mas a
   PR foi mergeada mesmo assim**, com o check vermelho.
2. **Duas migrations diferentes** (pastas com timestamps diferentes, sem
   colisão de nome) faziam o **mesmo** `ALTER TABLE ... ADD COLUMN`. A
   primeira já tinha sido aplicada com sucesso no banco de staging durante o
   deploy do 1º PR; quando o deploy do 2º PR rodou logo depois, a segunda
   falhou com `duplicate column name` e deixou o banco de staging em
   **estado de migration falha (P3009)** — todo deploy seguinte continuou
   falhando até alguém rodar `prisma migrate resolve --rolled-back
   <migration>` manualmente no VPS. O deploy também tinha parado
   `api-staging`/`bot-supervisor-staging` pra rodar a migration e nunca
   religou os dois, por causa do erro — staging ficou fora do ar até a
   correção manual.

**Por que ninguém viu antes de mergear:** cada PR, sozinho, passava em todos
os testes — o problema só existe na COMBINAÇÃO dos dois. `npm test` local (ou
até o CI) rodando na branch de um PR isolado nunca vê o código do outro PR
que será mergeado antes ou depois dele.

**Duas camadas de proteção, não uma só:**

- **Guarda de código** (não evita a causa, mas pega o sintoma cedo):
  `test/migrations-no-duplicate-column.test.js` varre TODAS as migrations e
  falha se a mesma tabela+coluna for adicionada em mais de uma — é
  exatamente o sinal que só aparece quando duas migrations independentes
  colidem. Mesmo espírito de `test/api-routes-no-duplicate-registration.test.js`
  (RCA do mesmo dia, rota duplicada derrubando o boot da API). SyntaxError de
  identificador duplicado já era pego pelo ESLint (`no-undef` do
  `backend-lint.yml`) — o problema nunca foi falta de detecção.
- **Processo** (a causa raiz de verdade — nenhuma das duas PRs deveria ter
  sido mergeada com o check vermelho): **branch protection em `develop` e
  `main` exigindo os checks `quality` (quality-gate.yml) e `no-undef`
  (backend-lint.yml) verdes antes de permitir merge.** Sem isso, um PR com
  lint quebrado pode ser mergeado manualmente e ninguém percebe até o deploy
  falhar em produção/staging. Configurar em GitHub → Settings → Branches →
  Branch protection rules → (develop e main) → "Require status checks to pass
  before merging" → marcar `quality` e `no-undef`. Isso **não está
  configurado no repositório hoje** — nenhum agente de IA tem acesso para
  configurar isso sozinho (é uma permissão de admin do repo), então é ação
  manual da dona do produto.
- **Antes de abrir uma branch nova para uma feature que outra sessão/PR pode
  estar tocando ao mesmo tempo**, checar PRs abertos/recém-mergeados que
  tocam os mesmos arquivos (`gh pr list` / GitHub UI) antes de duplicar
  trabalho. E depois de QUALQUER merge em `develop` (seu ou de outra sessão),
  rodar `npm test` + lint + `npm run arch:check` no `develop` atualizado
  ANTES de começar a construir em cima dele — um merge "limpo" pelo GitHub
  não significa `develop` saudável.

Teste: `test/migrations-no-duplicate-column.test.js`.

#### Aconteceu de novo, agora numa TELA (RCA 2026-09-13 — produção fora do ar)

`/painel/filas` foi para produção abrindo **em branco**, com
`Uncaught ReferenceError: findDestinationsWithoutQueue is not defined` no
console. Servidor 200, todos os chunks 200 — a quebra era no navegador.

Mesmo mecanismo da pegadinha #10, com um detalhe novo: **o conflito estava
entre o USO e o IMPORT, em regiões distantes do mesmo arquivo.**

| commit | import | uso |
|---|---|---|
| `08e8695` (PR #1641, aviso de grupo fora das filas) | ✅ | ✅ |
| `40f6764` (PR #1644, Instagram — branch tirada ANTES da #1641) | ❌ | ❌ |
| `2b47f6f` (merge de `develop` na branch do Instagram) | ❌ | **✅** |

O merge pegou o uso de um lado e o bloco de imports do outro. Zero conflito
textual, build passou (bundler não resolve identificador livre em tempo de
build), e nenhum teste renderiza essa página.

**Por que nada pegou:**
- `eslint.config.js` **ignorava `dashboard/**` de propósito** — o comentário
  dizia que "a CI só lintava o dashboard". Só que o lint do Next **não roda
  `no-undef`**.
- O gate do dashboard em `deploy.yml` roda só em `pull_request`, e a PR foi
  mergeada com esse check ainda em andamento.

**Correção:** o `no-undef` passou a cobrir `dashboard/app`, `dashboard/components`
e `dashboard/lib` (bloco próprio no `eslint.config.js`, com globais de
navegador), e o job da CI virou
`eslint@9 --no-inline-config src test dashboard/app dashboard/components dashboard/lib`.

⚠️ **`--no-inline-config` é obrigatório** nesse comando: as telas têm
`eslint-disable` de regras de plugin (`react-hooks/*`, `@next/next/*`) que não
existem nesta config pura (ela não importa nada, de propósito, para rodar com
`npx` sem `npm ci`) e virariam erro de "rule not found".

**Não regredir:** não voltar a pôr `dashboard/**` no `ignores`. A varredura do
dashboard inteiro no dia da correção achou **só** esse caso — o custo de manter
a rede ligada é um lint a mais por PR.

⚠️ E a lição de processo continua a MESMA e continua sem estar aplicada:
branch protection exigindo `quality` e `no-undef` verdes antes do merge. As
duas PRs desta história foram mergeadas com check em andamento.

## O deploy só recarrega os bots para os caminhos da lista (RCA 2026-09-16)

`WORKER_CODE_PATHS_RE` (nos dois scripts de deploy) decide se o
`bot-supervisor` é reiniciado — ou seja, se uma correção passa a valer nos
bots. Ela é escrita à mão, e medindo o que o worker DE FATO importa apareceram
**33 arquivos de fora**, entre eles `src/detector.js` (o fix dos links com
formatação do WhatsApp), `src/messageDedup.js`, `src/messageQueue.js` e
`src/messageLogSanitizer.js` (a correção do emoji cortado na chave de dedup).
Correção neles chegava ao disco do VPS e **não valia nos bots** — mesma família
do RCA 2026-08-31 ("a marca d'água não saía porque os bots estavam com código
velho"), só que pela lista em vez da medição do commit.

**Não regredir:** `test/deploy-worker-code-paths.test.js` calcula o que
`src/bot-worker.js` e `src/supervisor/index.js` importam (transitivo) e falha se
um arquivo novo não estiver nem na regex nem em `DELIBERADAMENTE_FORA`. Ele
também exige que os DOIS scripts usem a mesma lista — produção e staging
decidindo diferente faria staging validar um comportamento que produção não tem.

**A lista não é "tudo que o worker importa"**, é "o que, se ficar velho, muda o
comportamento do robô": cada caminho ali custa uma reconexão da frota inteira.
`src/email/` e os módulos que ele arrasta ficam DE FORA de propósito (o worker
só os carrega para o aviso interno de número repetido; texto velho ali não muda
nada para a cliente, e incluí-los faria toda edição de e-mail reconectar todo
mundo).
