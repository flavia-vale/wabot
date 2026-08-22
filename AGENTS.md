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

Aplicar o código novo nos bots (o passo manual que o aviso está cobrando):

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

## Credenciais de afiliado: linguagem e apagamento (canônico)

Cliente reportou desconforto em cadastrar o **SSID do Mercado Livre** ("expõe
muito os dados pessoais de quem utiliza"). Foi implementado um "modo sem
cookie" (guardar só a etiqueta) e **removido a pedido da própria cliente** após
teste: sem o código de acesso o link nunca sai curto, e a expectativa do produto
é "SSID cadastrado → link curto sempre". **Não reintroduzir sem pedido
explícito**: o código de acesso volta a ser obrigatório na validação
(`REQUIRED_FIELDS` + a exigência de portador `ssid`/`cookie` no ML), e o painel
não oferece opção de operar sem ele. Guarda de regressão em
`test/painel-ids-afiliada-privacy.test.js`.

**Resíduo em contas que chegaram a ligar a opção:** os campos de sessão foram
apagados no momento em que o modo foi ligado e **não há como recuperá-los** — a
cliente precisa colar um código novo (o painel já mostra "Falta preencher").
`sanitizeCredentialBody` descarta a flag `cookielessMode` em todo save, para o
resíduo não sobreviver, e `scripts/cleanup-cookieless-flag.mjs` limpa as linhas
antigas (dry-run por padrão, `--apply` para gravar; lista quem precisa
recadastrar). Rodar em staging e em produção (com backup antes) após o deploy.

O que ficou dessa rodada:

- `DELETE /credentials/:platform` — apaga a credencial da loja, invalida o cache
  de sondagem, recarrega a config do worker e é **idempotente** (200 +
  `deleted:false` quando não havia nada). Evento `credential_deleted` na
  allowlist de `src/analytics.js`. Botão "Apagar meus dados" no painel.
- Explicação "o que fazemos com esse código" junto do campo
  (`CookiePrivacyDetails`, renderizada nas lojas cujos campos têm
  `cookieField: true`) e FAQ pública em `/seguranca-credenciais-afiliado`.

### Linguagem para a usuária (obrigatório nesta superfície)

Nome técnico de campo **não pode chegar à tela**. Toda mensagem de credencial
passa por `friendlyFieldName` / `describeMissingCredentials`
(`src/credentialHealth.js`) — consumidas também por `missingCredentialMessage`
(`offerEngine.js`) e pelo `recordConversionIssue` do `bot-worker.js`, para a
cliente ler a MESMA frase em qualquer lugar. Vocabulário canônico: "etiqueta de
afiliada" (nunca "tag"), "código de acesso" (nunca "cookie de sessão"/"SSID"
solto), "link mais comprido" (nunca "?tag=/amzn.to/partner_id"), "venceu" (nunca
"sessão expirada"). `test/painel-linguagem-leiga.test.js` falha se jargão voltar
aos rótulos/dicas/avisos.

Correção de fato importante aplicada junto: o aviso de código vencido do ML
dizia "a geração de ofertas do ML está pausada" — **era falso** (o fallback
segue enviando) e assustava à toa.

**Não regredir:** não voltar a imprimir `missing` cru na tela; não voltar a
dizer que o envio "está pausado" quando o código vence (o fallback continua
enviando). Testes: `test/painel-ids-afiliada-privacy.test.js`,
`test/painel-linguagem-leiga.test.js`.

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
| `MP_FEE_PERCENT`             | Não (default `4.99`) | Percentual retido pelo Mercado Pago, descontado da **receita líquida** no painel Financeiro (`GET /finance/overview` → `mpFees30d`/`netRevenue30d`). Estimativa: 4,99% reproduz o caso observado (R$69 → R$65,56). O valor real varia por método/prazo — ajustar aqui se necessário. |
| `MP_FEE_FIXED_CENTS`         | Não (default `0`) | Taxa fixa em centavos por transação aprovada, somada às taxas MP no cálculo do líquido. |

**URL de webhook a registrar no painel MP:**
`https://espelhagrupos.com.br/api/payments/webhook`

Evento a marcar: `payment`.

**Aplicar as envs:** qualquer mudança nas envs do MP exige delete+start, não
`restart --update-env` (pegadinha #1):

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

### Aviso "o código de acesso da loja venceu" (não regredir)

Caso real (ago/2026): cliente ficou **uma semana** com o código de acesso do ML e
o da Amazon mortos (0 link curto em 7 dias, 100% plano B) sem ninguém perceber —
o aviso só existia dentro do painel, e as ofertas continuavam saindo, então nada
gritava. `src/credentialExpiry/` fecha esse buraco por e-mail.

- **Onde roda:** `setInterval` + `unref()` no boot da API
  (`startCredentialExpirySweep`, `src/api/server.js`), mesmo padrão de
  `startLeadNurtureSweep`. **Sem processo PM2 novo, sem worker, sem dependência
  nova** — cron dedicado foi descartado por custar um processo Node inteiro para
  rodar 1×/dia (política de memória).
- **Só `alive === false` dispara.** `alive === null` (rede, 403, 429, sondagem
  ocupada) é indeterminado e NUNCA vira aviso — mandaria a cliente recadastrar um
  código vivo. Não afrouxar isso.
- **Anti-spam:** no máximo 1 aviso por cliente/loja a cada
  `CREDENTIAL_EXPIRY_ALERT_COOLDOWN_DAYS` (default 7), persistido no
  `AnalyticsEvent('credential_expiry_alert_sent')` (sem tabela/migration nova). A
  janela é checada **antes de sondar** — quem já foi avisado não gera chamada
  extra à loja. Sem SMTP o evento não é gravado (a janela não queima à toa).
- **Nunca dizer que o envio parou — no ML e na Amazon.** O plano B continua
  enviando e a comissão continua sendo dela; a diferença é link mais comprido (e,
  no ML, cupom sem produto deixa de ser convertido). Vocabulário leigo
  obrigatório, com teste que falha se jargão voltar
  (`test/credential-expiry-alert.test.js`).
- **Shopee é o caso OPOSTO e tem e-mail próprio (`chave_shopee_recusada`).**
  Sem chave aceita, a conversão da Shopee falha inteira: a oferta vira
  `skip:no_valid_conversions`, **nada é publicado**, e as ofertas automáticas
  param junto (o dispatcher morre no `fetchOffers`). Mandar ali o texto
  tranquilizador de "continua saindo" seria mentira e faria a cliente ignorar
  prejuízo real — por isso `buildExpiryAlerts` (`credentialExpiry/message.js`)
  separa os dois e-mails, e há teste que falha se o texto da Shopee voltar a
  prometer que as ofertas continuam. **Não fundir os dois textos.**

### A recusa registrada nos envios também confirma (RCA 2026-08-20 — não regredir)

Duas clientes ficaram **4 e 7 dias** com o código de acesso do Mercado Livre
recusado — 1.697 e 1.042 recusas gravadas, **zero link curto** — sem receber um
aviso sequer. O gatilho do e-mail dependia SÓ da sondagem, e a sondagem do ML
passa por `withMercadoLivreCredentialLock`: com o bot usando a credencial o
tempo todo, ela volta `busy` → `alive:null` → nunca vira aviso (regra correta,
gatilho insuficiente). O robô sabia da recusa e o aviso não saía.

Agora `runCredentialExpirySweep` consulta **primeiro** `loadRefusalEvidence`
(`src/credentialExpiry/sweep.js`): recusas no `MessageLog` na janela
(`ml_ssid_expired`) versus ofertas que saíram com link curto (`meli.la`). Só é
conclusivo com **volume de recusa E nenhum link curto na janela** — um único
link curto derruba a conclusão (credencial viva com instabilidade pontual não
pode virar "seu código venceu"). Evidência conclusiva **pula a sondagem**, o que
também poupa rotação de credencial.

Envs: `CREDENTIAL_REFUSAL_EVIDENCE_WINDOW_HOURS` (24),
`CREDENTIAL_REFUSAL_EVIDENCE_MIN_COUNT` (20). Banco indisponível ou loja sem
marcador conhecido (`REFUSAL_EVIDENCE_WARNING`, hoje só ML) devolve
inconclusivo e cai na sondagem — nunca avisa por dúvida. Teste:
`test/credential-refusal-evidence.test.js`.

### Aviso "a Shopee parou de aceitar a chave" (RCA 2026-08 — não regredir)

O comentário original de `EXPIRY_ALERT_PLATFORMS` afirmava que App ID + chave
secreta "não vencem sozinhos", e por isso a Shopee ficou **fora** da cobertura.
É falso: uma conta real (`victoriaiq9@gmail.com`) passou dias com a chave
recusada (`error [10020]: Invalid Signature`), com 100% das ofertas de Shopee
descartadas e as duas automações dela sem enviar **uma única vez** — em
silêncio total. Foi descoberto só numa investigação manual. **Não tirar a Shopee
de `EXPIRY_ALERT_PLATFORMS`.**

- Sondagem: `checkShopeeSession` (`src/converters/shopee.js`), mesmo contrato
  `{ configured, alive, reason }` do ML/Amazon. Usa uma consulta **só de
  leitura** (`productOfferV2` com `limit: 1`) — não gera link nem grava nada do
  lado da Shopee, então **não precisa de cache de sondagem** (diferente do
  ML/Amazon, onde o probe rotaciona credencial).
- **Só o código `10020` vira `alive:false`** (`SHOPEE_AUTH_REJECTED_CODES`, com
  a classificação pura em `classifyShopeeProbeResponse`). Qualquer outro código,
  HTTP != 200, timeout ou rede fora fica **indeterminado**. Lembre que a API de
  afiliado responde **200 mesmo em erro**, sinalizando via `errors` — por isso a
  classificação lê o corpo, não só o status.
- Armadilha de diagnóstico: chave recusada e credencial incompleta produzem
  sintomas parecidos no painel, mas são coisas diferentes — campo faltando não
  chega a ser sondado (o painel já diz "falta preencher").
- **O painel também avisa** (`GET /credentials/shopee/session` + sondagem no
  `PUT /credentials/shopee`, via `PLATFORMS_WITH_SESSION_CHECK`). Antes disso o
  painel mostrava a Shopee em VERDE com a chave morta — só conferia o formato
  dos campos —, e era por isso que ninguém percebia. E-mail avisando com painel
  verde ao mesmo tempo é pior do que não avisar: as duas pontas andam juntas.
- **Texto da Shopee é o oposto do das outras duas, nas TRÊS superfícies**
  (e-mail, banner do painel, mensagem do save): "as ofertas da Shopee param de
  sair", nunca "continuam saindo, só o link fica mais comprido". Guardas em
  `test/credential-save-session-check.test.js` e
  `test/credentials-shopee-session-route.test.js`.
- Vocabulário: na Shopee é **"chave"** (App ID + chave secreta), não "código de
  acesso" — esse termo é dos cookies de sessão do ML/Amazon.
- Envs (todas opcionais): `CREDENTIAL_EXPIRY_ALERT_ENABLED`,
  `CREDENTIAL_EXPIRY_SWEEP_INTERVAL_MS`, `CREDENTIAL_EXPIRY_ALERT_COOLDOWN_DAYS`.
  Sem SMTP a passada nem começa. Runbook de ligar o SMTP:
  `docs/ops/aviso-codigo-acesso-vencido.md` (lembrar da pegadinha #1 —
  `pm2 delete` + `start`, não `restart --update-env`).

### Motor de e-mails (canônico — todo e-mail passa por aqui)

Antes cada e-mail tinha seu próprio builder e suas próprias regras. Hoje há um
caminho só, e a cliente edita os textos pelo painel.

| Peça | Onde |
|---|---|
| Catálogo (texto padrão de 34 e-mails) | `src/email/registry.js` |
| Formato do texto (parágrafo, lista, botão, `{{variavel}}`) | `src/email/markup.js` |
| Moldura visual + rodapé de descadastro | `src/email/layout.js` |
| Despachante (ÚNICO caminho de envio, com todas as travas) | `src/email/dispatcher.js` |
| Fila lenta dos disparos em massa | `src/email/queue.js` |
| Filtros de público (puro) | `src/email/audience.js` |
| Descadastro por categoria (LGPD) | `src/email/optOut.js` + `/api/emails/unsubscribe` |
| Gatilhos por ciclo de vida (passada diária) | `src/emailTriggers/lifecyclePolicy.js` + `lifecycleSweep.js` |
| Gatilhos por acontecimento | `src/emailTriggers/events.js` |
| Resumo semanal | `src/emailTriggers/weeklySummary.js` |
| Aba E-mails do admin | `src/api/routes/adminEmails.js` + `dashboard/app/admin/emails/page.js` |

**Não regredir:**
- **Não enviar e-mail fora do despachante.** Ele é quem barra endereço
  fabricado (`user_*@sistema.com`), conta banida/suspensa, descadastro
  (marketing), repetição dentro da janela do próprio e-mail (`dedupDays`) e o
  teto diário. Gatilho novo = `sendTemplateEmail`, nunca `sendMail` direto.
- **Texto padrão mora no código; o painel grava só override** (`EmailTemplate`).
  Sem linha lá, vale o código — apagar o override conserta uma edição ruim.
- **`transactional` vs `marketing`** decide consentimento: divulgação respeita
  descadastro e leva o link no rodapé; aviso de conta (cobrança, vencimento,
  segurança) vai sempre e não leva.
- **Disparo em massa só ENFILEIRA.** Quem envia é a fila lenta
  (`EMAIL_QUEUE_BATCH_SIZE`/rodada, `EMAIL_DAILY_CAP`/dia) — domínio novo que
  dispara tudo de uma vez cai em spam, e o provedor tem teto.
- **O "dia" do teto tem hora certa: 8h da manhã (America/Sao_Paulo)**, não é
  janela deslizante de 24h. Com janela deslizante, bater o teto às 15h de terça
  fazia a fila só voltar às 15h de quarta, e cada dia ela andava mais tarde que
  o anterior. `src/email/dailyWindow.js` (puro) resolve a virada vigente; o
  despachante conta o gasto do dia a partir dela e devolve `retryAt` quando
  barra. Envs: `EMAIL_DAILY_RESET_HOUR` (8), `EMAIL_TIMEZONE`
  (`America/Sao_Paulo`). Fuso ou hora inválidos caem no padrão de Brasília —
  teto na hora errada é menos grave que fila parada.
- Sem SMTP, nada é gravado como enviado: a janela anti-repetição não pode
  queimar sem a cliente ter recebido.
- Passadas rodam in-process na API (`setInterval` + `unref`) — **nenhum processo
  PM2 novo** (política de memória).

Envs (todas opcionais): `EMAIL_QUEUE_TICK_MS`, `EMAIL_QUEUE_BATCH_SIZE` (10),
`EMAIL_DAILY_CAP` (300), `EMAIL_DAILY_RESET_HOUR` (8), `EMAIL_TIMEZONE`
(`America/Sao_Paulo`), `LIFECYCLE_EMAIL_ENABLED`,
`LIFECYCLE_EMAIL_SWEEP_INTERVAL_MS`, `WEEKLY_SUMMARY_ENABLED`,
`WEEKLY_SUMMARY_WEEKDAY` (1 = segunda), `EMAIL_TRIGGERS_START_AT`.

### Aviso operacional só para conta em uso (RCA 2026-08 — não regredir)

Cliente com plano vencido, WhatsApp fora do ar e nenhuma oferta há semanas
recebeu "a Shopee parou de aceitar sua chave" — e, antes disso, o robô ainda
gastou uma sondagem na loja para descobrir. A varredura de credencial olhava só
"conta não banida + e-mail real".

`src/email/accountActivity.js` (puro + carregador com db injetado) responde
"essa conta está usando o robô agora?": **acesso ativo E (WhatsApp conectado OU
oferta enviada nos últimos `EMAIL_OPERATIONAL_IDLE_DAYS` dias OU conta com menos
de 14 dias que já chegou a conectar)**. A carência da conta nova é de propósito:
quem acabou de montar é quem mais precisa saber que o robô caiu.

Onde a regra age:
- **No despachante**, para todo e-mail do grupo `saude` disparado em modo
  `auto` (código de acesso venceu, chave da Shopee recusada, WhatsApp caído,
  robô parado). Chokepoint único: gatilho de saúde novo herda a trava sem
  precisar lembrar dela. Envio **manual** da admin nunca é barrado.
- **Antes de sondar** a loja, em `credentialExpiry/sweep.js` — economiza
  chamada à Shopee/ML/Amazon e poupa rotação de código de conta parada.

**Cobrança, senha e dinheiro de afiliada NÃO passam por essa trava**: conta
parada continua precisando saber que o plano vence e que tem saque a fazer.

**Foto incompleta não silencia.** Consulta que falhou (ou banco sem os modelos)
marca `incompleta: true` e o aviso VAI — engolir alerta legítimo por um blip é
pior que mandá-lo.

Duas travas irmãs, no mesmo arquivo:
- **Teto semanal**: no máximo `EMAIL_AUTO_WEEKLY_CAP` (2) e-mails automáticos
  por cliente por semana, contando só os grupos `saude` e `marketing`. Cada
  aviso sozinho se justifica; três assuntos diferentes em três dias viram spam.
- **Desconexão pedida** (`wasStoppedByUser`): `POST /session/stop` e
  `/session/forget` gravam `WaConnectionEvent('manual_stop_requested')`, e o
  aviso de WhatsApp caído não sai enquanto não houver conexão nova depois do
  pedido. Desligar o robô é escolha, não problema.

Envs (opcionais): `EMAIL_OPERATIONAL_IDLE_DAYS` (7), `EMAIL_AUTO_WEEKLY_CAP` (2,
`0` desliga). Teste: `test/email-conta-parada.test.js`.

### Gatilho ancorado no cadastro não pode ser retroativo (RCA 2026-08 — não regredir)

O motor entrou no ar com a base já formada, e três decisões de
`lifecyclePolicy.js` olhavam "dias desde o cadastro" **sem teto**:
`onboarding_conecte_whatsapp` (`>= 2 dias`), `configuracao_incompleta`
(`>= 1 dia`) e `seja_afiliado` (`>= 14 dias`). Cliente de oito meses atrás
satisfaz "faz 2 dias ou mais" — a base inteira recebeu e-mail de boas-vindas
atrasado na primeira passada. Duas travas, uma não substitui a outra:

- **Janela máxima** (`SIGNUP_WINDOW_DAYS`: 30/30/90 dias) direto na política
  pura — vale mesmo sem env nenhuma configurada.
- **Corte de virada** `EMAIL_TRIGGERS_START_AT` (data ISO, ausente = desligado):
  conta criada ANTES dessa data nunca dispara gatilho ancorado no cadastro.
  Vale também para a trilha de nutrição (`runNurtureSweep` recua o início da
  janela de 8 dias para a data da virada).

**O corte NÃO silencia aviso de fato atual** — plano vencendo, robô caído
ontem, saldo disponível para saque continuam valendo para toda a base: não são
retroativos, são o que está acontecendo agora. Cliente antiga que você quiser
convidar para afiliada é disparo manual pela aba E-mails. Testes:
`test/email-lifecycle-triggers.test.js` (bloco "gatilho de cadastro não é
retroativo").

Testes: `test/email-engine.test.js`, `test/email-lifecycle-triggers.test.js`,
`test/admin-emails.test.js`, `test/email-templates-migrados.test.js`,
`test/weekly-summary-email.test.js`, `test/password-reset.test.js`.

### Grupo "Contato e escuta" (não regredir)

Oito e-mails prontos (`group: 'contato'` em `src/email/registry.js`) para
perguntar à cliente o que travou, o que ficou confuso e o que faltou — check-in
geral, travou na configuração, dúvida nas lojas, primeira semana, parou de usar,
o que faltou (quem não continuou), convite para conversa e pesquisa de uma
pergunta só.

Contrato garantido por `test/email-contato-escuta.test.js`:
- **Sempre `trigger: 'manual'`.** Pergunta automática, disparada na hora errada,
  queima o canal — quem escolhe o momento e o público é a pessoa, pela aba
  E-mails.
- **Sempre `marketing`**: não é obrigação de serviço, então respeita descadastro
  e leva o link no rodapé.
- **Todo e-mail pergunta alguma coisa e convida a responder**, e traz os DOIS
  canais (WhatsApp e e-mail de suporte) no corpo. Pergunta sem canal de resposta
  é armadilha.
- **`dedupDays >= 21`**: ninguém pode ser sondada toda semana.
- Sem cobrança, sem culpa, sem promessa de resultado (o teste falha em
  "culpa sua", "garantimos", "última chance" e afins).

### Recuperação de senha (não existia até 2026-08)

Quem perdia a senha só voltava pelo suporte — e o link "Esqueci minha senha"
apontava para um `mailto:` de um domínio que não é nosso. Agora:
`POST /api/auth/forgot-password` → e-mail com link → `POST /api/auth/reset-password`.

- **Sem tabela nova:** o link é um token assinado (`src/auth/passwordResetToken.js`)
  que inclui a impressão do hash da senha ATUAL. Isso dá **uso único de graça**
  (trocou a senha, todo link antigo morre) e validade de 1h.
- **Resposta sempre igual**, exista ou não a conta — a rota não pode virar
  detector de quem tem conta aqui. Usa o mesmo balde de tentativas do login.

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

## Fila travava inteira quando UM item falhava (RCA 2026-07-20, não regredir)

Cliente reportou "as filas não estão funcionando, não enviando mensagens".
Achado: duas filas tinham um `for` sequencial sem isolamento por item — uma
exceção em UM item abortava o `for` inteiro, perdendo o progresso já feito e
travando a fila até intervenção manual/restart:

1. **`runAutomation` (`src/offerAutomation/dispatcher.js`)**: o
   `await sendBroadcastFn(...)` dentro do loop de `toSend` não tinha
   try/catch. Uma falha pontual num item (timeout de IPC pro worker, bot sem
   socket no instante exato) lançava e pulava o bloco de persistência
   inteiro logo após o loop (`sentLogRows`/`sentItemIds`/`page`) — mesmo os
   itens JÁ enviados com sucesso ANTES da falha perdiam o registro. Sem
   `sentItemIds`/`page` avançarem, o próximo tick do cron tentava o MESMO
   lote de novo — se a causa fosse persistente (não transitória), a
   automação ficava presa reenviando o mesmo lote pra sempre sem nunca
   progredir.
2. **`checkScheduledMessages` (`src/bot-worker.js`)**: o
   `db.messageLog.create()` por `jid` dentro do loop de mensagens agendadas
   não tinha try/catch (só o `try` de fora, que envolve TODAS as mensagens
   `pending` do tick). Uma falha de escrita (ex.: `SQLITE_BUSY` pontual)
   abortava o processamento dos jids restantes DESSA mensagem, de TODAS as
   outras mensagens agendadas pendentes no mesmo tick, e deixava `msg` presa
   em `status='queued'` para sempre — a query de pending só busca
   `status='pending'`, e `markInterruptedSendLogs()` (que resgataria
   `queued`/`sending` órfãos) só roda uma vez, no boot do worker.

**Fix**: cada item do loop agora tem seu próprio try/catch — loga e
`continue` para o próximo item em vez de deixar o erro escapar pro `for`
inteiro. `runAutomation` retorna `{ sent, failed, failures }` quando há
falhas parciais; o item que falhou fica de fora de `sentItemIds` (reentra
candidato no próximo tick). Não regredir: não remover o try/catch por-item
desses dois loops — a AUSÊNCIA dele é exatamente o que travava a fila
inteira por causa de um item só. Teste:
`test/offer-automation.test.js` ("falha pontual num item do lote não aborta
os demais").

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
   `OFFER_AUTOMATION_DEDUP_WINDOW_MS` (default **120min**) e filtra os
   produtos por `productKey` (de `productDedupKey`).
2. **Exceção por preço:** se o `priceCents` atual difere de todos os preços
   com que aquele produto saiu dentro da janela, a oferta **passa** — é uma
   oferta nova de fato (relâmpago da manhã a R$X vs. da tarde a R$Y). Isso
   concilia a janela com o pedido histórico de não prender oferta legítima
   que voltou mais barata.
3. Cada envio grava uma linha em `OfferAutomationSentLog`; registros fora da
   janela são podados a cada run (a tabela fica limitada à janela por grupo).
4. `dedupeOffersByProduct` continua colapsando o mesmo produto **dentro de um
   lote** (mantém o primeiro), então mesmo-produto/preços-diferentes no MESMO
   envio vira uma oferta só — a exceção por preço só atua entre execuções.

Teste: `test/offer-automation.test.js`.

## Mensagem do grupo monitorado espelhada N vezes (RCA 2026-07 — não regredir)

**Sintoma:** o grupo monitorado publicou UMA mensagem às 14:13. Em staging ela
saiu 5x (14:14, 18:41, 19:42, 19:52, 20:04); em produção saiu uma vez só, mas
5h atrasada (19:13). Mesmo código nos dois ambientes (`develop` == `main` na
data) — a diferença é de estado/configuração, não de versão.

**Causa de primeira ordem — a mensagem estava sendo VISTA várias vezes.**
Confirmado na fonte do Baileys 6.7.23 instalado (`lib/Socket/messages-recv.js`):

```js
await upsertMessage(msg, node.attrs.offline ? 'append' : 'notify')
```

Mensagem **reentregue** pelo WhatsApp (fila offline, drenada a cada reconexão)
chega com `type: 'append'`; ao vivo chega como `'notify'`. O handler de
`messages.upsert` aceitava as duas vias, e a única barreira era o cutoff de
idade — que o Baileys monta com `messageTimestamp: +stanza.attrs.t`
(`lib/Utils/decode-wa-message.js`). **Sem o atributo `t` no stanza isso vira
`NaN`**, e o guard antigo (`if (msgTs && msgTs < cutoff) continue`) era
**pulado**: reentrega de horas antes passava direto para o pipeline.

Hoje a decisão vive em `shouldProcessIncomingMessage`
(`src/core/incomingFreshness.js`, puro/testado), chamada no chokepoint do
`messages.upsert`:

- `append` (reentrega/histórico) **sem** timestamp confiável → **descarta**;
- qualquer via com timestamp mais velho que `INCOMING_MAX_AGE_MS` (5min) → **descarta**;
- `notify` (ao vivo) sem timestamp → **processa** (é a via da mensagem nova;
  descartar perderia mensagem legítima).

**Não descartar `append` em bloco:** mensagem de **canal (`@newsletter`) ao
vivo** também chega como `append` (`Processed plaintext newsletter message`, no
mesmo arquivo do Baileys). Ela vem com `t` válido e recente, então passa pela
regra de idade — a distinção é a idade, não o tipo.

O descarte **loga motivo e idade** (`Mensagem descartada: reentrega/mensagem
velha não reentra no pipeline`). Antes era um `continue` mudo, o que tornava
impossível ver reoferta acontecendo no `bot.log`.

**Não esticar a janela de `msgIds` para compensar.** Ela vale **5min** de
propósito (`DEDUP_MSGID_WINDOW_MS`) — é a rede contra re-emissão imediata do
mesmo id, não a barreira contra reoferta horas depois; janelas curtas são o que
a semântica de cupom depende. **Não voltar a derivar `linkDedupWindowMs` de
`dedupeWindowMs`** (era `Math.max(dedupeWindowMs, ...)`): amarrar as duas faz
qualquer aumento em msgIds arrastar a janela de link junto e prender repost
legítimo.

**Segunda brecha, no lado do ENVIO:**

1. **A dedup por DB não enxergava envio ainda PENDENTE.** A consulta filtrava
   `sentAt` dentro da janela do link; só que `sentAt` de uma linha `queued` é o
   momento em que ela foi criada, e um job pode ficar **horas adiado** pela
   preservação do destino (`deferSendJob`: horário de funcionamento, burst cap,
   daily cap). Passados os 120min a linha pendente ficava invisível pra dedup, a
   mesma oferta entrava de novo na fila, e quando a janela do destino abria as
   duas (ou cinco) saíam em **rajada espaçada pelo throttle** — exatamente o
   padrão 19:42/19:52/20:04. Hoje a consulta tem dois ramos: `success` dentro de
   `effectiveDedupWindowMs`, **ou** `queued`/`sending` dentro de
   `pendingDedupMaxAgeMs` (produto: `PENDING_DEDUP_MAX_AGE_MS`, default 24h —
   teto só pra que uma linha presa em `queued` por bug não bloqueie o destino
   pra sempre). Mensagem que ainda não foi entregue é duplicata independente da
   idade. **Cupom fica de fora desse teto** (`pendingDedupMaxAgeMs` cai para a
   janela curta do cupom): a mesma URL de campanha é reposta várias vezes ao dia
   com códigos diferentes, e segurar a segunda porque a primeira ainda não saiu
   perderia oferta legítima.

**Forense (o que faltava para diagnosticar):** o `bot.log` só registrava
`messages.upsert recebido {type, count}` — sem `msgId` era impossível separar
"WhatsApp reofertou o mesmo `key.id`" de "a fonte republicou". Agora cada
mensagem ACEITA loga `Mensagem aceita para processamento {jid, msgId,
upsertType, hasValidTimestamp, ageMs}` e cada mensagem DESCARTADA loga o motivo
(`stale` / `replay_without_timestamp`) com a idade. Volume proporcional ao de
mensagens do socket.

**Atraso de horas ≠ duplicata.** Um envio pode ficar `queued` legitimamente
esperando a preservação do destino; o painel mostra a espera no `errorMsg` da
linha. Antes de tratar atraso como bug, rodar o diagnóstico abaixo e conferir
`operatingHours*`/`burstCap`/`dailyCap` do destino.

**Diagnóstico (read-only, roda no VPS dentro do diretório do ambiente):**
```bash
cd ~/wabot-staging && node scripts/diag-mirror-duplicates.mjs <email> \
  --since "2026-07-27 13:30" --until "2026-07-27 21:00"
cd ~/wabot && node scripts/diag-mirror-duplicates.mjs <email> \
  --since "2026-07-27 13:30" --until "2026-07-27 21:00"
```
Ele cruza `MessageLog` (incluindo pendentes), `SendDedupKey`,
`WaConnectionEvent`, `AnalyticsEvent ops_*`, a preservação de cada destino e o
`bot.log`, e diz explicitamente se o MESMO `key.id` foi aceito mais de uma vez.

Testes: `test/incoming-freshness.test.js`, `test/mirror-duplicate-replay.test.js`,
`test/bot-worker-relay-branding.test.js`.

## Agregação de duplicatas em `MessageLog.dedupHits`

Em vez de criar N linhas de `skip:dedup_recent_link` quando a mesma
oferta cai no mesmo destino ao longo do dia (várias automações/canais-fonte
apontando pro mesmo grupo, ou a fonte republicando), agregamos no contador
`dedupHits` da linha mais recente do mesmo `(userId, destGroup,
convertedUrl)`. Implementado em `registerDedupBlock()` no `bot-worker.js`:

1. Procura a linha mais recente dentro de `linkDedupWindowMs` (default
   120min, override via env `DEDUP_LINK_WINDOW_MS`) filtrando por `userId`,
   `destGroup` e `convertedUrl OR originalUrl`.
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
| `skip:dedup_recent_link`         | DEDUP              | Mesma oferta já enviada ao destino dentro da janela de dedup (per-dest) |
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

## Fila entupida por UM destino derrubando a vazão de todos (RCA 2026-07 — não regredir)

**Sintoma:** conta em produção com **489 envios parados na fila** e mensagem
publicada à meia-noite saindo às 14h.

**Medição (não suposição):** entravam **~111 envios/hora** e saíam **~52/hora**.
O `bot.log` mostrava cadência travada em **68–71s entre QUALQUER envio**,
inclusive para destinos com `minIntervalSec=3`. O log de `Smart delay antes do
envio` trazia `delayMs: 60000` em 17 dos 20 últimos envios.

**Causa 1 — o freio progressivo media a fila TOTAL.**
`buildQueuePressureDelayMs` (`src/bot-worker.js`) usa
`calculateProgressiveDelayMs`: `degraus = floor((fila - 20)/20) + 1`,
`atraso = min(60s, degraus × 5s)`. A fila de envio é **única e serial**
(`concurrency: 1`), então um destino com cadência apertada (`burstCap=1` a cada
`600s` → teto de 6 envios/hora) acumulava centenas de itens, mantinha a fila
acima de 240 (onde o freio **satura**) e fazia **todos os outros destinos**
pagarem 60s por envio. Espiral: fila grande → vazão menor → fila maior.

Hoje a pressão é medida **por destino** (`getSendBackendQueueSizeForDest` →
`getQueueSizeByDest` no backend memory) e **recalculada no dequeue**, não mais
congelada no enqueue com o número global. Jobs adiados (`notBefore`) vivem fora
da fila (em `scheduled`), então já não contam como pressão — correto, não estão
disputando o consumidor. **Não voltar a chamar `buildQueuePressureDelayMs()` sem
argumento nos sites de enqueue.** Backend BullMQ não tem contagem por destino e
cai no total (comportamento antigo).

**Causa 2 — espera inline de até 90s congelava o consumidor.**
`THROTTLE_INLINE_WAIT_MAX_MS` era 90s: um destino com `minIntervalSec=100`
fazia `await sleep` de ~90s **dentro** da fila serial (medido: `waitMs` 87693,
89241, 89449, 89668) e nesse tempo nenhum outro destino recebia nada. Default
passou para **5s** — o que exceder vai para o caminho de re-enfileiramento com
`notBefore`, que não bloqueia. Como a preservação é por destino, a espera de um
destino não pode virar espera de todos.

**Descarte por idade na fila (`queueMaxAgeMin`) — configurável pela usuária.**
Se entra mais oferta do que o destino aceita, a fila cresce para sempre e a
oferta sai velha (preço/estoque já mudaram). Cada destino agora tem um teto de
espera na Preservação: `PreservationPreset.queueMaxAgeMin` (NOT NULL, default
**300 min = 5h**) + override nulável em `Group.queueMaxAgeMin`. Decisão pura em
`src/core/queueExpiry.js` (`shouldDropExpiredQueueJob`), aplicada em
`processSendJob` **antes** do smart delay — não faz sentido dormir 60s para
depois jogar a mensagem fora. A idade vem de `job.enqueuedAt` (preservado pelos
re-enfileiramentos de defer).

- `0` desliga o descarte (fila volta a crescer sem limite) — escape hatch.
- Sem `enqueuedAt` confiável **não descarta** (fail-safe: descartar por dúvida
  perderia oferta legítima).
- Linha vira `status='skipped'` com `skip:queue_expired:age=<n>min:max=<n>min`
  (categoria `CONFIG_BLOCK` em `errorTaxonomy.js`, tradução leiga em
  `dashboard/lib/painel/logsCopy.js`). Não é erro de envio: é decisão de
  configuração.
- UI: campo "Descartar oferta que esperou mais de (minutos)" em
  `PreservationLimitsForm`, junto dos demais limites anti-ban.

**Ordem canônica dentro de `processSendJob` (não reordenar):** resolver a
preservação do destino → descartar por idade → smart delay (freio por destino +
rest) → gate de throttle → tentativas de envio.

Testes: `test/queue-pressure-and-expiry.test.js`,
`test/core/preservationConfig.test.js`.

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

## "Atraso entre canais" (`channelStaggerJitterMs`) — default 90s → 20s (RCA 2026-07-28)

**Sintoma:** cliente relatou mensagens "muito tempo na fila" **mesmo sem
preservação configurada**. Na conta de dev, `preservationEnabled=0`,
`channelThrottleEnabled=0` e preset com `throttleEnabled=0` — nenhum gate de
throttle agindo — e ainda assim os envios saíam com 88-125s de intervalo.

**Causa raiz:** `BotConfig.channelStaggerJitterMs` (campo "🎲 Atraso entre
canais", em Preservação → Configurações) estava em 120000ms. Para o 2º destino
em diante que seja canal, `bot-worker.js` sorteia `0..channelStaggerJitterMs` e
guarda no `job.delayMs`; `processSendJob` faz `await sleep(delayMs)` **dentro da
fila serial de envio**. Ou seja, não espaça só os canais: **congela todos os
envios do usuário**, inclusive para grupos e de outras fontes. Medição no
`bot.log` de staging: média **60,4s** de espera por mensagem (máx 119,5s); ao
zerar o campo, o intervalo entre envios caiu para **8-14s**.

**Duas armadilhas de diagnóstico:**
- o campo é **desacoplado** dos toggles de preservação (comentário em
  `bot-worker.js:3368`: "aplica sempre que houver jitter configurado") — logo
  "preservação desligada" **não** significa "sem atraso";
- `BotConfig.channelMinIntervalSec` continua gravado mas é **campo morto**: o
  gate lê `destPreservation` (preset por destino), e `checkAndReserve` ignora o
  botConfig (`_botConfig`). Não perder tempo investigando esse valor.

**Mudança aplicada:** default 90000 → **20000** em `prisma/schema.prisma` +
migration DML `20260728120000_channel_stagger_default_20s` que troca **só as
linhas ainda em 90000**. Quem escolheu valor próprio (inclusive `0`) mantém a
escolha — é config de preservação, sobrescrever decisão do cliente seria pior
que o atraso. Testes: `test/migrations-channel-stagger-default.test.js`.

**Pendências conhecidas (não corrigidas ainda):** (1) o atraso aplicar mesmo com
a preservação desligada; (2) o `sleep` rodar dentro do consumidor serial em vez
de adiar o job (o mecanismo de `deferSendJob`/`notBefore` já existe justamente
para não congelar a fila — o stagger não o usa). Enquanto isso não mudar,
**qualquer aumento nesse campo custa atraso em TODOS os envios da conta**, não
só entre canais.

**Diagnóstico rápido** (o atraso aparece no log com nome próprio):
```bash
grep '"msg":"Smart delay antes do envio"' $BOT_LOG_DIR/bot.log | tail -100 \
 | sed -n 's/.*"time":\([0-9]*\).*"baseDelayMs":\([0-9]*\).*/\1 \2/p' \
 | awk -v now=$(date +%s) '{ printf "%.1f min atras base=%.1fs\n", (now-$1/1000)/60, $2/1000 }'
```

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
(default **2min** desde 2026-07 — era 5min; `DEFAULT_MAX_RECONNECTING_MS` /
`computeHeartbeatState` em `sessionPersistencePolicy.js`) — reportando
`idle`→`disconnected` mesmo com reconexão ainda agendada. O worker
CONTINUA tentando reconectar sozinho (essa válvula só afeta o que é mostrado,
não a lógica de retry); se reconectar depois do teto, o próximo `open` volta a
marcar `connected` normalmente.

**Importante — durante qualquer cooldown de reconexão o bot está DE FATO fora
do ar** (sem socket ativo, nada é recebido nem espelhado), não é só um detalhe
de status no painel. Por isso `RECONNECT_STABLE_CLOSE_COOLDOWN_MS` (o cooldown
para quedas "tipo relógio" de sessão estável) foi reduzido 30min → 5min → e hoje
**1min** (2026-07, prioridade de alta disponibilidade / issue #1216): enquanto o
cooldown corre a sessão fica DE FATO fora do ar, e a promessa de robô 24h não
tolera minutos de indisponibilidade só para conter uma notificação de re-sync
que aparece apenas no celular do dono (não afeta os grupos). Threshold de stable
close subiu 3 → **4** e o de flap 5 → **8** (`RECONNECT_FLAP_THRESHOLD`), com
`RECONNECT_FLAP_COOLDOWN_MS` 2min → **30s** — na prática a proteção anti-spam
virou residual, deliberadamente. Quem precisar de postura conservadora sobe via
env (rollback do handoff em `docs/reconnect-cooldown-ha-review-handoff-2026-07-08.md`).
O alinhamento antigo "cooldown == heartbeat == 5min de propósito" **deixou de
valer**: agora o cooldown (1min) é menor que o teto do heartbeat (2min) — durante
o cooldown o painel ainda mostra "conectando" (vai reconectar em 1min) e só expõe
`disconnected` após 2min de reconexão genuinamente presa. `RECONNECT_REPLACED_DELAY_MS`
(double-possession) segue em `RECONNECT_MAX_MS` (5min) — caso conservador preservado.

**3. Painel não pode mascarar o status honesto.** `dashboard/app/painel/whatsapp/page.js`
tinha `isBootstrappingSession = isRunning && !isConnected && status === 'disconnected'`
renderizando "Conectando…" — isso escondia exatamente o sinal que os dois fixes
acima existem para mostrar. Removido: `isAwaitingConnectStart` (estado local do
clique em "Conectar") já cobre a corrida legítima de boot; `status==='disconnected'`
agora sempre renderiza "Desconectado" no painel.

**4. "Reconectando" ≠ "desconectado real" — tranquilizar sem mascarar (issue #1216, item #3).**
Baixar o teto do heartbeat para 2min fez o painel expor "Desconectado" cedo
durante uma reconexão que o robô recupera sozinho — alarme falso que leva o
cliente a re-parear à toa (o oposto da meta 24h). Fix SEM violar o item 3 acima:
`buildHeartbeatSessionPatch` (`sessionPersistencePolicy.js`, puro/testado) mantém
`status='disconnected'` (honesto) mas, quando o heartbeat reporta `idle` **e ainda
há reconexão agendada** (worker tentando sozinho), grava `lifecycle='reconnecting'`.
O `GET /status` (`src/api/routes/session.js`) expõe `lifecycle`, e
`dashboard/app/painel/whatsapp/page.js` mostra uma sub-linha ("O robô está
tentando reconectar sozinho — você não precisa fazer nada") **abaixo** do
"Desconectado", sem trocar a linha de status. `idle` SEM reconexão agendada =
parada real → `lifecycle='disconnected'`. Invariante preservada: `idle` nunca
vira "conectando"/"conectado".

## badSession (500): auto-apagar auth é o único gatilho de re-pareamento sob nosso controle (issue #1216, item #2)

Apagar `auth_info` (→ QR novo no celular do cliente) quebra a promessa de
"conectar 1× e rodar liso", então o wipe por `badSession` (500) passa por
`shouldResetAuthForBadSession` (`src/core/reconnectPolicy.js`, puro/testado) com
camadas de proteção, e o RCA "Loop de retry-receipt travado" abaixo avisa que
**500 é o fallback do Baileys para stream-error de motivo desconhecido — nem
sempre é credencial corrompida**. Regras:

- Um 500 que carrega `stuckMsgId` (mensagem travada) **nem entra na contagem** de
  badSession — é o loop de retry-receipt, não corrupção. Trata-se pelo
  `msgRetryCounterCache` + `ops_wa_stuck_message_retry`, não apagando auth.
- `hadStableOpen` (a queda atual foi de sessão estável) → 500 transitório, não apaga.
- **Flag `BADSESSION_KEEP_ESTABLISHED_AUTH` (default OFF).** Quando ON, uma sessão
  que JÁ conectou de forma estável alguma vez neste worker (`everHadStableOpen`,
  escopo de módulo em `bot-worker.js`, persiste reconexões) **nunca** tem auth
  apagado por rajada de 500 — o único gatilho legítimo de re-pareamento passa a
  ser `loggedOut` (401). Default OFF preserva o comportamento histórico; ligar só
  após validar em staging. Rollback sem redeploy (desligar a env).

Testes: `test/reconnect-policy.test.js` (`shouldResetAuthForBadSession`),
`test/session-persistence-policy.test.js` (`buildHeartbeatSessionPatch`,
`computeHeartbeatState`).

## Auto-heal de grupo com sender-key dessincronizada (issue #1216, Camada 3)

Investigação de produção (jul/2026, cliente `julianepumuceno16@gmail.com`) achou um grupo
**não-monitorado** (`120363407732632868@g.us`, spam/pouco relevante) com a sender-key do
Signal dessincronizada gerando **345 falhas de decrypt** e derrubando a sessão em cadência
de ~50min — o mesmo mecanismo do "Loop de retry-receipt travado" abaixo, só que a fonte era
um GRUPO inteiro reofertando mensagens indecifráveis repetidamente, não uma mensagem isolada.
Curar manualmente (grepar o `bot.log` pra achar o JID culpado, pedir refresh ou pedir pra
cliente sair do grupo) não escala por cliente.

**Auto-remediação (não-destrutiva, sempre):**

- `instrumentBaileysLoggerForHealth` (`src/bot-worker.js`) já intercepta toda linha de log
  que bate `SESSION_HEALTH_SIGNAL_RE` (Bad MAC / SessionError / MessageCounterError / "sent
  retry receipt"). Agora, além de contar pro indicador de saúde, `handleGroupDecryptSignal`
  tenta extrair o `remoteJid` dos args brutos do logger via `extractRemoteJidFromLogArgs`
  (`src/core/reconnectPolicy.js`, puro/testado — busca em largura, rasa e limitada, já que a
  lib não garante posição fixa do campo na árvore de contexto do erro).
- Quando o MESMO grupo cruza `WA_GROUP_DESYNC_THRESHOLD` (default 5) falhas de decrypt em
  `WA_GROUP_DESYNC_WINDOW_MS` (default 30min), dispara **sozinho** um
  `triggerWaGroupsRefresh()` — a MESMA função por trás do endpoint manual `/refresh-wa-state`
  (`groupFetchAllParticipating()` no socket já conectado). **Não fecha o WebSocket, não gera
  QR, não pede nada da cliente** — o robô continua enviando/recebendo durante e depois.
  `WA_GROUP_DESYNC_REFRESH_COOLDOWN_MS` (default 5min) evita martelar o mesmo grupo.
- Evento durável `ops_wa_group_desync_autoheal` a cada disparo (allowlist em
  `src/analytics.js` + mapeamento em `src/observability/operationalSignals.js`).

**Escalonamento — NUNCA automático além do refresh.** Se o auto-refresh disparar
`WA_GROUP_DESYNC_ESCALATE_THRESHOLD` (default 3) vezes pro MESMO grupo dentro de
`WA_GROUP_DESYNC_ESCALATE_WINDOW_MS` (default 3h) sem as falhas pararem, emite
`ops_wa_group_desync_unresolved` (só visibilidade — decisão de sair do grupo fica **sempre**
com humano/cliente, o sistema nunca sai de grupo sozinho).

**Escopo de módulo (não regredir):** `groupDecryptTimestamps`, `groupAutoRefreshTimestamps` e
`groupLastAutoRefreshAtByJid` vivem fora de `startBotInner` (mesma lição do RCA do
`msgRetryCounterCache` abaixo) — precisam sobreviver a reconexões dentro do MESMO worker,
senão o contador zera a cada `open`/close e o threshold nunca é cruzado.

Testes: `test/reconnect-policy.test.js` (`extractRemoteJidFromLogArgs`).

## Ignorar grupos NÃO-monitorados no socket — fix de causa raiz do desync (RCA 2026-07, cliente `vanessascar12@gmail.com`)

**Investigação:** cliente com robô caindo a cada ~50min o dia inteiro (~30
quedas/dia), recuperando sozinho em ~6s, `0 ações manuais` no painel admin — só
ela, diferente dos outros. `WaConnectionEvent`: `disconnect|500` com
`stuckMsg:true`/`badSession:true` em cadência de relógio. `AnalyticsEvent`:
`ops_wa_group_desync_autoheal` + `ops_wa_stuck_message_retry` recorrentes. No
`bot.log`, as falhas de decrypt do worker dela concentravam-se num **único grupo
`@g.us` que ela participa mas o robô NEM monitora** (não estava nas fontes
monitor/post dela). É o mesmo mecanismo do "Loop de retry-receipt travado" e do
"Auto-heal de grupo" acima, mas o auto-heal (refresh de sender-keys) **não cura**
esse caso: o refresh re-emite chaves pra frente, mas não cancela a mensagem já
enfileirada que o WhatsApp reoferece — a fonte segue viva.

**Causa raiz de segundo nível:** o robô só espelha grupos monitorados, mas o
Baileys tenta decifrar (e por isso manda retry-receipt) mensagens de **qualquer**
grupo que a conta participa. Grupo-lixo dessincronizado → decrypt fail → retry
receipt → WhatsApp reoferece → `stream:error 500` → queda. O robô estava brigando
por mensagem que nunca vai usar.

**Fix (prevenção na origem) — `WA_IGNORE_UNMONITORED_GROUPS` (default OFF):**
liga a opção `shouldIgnoreJid` do `makeWASocket` (`src/bot-worker.js`) via
`shouldIgnoreChatJid` (`src/core/ignoredJidPolicy.js`, puro/testado). Confirmado
na FONTE do Baileys (`Socket/messages-recv.js → handleMessage`): quando
`shouldIgnoreJid(from)` é `true`, a mensagem é **ACKada e descartada ANTES** de
`decrypt()` e `sendRetryRequest()` → sem Bad MAC, sem retry receipt → o WhatsApp
não reoferece → **o stream não cai**. Blast radius mínimo DE PROPÓSITO: só entram
na regra jids de **grupo `@g.us` fora do allowlist**; `@newsletter` (Canais que
sigo), DMs (`@s.whatsapp.net`), `status@broadcast` e o próprio número **nunca**
são ignorados. O allowlist (`allowedChatJids`, escopo de módulo) = monitor +
destino + canal-botão, repopulado a cada `getConfig()`; `ready`-guard evita
ignorar mensagem legítima enquanto a config não carregou (default seguro no boot).
Mensagem travada de `@newsletter` continua coberta pela blindagem do
`msgRetryCounterCache` (limite 5/mensagem). **Rollout seguro:** default OFF,
reversível sem redeploy; **validar em staging** (o gate é confirmar em campo que
o retry-receipt some com um grupo real dessincronizado) antes de ligar em prod.
Teste: `test/ignored-jid-policy.test.js`.

**Visibilidade admin (Part B):** como a regra é **NUNCA sair de grupo sozinho**,
a "cura" (cliente decide sair) tem que ser barata — antes exigia grepar 1.4GB de
log. Agora os eventos `ops_wa_group_desync_autoheal`/`unresolved` carregam o
**nome** do grupo (`groupSubjectByJid`, cacheado no `groupFetchAllParticipating`),
e o detalhe do painel admin online (`buildAdminOnlineUserDetail` +
`summarizeDesyncGroups` em `src/adminLogSummary.js`) devolve `desyncGroups`
(nome + jid + nº de refresh + flag `unresolved`), renderizado numa seção do drawer
em `dashboard/app/admin/online/page.js`. Teste: `test/admin-desync-groups.test.js`.

**Não regredir:** não ler `group.imageMode`/config fora do chokepoint não muda
aqui, mas não mover `allowedChatJids`/`groupSubjectByJid` pra dentro de
`startBotInner` (precisam sobreviver a reconexões, mesma lição do
`msgRetryCounterCache`); não ampliar o `shouldIgnoreChatJid` para ignorar
newsletter/DM sem revalidar Canais/pareamento; manter o default OFF até validação
explícita em staging.

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

## `failure 405` derrubando TODAS as sessões: versão do WA Web cortada (RCA 2026-07-28)

**Sintoma:** cliente reporta "não consigo reconectar meu WhatsApp"; o painel
mostra `Falha na conexão / Falha ao solicitar código de pareamento` e
`Desconectado`. Investigação mostrou que **não era o número dela**: em produção,
**todas** as sessões estavam caídas com `code: 405` (1254 eventos em 48h,
começando 2026-07-27 ~20:24 BRT), e em staging idem.

**Causa raiz:** `405` **não existe** no `DisconnectReason` do Baileys — vem cru
do `<failure reason="405">` do servidor do WhatsApp (`ws.on('CB:failure')` em
`Socket/socket.js`), ou seja, é **recusa de login/registro**. O que estava sendo
recusado era a **versão do WA Web anunciada no handshake**:
`fetchLatestBaileysVersion()` busca o arquivo de versão do **repositório do
Baileys**, que ficou preso em `2.3000.1035194821` — build que **não existe** na
lista real de versões do WA Web (`wppconnect-team/wa-version`). Quando o
WhatsApp expirou a faixa antiga, todo login passou a receber 405. Bumpar o
pacote não resolve: `baileys@7.0.0-rc13` hardcoda exatamente a mesma versão.

**Armadilha de diagnóstico (não repetir):** com a sessão registrada, um 405 se
parece com queda genérica; com auth limpo, o log diz `not logged in, attempting
registration...` e some — dá a impressão de bloqueio do número. Dois sinais
separam de verdade: (1) o incidente atinge **todas as contas ao mesmo tempo** —
sempre conferir `WaConnectionEvent` de prod antes de culpar um chip; (2) o nó
bruto de failure (`lastDisconnect.error.data`), que **era descartado** e hoje é
logado.

**Resolução da versão (`src/core/waVersion.js`, puro/testado)** — ordem:
1. **`WA_WEB_VERSION`** (ex.: `2.3000.1044015310`) — pin manual. É o botão de
   emergência: quando o WhatsApp cortar a versão de novo, fixar no `.env` +
   `pm2 delete/start` (pegadinha #1) resolve **sem redeploy**.
2. Registro público de versões reais (`WA_VERSION_REGISTRY_URL`, default
   `wppconnect-team/wa-version`), que espelha o próprio web.whatsapp.com.
   Builds com `expire` vencido são descartadas — usar build expirada é
   exatamente o que produz o 405. `''` desliga a fonte.
3. `fetchLatestBaileysVersion()` — comportamento histórico, agora penúltimo
   recurso em vez de fonte única.
4. Última versão boa deste processo (cache em memória).

A versão escolhida e a fonte aparecem no `bot.log` (`Versão do WhatsApp Web
resolvida para o handshake`) — sem isso é impossível auditar um incidente
depois. Sinal durável `ops_wa_version_rejected` (allowlist em `src/analytics.js`
+ `src/observability/operationalSignals.js`).

**Não regredir:** não voltar a usar `fetchLatestBaileysVersion()` como fonte
única; não remover o corte de sufixo de canal (`-alpha`) no parse — sem ele a
versão vigente é descartada e caímos na fonte velha; não escolher build com
`expire` vencido. Testes: `test/wa-version.test.js`, `test/errors-map-infra.test.js`.

### Pareamento NUNCA pode apagar a credencial antes da hora (mesmo RCA)

O que transformou um incidente recuperável em **sessão travada** foi um bug
nosso: o handler de `requestPairingCode` (`src/bot-worker.js`) fazia
`rm -rf AUTH_DIR` **assim que a cliente clicava em conectar**, antes de saber se
o WhatsApp aceitaria o pareamento. Com o WA recusando (405), a credencial válida
era destruída e o close pré-código **não reagendava reconexão** — a sessão saía
de "caiu mas volta sozinha" para "sem credencial e sem reconexão". Cada nova
tentativa da cliente repetia a destruição.

Hoje `createPairingAuthBackup` (`src/core/pairingAuthBackup.js`, I/O injetado,
testado) transforma o `rm` em `rename` para `<AUTH_DIR>.pairing-backup`:
- **restore** nos quatro caminhos de falha pré-código (erro no socket,
  expiração da janela de pareamento, `startBot` falhando, close não-515 sem
  código entregue). No caso do close, a sessão **volta a reconectar sozinha**
  com a credencial antiga;
- **discard** só quando o WhatsApp aceita o pareamento (close `515`
  restartRequired), ponto em que a credencial nova é a boa;
- backup órfão de um pareamento interrompido é descartado antes do próximo;
- falha inesperada de `rename` degrada para o comportamento histórico
  (AUTH_DIR limpo), nunca para "pareamento impossível".

**Não regredir:** não voltar a apagar `AUTH_DIR` no início do pareamento; não
remover o `restore` de nenhum dos quatro caminhos; não descartar o backup antes
do `515`. Teste: `test/pairing-auth-backup.test.js`.

### Mensagem honesta para a cliente

`mapInfraError` (`src/errors.js`) jogava cinco erros distintos do worker no
catch-all `WA_PAIRING_FAILED` ("Falha ao solicitar código de pareamento") — a
cliente lia uma falha genérica e re-pareava sem parar, destruindo a credencial a
cada tentativa, sem nenhuma chance de sucesso. O 405 agora tem código próprio
`WA_VERSION_REJECTED` (503, retryable) e texto que diz o que é: recusa do
WhatsApp por versão desatualizada, **não** problema do número dela. Segue a
regra de linguagem leiga — nenhum jargão (`405`, `socket`, `handshake`,
`pairing`) pode chegar à tela, e há teste que falha se voltar.

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

## "Imagem que veio na mensagem" tem UM caminho só: subir de novo (RCA 2026-08-21)

Existiam **dois** caminhos para a mesma promessa de produto, e eles não eram
equivalentes:

- destino **com** botão "Ver canal" → `getImage({ forceOriginalForChannelButton })`
  baixa a mídia da origem e a **SOBE de novo** como imagem nova (o botão só é
  aceito em corpo de mídia). É o caminho que a cliente descreve como "funciona
  perfeito";
- destino **sem** botão, modo `original` → `shouldUseRelayPath` + `relayMessage`
  **REAPROVEITAM** o proto já hospedado da origem, sem subir nada.

Quando todas as contas foram trocadas para `original` (bloqueio do ML), o grupo
sem botão passou a usar o repasse e a cliente reportou oferta que **chegava no
grupo gêmeo e não chegava nele** — com o envio gravado como `success`, porque o
repasse é aceito pelo Baileys e a perda acontece depois, na entrega. O painel não
tem como ver isso: `success` significa "entreguei ao WhatsApp", não "apareceu no
grupo".

Hoje `shouldReuploadOriginalMedia` (`src/core/imageModePolicy.js`) faz o modo
`original` usar o MESMO caminho do botão. Escape hatch
`IMAGE_ORIGINAL_STRATEGY=relay` volta ao repasse (mais barato, preserva vídeo)
sem redeploy. **Não regredir:** não voltar o repasse a padrão sem antes provar,
em teste controlado com dois destinos gêmeos, que ele entrega tudo. Teste:
`test/image-mode-policy.test.js`.

## Padrão do produto: "a foto que veio na oferta" (2026-08-21)

`DEFAULT_GROUP_IMAGE_MODE` passou de `preview` para **`original`**. Motivo
medido: o card de preview depende de ABRIR A PÁGINA DA LOJA para achar a foto, e
com o Mercado Livre barrando o IP do servidor **todo link de produto direto do
ML saía sem foto** — um grupo que só recebe esse tipo de link ficou 100% sem
imagem, enquanto o gêmeo com botão "Ver canal" (que sobe a foto da mensagem)
saía perfeito.

- O modo `preview` **não foi removido**: continua no código e alcançável por
  `GROUP_IMAGE_MODE=preview`. A investigação de foto por loja fica para depois.
- A cliente **não escolhe** formato de imagem na tela. A única escolha de
  formato no painel é o botão "Ver canal" (`dashboard/app/painel/grupos/page.js`).
  Guarda em `test/image-mode-policy.test.js` falha se um controle de `imageMode`
  ou o texto "card de preview" voltar à tela.
- Testes que travavam a string `'preview'` foram reescritos para comparar com
  `resolveGroupImageMode()`: a invariante do chokepoint é o valor persistido ser
  IGNORADO, não o modo ser um valor específico.

## Modo de imagem é GLOBAL e trocável por env (`GROUP_IMAGE_MODE`, 2026-08-20)

Desde 2026-07 o modo é único para todo mundo e o valor persistido em
`Group.imageMode` nunca é lido no envio (seção abaixo). O que mudou em
2026-08-20: esse modo único deixou de ser a string fixa `'preview'` e passa por
`resolveGroupImageMode` (`src/core/imageModePolicy.js`), que lê
`GROUP_IMAGE_MODE` do `.env` — padrão `preview`, valor inválido cai no padrão.

**Por que:** o Mercado Livre passou a barrar o IP do servidor e parte das
ofertas voltou a sair sem foto no preview. `original` ("imagem que veio na
mensagem") não abre a página da loja, então não é afetado por bloqueio de loja
nenhuma — é o plano B enquanto a causa não fecha. A troca é por env de
propósito: vale para todas as contas de uma vez, **não reescreve escolha
nenhuma no banco** e volta apagando a linha do `.env` (pegadinha #1: `pm2
delete` + `start`, e reiniciar o `bot-supervisor` para os bots pegarem).

**A memória de quem estava em preview** fica em
`scripts/snapshot-image-mode.mjs` (read-only): grava cliente por cliente, grupo
por grupo, num JSON com data e motivo. Rodar ANTES de trocar.

**Não regredir:** a invariante do chokepoint continua valendo — `toMonitorGroup`
não pode voltar a ler `group.imageMode`; o que ele lê é o modo global. Teste:
`test/image-mode-policy.test.js`.

## A escolha do formato VOLTOU para a tela da cliente (2026-08-22)

Por grupo monitorado, em "Como a oferta aparece":

- **Card que abre a loja** (`preview`) — texto + card grande; tocar no card abre
  a página do produto;
- **Foto da oferta** (`original`) — foto + texto; tocar na foto só amplia a foto.

**Por que voltou.** A escolha tinha sido tirada em 2026-07 porque o card
dependia de UMA fonte de foto só (raspar a loja): loja bloqueando = oferta sem
foto = suporte. Isso deixou de valer — a foto do ML agora vem também pela API, e
o plano B em cascata (`core/previewImageFallbackPolicy.js`) usa a foto da
mensagem de origem quando a loja não entrega. O motivo de a cliente não poder
escolher caiu junto.

**Precedência — toda ela em `resolveGroupImageModeFor`** (`core/imageModePolicy.js`,
puro/testado), consumida SÓ pelo chokepoint `toMonitorGroup`
(`src/billing/groupEntitlements.js`):

1. **`GROUP_IMAGE_MODE_FORCE`** — chave-mestra global, ignora a escolha de todo
   mundo;
2. `Group.imageMode`, se for um dos dois formatos que a tela oferece;
3. `GROUP_IMAGE_MODE` / `DEFAULT_GROUP_IMAGE_MODE` — para grupo que nunca
   escolheu.

**A chave-mestra não é enfeite.** A lição de 2026-08-19/21 foi precisar trocar o
formato de todas as contas em minutos, sem migration e sem redeploy, quando uma
loja fecha o caminho da foto. Com a escolha por grupo de volta, `GROUP_IMAGE_MODE`
sozinho não faria mais isso (quem escolheu ganharia da env) — daí a env separada.
**Não remover.**

**Não regredir:**
- `fetch` e `none` continuam **dormentes** (FR-006): existem no código e na
  coluna, mas **não** são oferecidos na tela. Valor legado desses dois cai no
  padrão global em vez de reativar um caminho que ninguém escolheu — a migration
  de 2026-07 deixou todo grupo existente com `'preview'` persistido, então essa
  regra é o que impede dado antigo de virar comportamento novo em silêncio.
- ⚠️ **Consequência do deploy, não de ação da cliente:** como todo grupo já
  existente tem `'preview'` no banco, subir esta versão faz esses grupos
  passarem a sair como card clicável **sem ninguém mexer em nada**. É o efeito
  desejado, mas é uma mudança de comportamento no deploy — não confundir com bug.
- O chokepoint continua sendo o **único** ponto que decide o modo. Não voltar a
  ler `group.imageMode` cru em nenhum outro lugar.
- Com o botão **"Ver canal"** ligado no grupo, o seletor fica **travado** em foto:
  o botão só é aceito em corpo de mídia, então oferecer o card ali prometeria
  algo que o WhatsApp derruba.
- Linguagem: a tela diz o que ACONTECE ("abre a loja" / "amplia a foto"), nunca
  `imageMode`, "card de preview", "thumbnail" ou afins. Teste falha se jargão
  voltar.

Testes: `test/image-mode-policy.test.js`, `test/group-entitlements.test.js`.

## `imageMode` fixado em `'preview'` para todos os grupos (2026-07, specs/001-image-mode-preview-default)

A escolha de imagem por grupo monitorado ("Preview clicável" / "Imagem oficial
da loja" / "Imagem que veio na mensagem" / "Sem imagem") foi **desativada**.
Toda oferta espelhada sai sempre como card de **preview clicável do WhatsApp**
(foto do produto no card; título/preço no texto; clique abre o link).

**Motivo:** padronizar o comportamento (menos suporte "por que minha oferta
saiu sem foto/com foto errada"), o preview clicável é o modo mais robusto
contra bloqueio de prévia automática por lojas com link de afiliado
(Shopee/Amazon), e reduz superfície de configuração para o cliente.

**Chokepoint (defesa em profundidade — FR-001/FR-009):**
`toMonitorGroup()` em `src/billing/groupEntitlements.js` ignora o valor
persistido em `group.imageMode` e retorna sempre `imageMode: 'preview'` no
`cfg` consumido pelo pipeline de envio (`src/bot-worker.js`). Mesmo que a
coluna `Group.imageMode` ainda tenha um valor legado (grupo criado antes da
migração, ou migração ainda não rodada num ambiente específico), o
comportamento em runtime é sempre preview — não há caminho de código que leia
o valor persistido sem passar por este chokepoint primeiro.

**Migração de dados (não-destrutiva, idempotente):**
`prisma/migrations/20260710160000_group_image_mode_preview_default/migration.sql`
faz `UPDATE "Group" SET "imageMode" = 'preview' WHERE "imageMode" IS NULL OR
"imageMode" <> 'preview'`, seguindo o precedente de
`20260628120000_group_image_mode_choice/migration.sql` (mesmo padrão de
`UPDATE`). É DML puro — não há `ALTER TABLE`, então convive com o WAL/
`busy_timeout` sem exigir lock exclusivo nem parar API/supervisor
(pegadinha #8 não se aplica aqui). `prisma/schema.prisma` também mudou o
default da coluna de `@default("none")` para `@default("preview")` (defesa em
profundidade adicional para qualquer `create()` futuro que omita o campo) —
isso é só metadado do Prisma Client; o `DEFAULT` físico da coluna já
materializada no SQLite de produção **não** é reescrito (mudar o `DEFAULT`
físico via SQLite exigiria recriar a tabela inteira, risco/lock desnecessário
para um valor que a aplicação nunca lê sem passar pelo chokepoint). Na
criação de grupo (`src/api/routes/groups.js`), `imageMode` é sempre enviado
explicitamente como `'preview'`, então nenhum caminho de criação depende do
`DEFAULT` físico da coluna.

**Novos grupos:** nascem em `'preview'` por dois níveis — app
(`src/api/routes/groups.js`, `POST /groups`) e schema (`@default("preview")`).

**UI removida:** o bloco "Imagem da oferta" (seletor + textos auxiliares) foi
removido de `dashboard/app/painel/grupos/page.js`. O campo `imageMode`
continua aceito/validado em `PUT /groups/:id` (dormente) — a coluna e a rota
não foram removidas, só a superfície de UI.

**Código de extração de imagem permanece DORMENTE, não foi apagado (FR-006):**
com `imageMode` sempre `'preview'`, os ramos que tratavam `'fetch'`/
`'original'`/`'none'` nunca executam em runtime, mas o código continua no
repositório, comentado explicando a dormência, pronto para reativação futura
sem precisar reescrever a lógica:
- `src/bot-worker.js` — `getImage()` (fetch ativo de imagem oficial via
  `resolveMonitoredImage`) e o bloco de `buildPayload` que tratava
  `wantImage`/`imageMode === 'original'`.
- `src/monitoredRelayPolicy.js` — `shouldRelayOriginalMediaForImageMode()`
  nunca mais retorna `true` em runtime (relay de mídia original dormente).
- `src/converters/imageScrapers.js` — scrapers de Amazon/Mercado
  Livre/Shopee (regras da seção "Image scrapers" abaixo continuam válidas
  para quando o código for reativado).

**Não regredir:** não remover os ramos dormentes acima (só documentá-los como
tais); não reintroduzir leitura direta de `group.imageMode` fora do
chokepoint em `groupEntitlements.js` no caminho de envio. Testes:
`test/group-entitlements.test.js`,
`test/bot-worker-manual-link-preview-channel.test.js`,
`test/migrations-group-image-mode-preview.test.js`,
`test/groups-route-image-mode.test.js`.

## `title` do card de preview manual — NÃO pode ser omitido (regressão PR #1186)

O card clicável do modo `preview` (`buildManualLinkPreview`, `src/bot-worker.js`)
sempre mostra o nome da loja (Amazon/Shopee/Mercado Livre/Magalu) numa linha
acima do domínio, entre a imagem e o texto. Isso **não é estético — é
obrigatório**: no PR #1186 o campo `title` do `urlInfo` foi omitido e o
WhatsApp **parou de renderizar o card inteiro** (regressão confirmada em
staging, revertida no commit `1993c9b`). Há um teste estrutural
(`test/store-brand-card.test.js`) que falha se a chamada
`title: storePreviewTitle(...)` sumir da chamada de `buildManualLinkPreview`.

**Flag experimental `PREVIEW_CARD_HIDE_STORE_TITLE`** (default OFF, lida em
`storePreviewTitle`): quando `'true'`, o CONTEÚDO do `title` vira um espaço
(`' '`) em vez do nome da loja — a chave continua presente (não reproduz a
omissão do PR #1186), só o texto visível muda. **Não testado em produção
ainda** — não se sabe se o WhatsApp trata string vazia/proto3 default-value
como campo ausente (o que reproduziria o bug antigo); por isso espaço em vez
de `''`. Antes de promover para main: ligar a flag em staging, mandar uma
oferta real (Amazon/Shopee/ML/Magalu) e conferir no celular se o card ainda
aparece com foto. Se sumir, desligar a flag (sem redeploy) e reverter para o
nome da loja.

## Oferta saindo SEM FOTO: o caminho do card de preview era MUDO (2026-08)

Toda oferta espelhada sai como card de preview (`imageMode` fixo em `'preview'`).
O card só existe com foto: sem `jpegThumbnail`, `buildManualLinkPreview`
(`src/bot-worker.js`) devolve `null` e a mensagem sai como **texto puro** — é
esse o "sem imagem" que a cliente relata.

**O que impedia o diagnóstico:** esse caminho não deixava rastro nenhum em
produção. `fetchProductImage` (`src/converters/imageScrapers.js`) trata o
próprio erro e devolve `null` **sem lançar**, então o `.catch(logger.debug)`
nunca rodava; e `logger.debug` não chega ao `bot.log` de qualquer forma — o
transport de arquivo é `level: 'info'` (`src/logger.js`). Ou seja: zero linha de
log, zero sinal, nenhuma forma de saber se a foto se perdeu na loja, no
download, no `normalize` ou no upload da thumbnail.

Hoje cada etapa que perde a foto chama `reportPreviewCardNoImage(stage)`:
`logger.warn` + `AnalyticsEvent('ops_preview_card_no_image')` (allowlist em
`src/analytics.js`, mapa em `src/observability/operationalSignals.js`). Etapas:
`anchor_missing` (o link não aparece literal no texto), `scrape_sem_imagem` (a
loja não devolveu foto — caso mais comum), `download_falhou`/`download_sem_bytes`,
`normalize_falhou`, `sem_plataforma`.

**Não regredir:** não rebaixar esses avisos para `debug` e não voltar a tratar
`fetchProductImage` como se lançasse erro em falha (ele devolve `null`).
Teste: `test/preview-card-no-image-observability.test.js`.

**Diagnóstico (read-only, roda no diretório do ambiente):**
```bash
cd ~/wabot && node scripts/diag-preview-sem-imagem.mjs [<email>] [--days=3] [--no-live]
```
Ele cruza os avisos do `bot.log`, o histórico do sinal no banco e **repete ao
vivo** a busca de foto dos últimos envios reais, loja por loja — é o que separa
"a loja parou de entregar a foto para este servidor" de "problema nosso depois
de já ter a foto". Lembre da armadilha do ML: o muro anti-robô vem com **status
200** e sem `og:image`.

⚠️ Em modo `remote`, deploy da API **não** recarrega os bot-workers: enquanto o
`bot-supervisor` não for reiniciado, os avisos novos não aparecem no log (ver
seção "código novo não carregado pelos bots").

## Voltar ao CARD DE PREVIEW CLICÁVEL: as duas travas e como caíram (2026-08-21)

Os dois formatos de oferta **não são a mesma coisa para a cliente**:

- **card de preview clicável** (`GROUP_IMAGE_MODE=preview`): texto + card grande;
  **tocar no card ABRE A LOJA**. A foto vem de raspar a página da loja;
- **imagem de verdade** (`original`, e o caminho do botão "Ver canal"): foto com
  legenda; **tocar na foto só amplia a foto** — para ir à loja a pessoa precisa
  achar o link dentro do texto.

Em 20-21/08 o padrão virou `original` porque o preview saía SEM FOTO (sem
thumbnail o WhatsApp não desenha card e a oferta vira texto puro). Foi
paliativo: resolveu a foto e **custou a clicabilidade**. As duas travas que
impediam a volta:

**Trava 1 — o ML fechou TODAS as rotas gratuitas de foto.** Medido de um IP
bloqueado: página de produto (`/p/MLB…` e `produto…-_JM`) responde 200 com ~39KB
e sem `og:image` (muro); `api.mercadolibre.com` responde **403 PolicyAgent** sem
token; `/oembed` não existe (404). Não sobra rota anônima. O que passa: a
**vitrine** `/social/<handle>?ref=` (já implementada, mas só existe para
`meli.la`) e a **CDN** `http2.mlstatic.com`, que nunca esteve bloqueada.

A saída não exigiu rota nova: `fetchMercadoLivreProductInfo`/
`fetchMercadoLivreItemInfo` **já chamavam a API do ML** para título e preço, e a
mesma resposta traz `pictures[]` — a foto estava sendo descartada.
`fetchMercadoLivreApiImageId` (`src/converters/productInfoScraper.js`) devolve o
id da PRIMEIRA foto e `buildMlPictureUrl` monta a mesma variante grande da
vitrine (`D_NQ_NP_2X_<id>-F.jpg`, 1080x1080).

Ordem canônica em `resolveMercadoLivreImage` (**não inverter** — guarda em
`test/ml-api-image-source.test.js`): **vitrine → API → página do produto**. A
vitrine primeiro porque está provada em produção e não gasta token; a API antes
da página porque a página é justamente a que o muro barra (tentá-la primeiro só
queimaria o orçamento de 25s da mensagem).

Cada endpoint exige um token diferente, e é isso que define a cobertura:
`/products/<id>` (link de catálogo `/p/`) usa token de **aplicação**
(`ML_CLIENT_ID`/`ML_CLIENT_SECRET`) e vale para **todas** as contas;
`/items/<id>` (link de anúncio) usa o token **OAuth da cliente** e só vale para
quem tem `oauthRefreshToken`. Sem token, devolve `null` e cai na fonte seguinte.

⚠️ **Não provado:** que o token passa pelo PolicyAgent a partir de um IP
bloqueado. Um token falso devolve o mesmo 403 (a política de auth reprova
antes), então só um teste com as credenciais reais, do VPS, decide. Se o 403
persistir com token válido, a Trava 2 continua sendo a rede de segurança.

**Trava 2 — o card tinha UMA fonte de foto só.** Falhou a loja, o card inteiro
era descartado (`if (!jpegThumbnail) return null`) e a oferta ia como texto puro.
Agora há **plano B em cascata**: a foto da própria mensagem de origem vira a
thumbnail do card, preservando foto **e** clique que abre a loja
(`src/core/previewImageFallbackPolicy.js`).

**Isso não é hipótese sobre o WhatsApp.** O card não sabe de onde vieram os
bytes da thumbnail — é um JPEG subido por `prepareWAMessageMedia` com
`mediaTypeOverride: 'thumbnail-link'`. O banner de cupom
(`buildStoreBrandCardImage`, specs/008) **já** alimenta os MESMOS dois campos
com um JPEG gerado localmente a partir de um SVG, sem tocar na loja, e renderiza
card clicável. "Bytes que não vêm da loja" é caminho já exercitado.

**Não regredir:** a foto da LOJA continua sendo a primeira escolha — a cascata
só roda quando não há thumbnail (a foto da origem vem do concorrente e pode ter
marca d'água/preço antigo; usá-la sempre rebaixaria toda oferta). Não roda em
cupom com banner. Sinal PRÓPRIO `ops_preview_card_origin_fallback` (a oferta
SAIU completa — contá-la como `ops_preview_card_no_image` esconderia justamente
quantas ofertas o plano B salvou). A mídia da origem é baixada **uma vez por
mensagem** (`getOriginalPhotoOnce`), não uma vez por destino — `buildPayload`
roda por destino.

Envs: `PREVIEW_CARD_ORIGIN_FALLBACK=off` desliga a cascata (default LIGADA: ela
só age quando o card já ia sair sem foto, então não há caminho em que piore o
resultado; e como o padrão hoje é `original`, ligada por default ela não muda
nada no que está no ar). `GROUP_IMAGE_MODE=preview` religa o card clicável.

**Ainda não medido (não repetir como fato):** se o muro do ML é permanente, por
frequência ou por reputação de IP — staging (mesmo IP, pouco tráfego) entregava
foto enquanto produção não, e num teste em produção 4 de 8 links devolveram
foto. Sugere intermitência; ninguém mediu. Rodar
`scripts/diag-ml-muro-taxa.mjs --sample=6 --repetir=24 --intervalo=30` (12h de
cobertura) antes de qualquer conclusão. Quantas contas estão com a chave da
Shopee recusada também nunca foi medido:
`scripts/diag-shopee-chave-por-conta.mjs`.

**Critério para religar o preview:** `GROUP_IMAGE_MODE=preview` em produção com
as ofertas saindo com card clicável E com foto, inclusive as de link direto do
ML — conferido no celular, em dois grupos, com `ops_preview_card_no_image` perto
de zero por algumas horas. Lembre que em modo `remote` o deploy da API **não**
recarrega os bot-workers: sem `pm2 restart bot-supervisor --update-env` nada
disso vale nos bots (e isso reconecta TODAS as sessões — avisar antes).

## ML sem foto: o muro anti-robô do ML bate no IP do servidor (RCA 2026-08-19/20)

**Sintoma:** de um dia para o outro, as ofertas de Mercado Livre passaram a sair
**sem foto** (card de preview vazio). Amazon e Shopee normais. A conversão do ML
continuou funcionando — foto e conversão são caminhos independentes.

**Causa medida no próprio VPS** (não suposição): a página do produto do ML
responde **status 200**, ~39KB e **sem `og:image`** — é o muro anti-robô
(`suspicious-traffic-frontend`). `fetchProductImage('mercadolivre', ...)` devolve
`null` e o card sai sem imagem. O muro é **por IP, não por User-Agent**: Chrome,
iPhone, WhatsApp, Facebook e Googlebot receberam todos a mesma parede; só `curl`
mudou (403). Trocar UA não resolve.

**Fonte de foto usada hoje:** a página da **vitrine** (`/social/<handle>?ref=`)
continua acessível e já é buscada para achar o produto destacado. Ela traz a foto
em `pictures.pictures[0].id`, e a CDN (`http2.mlstatic.com`) nunca esteve
bloqueada: `D_NQ_NP_2X_<id>-F.jpg` devolve **1080x1080** (acima do mínimo de
800px do preview). `extractFeaturedSocialImage` +
`fetchFeaturedSocialImage` + `resolveSocialShareUrl`
(`src/converters/mercadolivre.js`) alimentam `resolveMercadoLivreImage`
(`imageScrapers.js`), **antes** da leitura da página do produto — que fica como
2ª opção e volta a valer sozinha se o bloqueio cair.

**Não regredir:** não voltar a depender só da página do produto; não aceitar
vitrine **sem `?ref=`** como fonte (sem o ref o ML serve um destaque qualquer do
perfil — é a origem do bug histórico da "foto errada"); manter a âncora no
PRIMEIRO polycard (os seguintes são recomendações). Fixture real em
`test/fixtures/ml-social-card-featured.html`; teste:
`test/ml-social-card-image.test.js`.

**O muro tem nome próprio no log (guard do incidente).** `isAntiBotWallHtml`
(`imageScrapers.js`) reconhece os marcadores (`suspicious-traffic`,
`/gz/account-verification`) e `resolveMercadoLivreImage` emite
`ops_ml_anti_bot_wall` em vez de deixar o bloqueio virar "sem foto" genérico —
sinal SEPARADO de `ops_preview_card_no_image` porque a ação é outra: não é
defeito nosso, é a loja barrando, e a foto tem que vir por outra fonte.

**Armadilha de diagnóstico:** o muro vem com **200**, então "a página respondeu"
não significa nada. Checar `og:image` e o marcador `suspicious-traffic` no corpo:
```bash
node -e "fetch('<url do produto>',{headers:{'User-Agent':'Mozilla/5.0'}}).then(async r=>{const t=await r.text();console.log(r.status,/suspicious-traffic/.test(t),/og:image/.test(t))})"
```

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

Teste: `node --test test/image-scrapers.test.js`.

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

## SHEIN: encurtamento de link (`SHEIN_SHORTLINK_ENABLED`, default LIGADO)

`shortenSheinLink()` (`src/converters/shein.js`) troca o link longo da SHEIN
pelo `oneLink` curto da própria loja, seguindo o mesmo padrão de kill-switch
dos outros interruptores de rollout desta seção (`COUPON_LINK_CONVERT`,
`COUPON_BRAND_CARD_ENABLED`, `WA_IGNORE_UNMONITORED_GROUPS`,
`BADSESSION_KEEP_ESTABLISHED_AUTH`, `PREVIEW_CARD_HIDE_STORE_TITLE`): env
única, sem redeploy para desligar.

- **Default é LIGADO.** Só o valor **exatamente** `'false'` desliga —
  `'0'`, `'off'`, `'no'` etc. **não têm efeito nenhum** (a leitura é
  `String(process.env.SHEIN_SHORTLINK_ENABLED ?? 'true') === 'false'`).
- **Desligar não para nenhuma oferta de sair.** `shortenSheinLink()` some
  logo no topo (antes de tocar cookie/rede) e devolve `null`; `convert()`
  cai no comportamento de sempre — publica o link **longo** da SHEIN com a
  identidade da cliente aplicada. É a única alavanca de rollback deste
  encurtamento sem precisar reverter código/deploy.
- **Aplicar a env exige `pm2 delete` + `start`**, não `restart --update-env`
  (pegadinha #1 — PM2 cacheia env no `pm2 start`).
- **Guarda de publicação (T090, não regredir):** o `oneLink` devolvido pela
  SHEIN é validado ANTES de publicar — precisa ser string, URL absoluta
  `http(s)` e host aprovado por `isSheinHost` (mesmo princípio do RCA "o
  endereço montado por nós NUNCA pode ser publicado", seção do Mercado
  Livre). Reprovação devolve `null` e cai no link longo; nunca publica
  domínio de fora, caminho relativo ou `[object Object]`. Um `oneLink`
  legítimo (inclusive com parâmetros próprios da SHEIN, ex.: `?ismg_ol=...`)
  continua saindo **exatamente como veio**, sem reescrever nem remover
  parâmetro. Teste: `test/shein-shortlink.test.js`.

## Amazon: a tag PRECISA estar dentro da `longUrl` mandada ao SiteStripe (RCA 2026-07 — não regredir)

**Sintoma:** cliente relatou **zero cliques** no painel de afiliados da Amazon
entre 16 e 23/07, voltando ao normal em 24/07. Não era queda de envio: o
`MessageLog` mostra 100-160 ofertas Amazon/dia saindo com sucesso o período
inteiro, com `tag=` correta no fallback.

**Causa raiz:** em `convert()` (`src/converters/amazon.js`), o caminho de
**produto** mandava ao endpoint `sitestripe/getShortUrl` a `longUrl` crua vinda
de `buildLongUrl` — `https://www.amazon.com.br/dp/<ASIN>`, **sem `?tag=`** —
confiando apenas no query param `tag=` da própria chamada para creditar. O
SiteStripe encurta a `longUrl` **como recebeu**: o `amzn.to` gerado nascia sem
tag de afiliado. A oferta saía bonita, era clicada, e **nenhum clique era
creditado**. O caminho de **cupom** (`convertStoreUrlWithoutAsin`) sempre
embutiu a tag via `withAffiliateTag` — a assimetria entre os dois caminhos era
o próprio bug.

**Correlação que confirmou em produção** (conta `flavia.vale@usp.br`,
tag `fafaciane-20`):

| Período       | Formato do link enviado | Cliques |
|---------------|-------------------------|---------|
| 02/07 – 12/07 | `?tag=` longo (fallback, cookie expirado) | sim |
| 13/07 – 23/07 | `amzn.to` (sessão SiteStripe viva)        | **zero** |
| 24/07 – hoje  | `?tag=` longo (cookie expirou de novo)    | sim |

O atraso de 13/07 (início do `amzn.to`) para 16/07 (zero cliques) é o rastro dos
links `?tag=` antigos ainda circulando nos grupos e morrendo aos poucos.

**Armadilha de diagnóstico (não repetir):** o cookie do SiteStripe expirado
**mascara** o bug — sessão morta força o fallback `?tag=`, que credita
normalmente. Ou seja, **quanto mais saudável a sessão Amazon, pior a comissão**.
Renovar o cookie sem esta correção faz os cliques sumirem de novo. Se um relato
de "parei de receber comissão" coincidir com sessão SiteStripe saudável,
suspeitar disto antes de qualquer outra coisa.

**Não regredir:** nunca mandar `longUrl` sem `?tag=` para o `getShortUrl`, em
NENHUM caminho de conversão. E, como a `longUrl` já carrega a tag, os fallbacks
não podem reanexar `?tag=` (viraria `?tag=x?tag=x`). Testes:
`test/converters-amazon.test.js` ("produto embute ?tag= na longUrl mandada ao
getShortUrl" e "fallback de produto não duplica ?tag=").

**Diagnóstico reutilizável:** `scripts/diag-amazon-clicks.mjs` (estado da
credencial + formato do link enviado por dia + probe ao vivo) e
`scripts/diag-amazon-shortlink-tag.mjs` (segue os `amzn.to` já enviados e lê a
tag final). Os dois são read-only e não imprimem segredo.

## Vitrine `/social/?ref=`: usar o endereço do card, nunca fabricar (RCA 2026-07-28)

Todo `meli.la` de canal resolve para `/social/<handle>?ref=<blob>`, e
`extractFeaturedSocialProduct` (`src/converters/mercadolivre.js`) extrai o
produto do card destacado. Ordem canônica (não inverter):

1. `product_id` no card → `https://www.mercadolivre.com.br/p/<id>` (catálogo);
2. **campo `url` do card → endereço REAL do anúncio** (`extractFeaturedCardUrl`);
3. só então, último recurso, `produto.mercadolivre.com.br/<id>-x-_JM`.

O passo 2 é novo. Antes, card sem `product_id` caía direto no passo 3, que
**fabrica** o endereço: sem hífen depois de `MLB` e com o slug inventado `-x-`.
O endereço real do ML é `produto.mercadolivre.com.br/MLB-<id>-<nome>-_JM`.
Medido em produção: o fabricado respondeu **404** ao ser aberto do próprio VPS,
e essa forma era ~16% dos links de ML de uma cliente (370 em 7 dias) — a cliente
reportou "página não existe". Diagnóstico reutilizável:
`scripts/diag-ml-social-featured.mjs` (lê o mesmo HTML que o robô lê, lista os
campos do card e testa o endereço montado, distinguindo 404 real de muro
anti-robô do ML).

`extractFeaturedCardUrl` só aceita host do próprio ML (o HTML é de terceiro),
exige MLB no caminho, descarta quando o MLB do `url` diverge do `id` do card
(anti-mismatch, mesma filosofia de `validateAffiliateRedirect`) e remove
query/hash. **Não regredir:** não voltar a fabricar endereço antes de tentar o
`url` do card. Testes: `test/mercadolivre-resolve.test.js` (bloco "Endereço do
card destacado").

**Armadilha de diagnóstico:** o ML serve o muro anti-robô
(`suspicious-traffic-frontend` / `/gz/account-verification`) com **status 200**
para quem ele não reconhece. Um `200` num teste de fora do VPS **não prova** que
a página existe — confira o corpo antes de concluir.

### O endereço montado por nós NUNCA pode ser publicado (RCA 2026-08-15)

O RCA acima passou a **preferir** o endereço do card, mas manteve a fabricação de
`produto.mercadolivre.com.br/MLB<id>-x-_JM` como último recurso — e ela continuou
chegando ao grupo. Cliente novo (`matheuschaves308@gmail.com`) reportou "os links
do mercado livre estão dando erro" com print da página **"Tivemos um problema"**;
o mesmo endereço aberto no celular E no computador dá **"Parece que esta página
não existe"**. Em 7 dias, **10 de 79** envios de ML dele saíram como
`produto.mercadolivre.com.br/MLB<id>-x-_JM?partner_id=<tag>` — e gravados como
`success` no painel.

**Por que ficava escondido:** o endereço montado é só a **entrada** da chamada à
API de afiliados, e a API **aceita** (validado ao vivo com a credencial dele:
devolveu `meli.la` funcionando). Quem chega ao grupo é o `meli.la`. Só quando a
chamada falha (código de acesso vencido, 403, 429) o plano B publica o endereço
montado **cru** — e aí o link quebrado vai para o grupo. Isso explica o relato do
cliente ("atualizei o código, voltou a funcionar, caiu de novo"): com a credencial
viva sai `meli.la`, com ela morta sai o endereço quebrado.

**Armadilha de diagnóstico (não repetir):** os 401 do `bot.log` estavam TODOS em
endereços montados, sugerindo que o formato causava o 401. É falso — um teste
controlado com a credencial dele converteu o MESMO endereço montado com sucesso.
O 401 era a credencial; a página de erro era o endereço. **Dois problemas
independentes** que se sobrepunham no log.

**Fix:** `isSyntheticListingUrl` (`src/converters/mercadolivre.js`, pura/exportada)
reconhece exatamente o formato que nós montamos, e `convert()` **retorna `null`**
em vez de aplicar o fallback `partner_id` sobre ele. A guarda é no **publicar**,
não no montar — montar continua valendo como entrada da API (é o que preserva os
links curtos). Melhor não enviar a oferta do que enviar link quebrado, e a linha
vira falha de conversão honesta em vez de `success` mentiroso.

**Não regredir:** não voltar a pendurar `partner_id` em endereço que casa com
`isSyntheticListingUrl`; não confundir com o endereço REAL
(`MLB-<id>-<nome>-_JM`) nem com catálogo (`/p/MLB<id>`), que continuam saindo
normalmente no fallback. Testes: `test/mercadolivre-resolve.test.js` (bloco
"Nunca publicar endereço montado por nós").

**Diagnóstico reutilizável:** `scripts/diag-ml-sends.mjs <email|telefone|nome>`
— read-only, classifica o formato de cada link de ML publicado e marca com ⚠ os
suspeitos (`listing_fabricado`, `vitrine_social`, `cupom_generico`).

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

## SEO orgânico — linhas CONGELADAS por dado (2026-07-30, não reabrir)

Decidido com dado real do Google (Search Console 12m + Planejador com 8.923
termos + Trends). Análise completa em
`docs/marketing/ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`.

**NÃO produzir mais páginas nestas linhas:**

| Linha congelada | Evidência que sustenta |
|---|---|
| LPs por **cidade** (`espelhar-grupos-whatsapp-<cidade>`) | as 15 somaram ~25 impressões em 2,5 meses; 5 delas em zero |
| LPs de **nicho** novo (farmácia, autopeças, pet shop, beleza) | zero impressão em 2,5 meses |
| Cluster **"robô"** como termo próprio | Trends: "robô whatsapp" é 12× menor que "bot whatsapp" |
| **Magalu** como frente nova | único marketplace em queda no Trends |
| `automação whatsapp` / `disparo em massa` | 5.000/mês mas concorrência **alta**, e é mercado de atendimento corporativo (Blip/Wati), não afiliado |

**Não deletar as páginas existentes** — perder link e histórico não ajuda. Só
parar de investir.

**Onde está a demanda real (atacar aqui):** o público **antes** de precisar do
robô. `shopee afiliados`, `mercado livre afiliados`, `afiliado amazon` —
50.000/mês cada, concorrência **baixa**. Contra `bot para grupo whatsapp`, que
tem **500/mês e concorrência alta**. Ordem dos marketplaces: Shopee ≫ Mercado
Livre > Amazon ≫ Magalu.

**Regra de vocabulário:** título e H1 entram pela palavra que o cliente busca
("whatsapp banido", "achadinhos", "afiliado shopee"); o termo próprio da casa
("Módulo de Preservação Avançada", "cadência", "espelhamento") é explicado
**dentro** da página, não usado como porta de entrada.

⚠️ **Limite que não se cruza:** entrar pela palavra "banido"/"anti-ban" **não**
pode virar promessa de que não banem. Corrigir a expectativa dentro da página é
honesto; prometer é risco jurídico e contraria a política de uso responsável já
publicada no `llms.txt`.

## Dados de mercado para marketing (canônico — usar em toda decisão de SEO/conteúdo)

Baseline de **2026-07-30**, fonte: Search Console (12 meses), Planejador de
Palavras-Chave (8.923 termos, Brasil/PT), Google Trends (12 meses, Brasil).
Análise completa em `docs/marketing/ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`.
**Toda conversa de marketing/SEO/conteúdo deve partir destes números — não
re-estimar por sinal de SERP quando este dado real já existe.**

### Tiers de palavra-chave (volume/mês, concorrência)

| Tier | Termos | Volume | Concorrência | Observação |
|---|---|---:|---|---|
| **1 — prioridade máxima** | `shopee afiliados`, `mercado livre afiliados`, `afiliado amazon`/`associados amazon` | 50.000 cada | **Baixa** | maior oportunidade do levantamento |
| 1 | `como se tornar afiliado shopee`, `programa de afiliados shopee` | 50.000 | Média | |
| 1 | `como ser afiliado [shopee/ML/amazon]` | 5.000 cada | Média | |
| 1 | `programa de afiliados mercado livre`, `shopee afiliados entrar` | 5.000 | Baixa | |
| **2 — dor aguda** | `whatsapp banido`, `zap banido`, `número banido whatsapp`, `conta banida whatsapp` | 5.000 cada | **Baixa** | tratar como topo de funil, não venda direta |
| **3 — secundário** | `achadinhos`/`achadinho`, `grupo de ofertas whatsapp`, `grupo de promoções whatsapp` | 5.000 cada | Baixa/Média | ⚠️ quem busca "grupo de ofertas" quer **entrar**, não criar — só serve como isca |
| **4 — estacionado** | `cupom amazon`, `cupom mercadolivre` | 500.000 | Baixa | público é consumidor final, não afiliado — não perseguir agora |
| **5 — evitar** | `bot`/`robô para grupo whatsapp` | 500 | **Alta** | é onde o site tenta competir hoje; não é onde está o volume |

Ordem de prioridade dos marketplaces (Trends, estável salvo Magalu):
**Shopee ≫ Mercado Livre > Amazon ≫ Magalu (em queda)**.

### Baseline do site (Search Console — atualizado 2026-08-16)

| Métrica | 30/07 | **16/08** |
|---|---:|---:|
| Cliques (soma da aba "Países") | 40 | **93** |
| Impressões | 1.102 | **2.902** |
| CTR | 3,63% | 3,20% |
| Posição média (Brasil) | 7,85 | 7,60 |
| Consultas distintas | 13 | **29** ← métrica mais honesta de progresso |
| Páginas com impressão | 60 | 77 |

Compare sempre pela soma da aba "Países" (o painel-resumo dá 41/1.154 em 30/07
porque inclui linhas sem país atribuído — as duas metodologias não se misturam).

**As impressões multiplicaram por 5,3 nas duas semanas seguintes a 04/08**
(183 → 741 → 965 por semana), data em que entraram juntos: desbloqueio do
robots.txt da Cloudflare, IndexNow no deploy, unificação da marca e pedidos
manuais de indexação.

**A página com mais impressões do site hoje é `/bot-achadinhos-whatsapp`** (529),
que em 30/07 tinha 5. Ela e `/alternativas/achadinhos-bot` (226) atendem buscas
pelo **nome de um concorrente** (`achadinhoosbot`/`achadinhosbot`/`achadinhos
bot` = 443 impressões, 15% do total, CTR ~1%). `fluxopromo` e `shozap` já
aparecem também. **As páginas de comparação com concorrente são o motor de
crescimento** — é nelas que vale produzir, não em cidade nem em nicho.

O gargalo mudou de lugar: já há impressão, falta **clique**. Sete páginas somam
464 impressões e ZERO clique (a maior: `/blog/melhores-horarios-para-postar-ofertas-no-whatsapp`,
176 impressões em posição 7,1) — é problema de título/descrição, não de
conteúdo. Celular traz 62% das impressões com CTR de 2,07% contra 5,10% no
computador. Análise completa e lista de ação priorizada em
`docs/marketing/ANALISE_SEO_2026-08-16.md`.

Tier 1 (`shopee afiliados` etc., 50.000/mês, concorrência baixa) segue com
**zero consulta** — não existe página nossa disputando. Maior oportunidade
aberta.

### Concorrentes mapeados

Achadinho Pro, ProAfiliados, FluxoPromo, Shozap, Afilira, AchadinhosBot /
AchadinBot, IA Divulgadora, Devzapp (blog), Shark Pomo Bot, Lumi Ofertas
Inteligentes, Gigi Bot. Preços e planos coletados por print em 2026-07-31 —
ver `docs/marketing/ONDA1_PLANO_DETALHADO.md` (B2) para o detalhe por
concorrente antes de citar preço em qualquer página pública.

### 🔁 Atualizar mensalmente

No começo de cada mês, sugerir à usuária repetir **só o Relatório 1 (Search
Console)** do passo a passo de
`docs/marketing/COLETA_DADOS_KEYWORDS_PASSO_A_PASSO.md` e comparar contra o
baseline acima — principalmente **consultas distintas** e as páginas com muita
impressão e pouco clique. Atualizar esta seção e a data do cabeçalho.

**Não refazer Planejador e Trends todo mês.** Os dois medem volume de mercado,
que não muda em semanas, e as decisões que dependem deles já estão congeladas
(seção "SEO orgânico — linhas CONGELADAS"). Rodada completa dos quatro
relatórios: **a cada ~3 meses** (próxima em outubro/2026). O Relatório 4
(referrals de IA) não precisa mais de coleta manual —
`scripts/diag-origem-cadastros.mjs` já produz.

**Referrals de IA (Relatório 4, baseline zera em 2026-08-04).** O site grava a
origem de toda visita externa no evento `referral_visit` (`AnalyticsEvent`),
classificada por `dashboard/lib/ai-referral.js` em `ai`/`search`/`social`/
`other`. **Só o host do referenciador é gravado, nunca a URL completa** — URL de
buscador carrega o termo pesquisado, que é dado da pessoa; não regredir isso
(guard em `test/ai-referral.test.js`). **Todo evento público passa por TRÊS
allowlists, e faltar em qualquer uma descarta o dado sem erro nenhum:**
`PUBLIC_PERSISTED_EVENTS` (`dashboard/lib/analytics.js`) autoriza o navegador a
enviar, `PUBLIC_ANALYTICS_EVENTS` (`src/analytics.js`) autoriza a rota a aceitar
e `ANALYTICS_EVENTS` (idem) autoriza a gravação. Foi assim que
`organic_page_view` e `organic_cta_click` — as **duas primeiras etapas do funil
canônico** de `docs/marketing/event-taxonomy-v1.md` — ficaram desde 2026-05 sendo
descartadas: estavam só na terceira. O funil de SEO só passava a existir no
`signup_created`, e não havia como separar "ninguém acha a página" de "acham e
não clicam", que pedem consertos opostos. Corrigido em 2026-08-17 (guard em
`test/pagina-achadinhos-clique.test.js`, leitura em
`scripts/diag-paginas-seo.mjs`). Lembre que a allowlist do navegador vai para o
**bundle**: mudança nela só vale depois de `npm run build` no dashboard.
Cuidado ao renomear os campos: `sanitizeAnalyticsMetadata` descarta
qualquer chave que case com `/(token|secret|…|key|url|…)/i`, então algo como
`referrer_url` seria descartado em silêncio.

**Conferir todo mês que a Cloudflare não voltou a bloquear as IAs:**

```bash
curl -s https://espelhagrupos.com.br/robots.txt | grep -c "Disallow: /$"   # 0 = ok
```

O `Managed robots.txt` da Cloudflare veio **ligado por padrão** e colava
`Disallow: /` para GPTBot, ClaudeBot, Google-Extended e CCBot na frente do
`robots.txt` do site — descoberto e desligado em 2026-08-04. Enquanto esteve
ligado, os robôs de *resposta* (OAI-SearchBot, Claude-SearchBot) passavam, mas
os de *indexação/treino* não. Se voltar a ligar, o trabalho de IA para de valer
em silêncio.

## Triagem de novas demandas (implementar agora vs. backlog)

- **Sempre que surgir uma nova demanda**, pergunte à usuária se vamos
  implementá-la agora ou se ela prefere adicioná-la como issue ao backlog.
- Se a escolha for **backlog**, releia este `AGENTS.md` para entender o
  padrão de como as issues devem ser criadas (fluxo `feature → develop →
  main`, convenções de processos, portas, taxonomias e demais regras
  canônicas) antes de redigir a issue.

## Regras para qualquer agente de IA neste repo

- **MEMÓRIA — SUPER SINALIZAR** antes de qualquer mudança que aumente RAM
  (regras completas em "Política de memória" acima — não repetir aqui).
- **Não trocar portas** sem atualizar os 3 lugares em "Ambientes e portas".
- **Não criar PR para `main` direto**, **não amend** em commits já mergeados
  — ver "Fluxo de desenvolvimento" acima.
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
