# RCA + Plano — "Sessões WhatsApp caindo com frequência" (2026-07-01)

> Investigação feita com evidência coletada na VPS de produção. Este documento
> é o **plano de execução** — quem executa é o Sonnet 5. Opus investigou,
> comprovou e escreveu o plano.

## TL;DR

- **Causa raiz real e confirmada: STAGING está em `BOT_SUPERVISOR_MODE=inline`.**
  Em `inline`, a `api-staging` faz `fork()` dos bot-workers; todo merge em
  `develop` dispara o deploy, que roda `pm2 restart api-staging`, matando os
  workers → **a sessão de staging cai a cada merge.** É a queda que a usuária
  sente no dia a dia (a sessão dela é a de staging).
- **PROD está blindado contra queda por DEPLOY** (modo `remote`: workers são filhos
  do `bot-supervisor`, `pm2 restart api` não os toca — supervisor uptime 28h/0
  restarts atravessou o último merge em `main`). **MAS prod TEM um problema real e
  separado de estabilidade de conexão** (Trilho B abaixo).
- **CAUSA RAIZ das quedas de cliente em prod (CONFIRMADA 2026-07-01): loop de
  init-queries 408.** Cada sessão cai ~11–12x/dia (~1 queda/75–90min): toda conexão
  é seguida 60s depois de `init queries` 408 (`fetchProps` sem resposta do WA) →
  WA encerra (500/428) → reconexão → repete. Não é deploy, não é memória, não é
  dupla-posse. É interação Baileys 6.7.21 ↔ protocolo WA. (Correção de análise
  anterior: o 408 **não** é benigno.)
- A "blindagem" de deploy nunca saiu do ar em prod — **ela nunca foi ligada em
  staging** (por isso staging cai a cada merge).

## Evidência coletada (VPS prod, 2026-07-01)

### Estado de modo
```
PROD    BOT_SUPERVISOR_MODE=remote     REDIS_URL=redis://127.0.0.1:6379/0
STAGING BOT_SUPERVISOR_MODE=inline     REDIS_URL=redis://127.0.0.1:6379/1
```

### Dono dos workers (parentesco de processo) — PROD
Os 6 `bot-worker.js` têm PPID = `bot-supervisor` (158730), **não** a API (168464).
→ Prod em `remote` efetivo; deploy da API não derruba sessões.

### Restarts / uptime
- `bot-supervisor`: restarts=0, uptime 26.1h. Sobreviveu ao último merge em `main`
  (#1163, 30/06 17:47 UTC); a `api` reiniciou às 17:50 UTC (uptime 22h) e o
  supervisor **não** reiniciou.
- `api-staging`: restarts=9/18h (cada deploy em develop).

### Assinaturas de queda no `bot.log` (835MB, ~1.5M linhas)
```
connectionReplaced        0
stream error / 515        0   (515 aparece só no handshake de pareamento, esperado)
conflict / 440            0
worker_restart            0
Bad MAC / badSession/500  0
logged out / 401          0
connection closed         103  (dias; recentes = todos pareamento pré-código→515)
init-queries 408          14767 (ruído: socket permanece aberto)
```

### Memória
Box 7.6GB, **swap 4GB presente (0 em uso)**, 5.2GB disponíveis. Heap cap
`--max-old-space-size=384` aplicado por worker. RSS por worker 153–481MB
(o mais velho a 481MB; RSS inclui buffers de mídia, não só heap). Sem OOM/SIGKILL.

### Staging após tentativa manual de cutover
`bot-supervisor-staging` foi iniciado e `api-staging` recriada, **mas sem trocar o
`.env`**. Resultado correto do código: supervisor em **STANDBY**
(`supervisorManagesSessions` retorna false em `inline`), api em `inline`. Sem
dupla-posse (o guard de código funcionou), mas **staging segue não-blindado**.

## Por que o código já estava certo (não regredir)

- `src/supervisor/index.js:96` — só assume sessões se `BOT_SUPERVISOR_MODE=remote`;
  senão entra em STANDBY (vivo, sem fork/resume/health/consumo de comandos).
- `src/supervisor/envGuard.js` — `supervisorManagesSessions()` +
  `checkSupervisorEnvConsistency()` (fail-fast contra cwd/Redis errados).
- `src/manager.js:19` — a API escolhe inline vs remote pela mesma flag.
- Deploy scripts (`deploy_safe_dashboard.sh`, `deploy_safe_staging.sh`) **não**
  reiniciam o supervisor (`RESTART_SUPERVISOR=0`), preservam ele em migrations
  (`PRESERVE_SUPERVISOR_DURING_MIGRATION=1`) e o prod tem guard PID que **aborta
  o deploy** se o supervisor reiniciar (`deploy_safe_dashboard.sh:451`).

Tudo isso só protege **quando o modo é `remote`**. Em `inline`, o vetor de queda
é o `pm2 restart api[-staging]` do deploy.

---

## PLANO DE EXECUÇÃO (Sonnet 5)

### TRILHO A — Blindar STAGING (correção da causa raiz)

Pré-req já OK: Redis `/1` responde PONG; `bot-supervisor-staging` presente no
`ecosystem.config.cjs`; arquivos do supervisor em `~/wabot-staging/src/supervisor/`.

1. Editar `~/wabot-staging/.env`: `BOT_SUPERVISOR_MODE=remote` (Redis já `/1`).
2. Recriar o supervisor **do diretório de staging** (pegadinha #1 e #9):
   ```bash
   pm2 delete bot-supervisor-staging
   cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only bot-supervisor-staging
   ```
   Conferir no log: **"Manager/bot-supervisor … modo REMOTE"** e **"consumindo
   comandos"**; **não** pode aparecer `STANDBY` nem `ambiente inconsistente`.
3. Recriar a API de staging pegando a env nova (delete+start, **nunca**
   `restart --update-env`):
   ```bash
   pm2 delete api-staging && cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only api-staging && pm2 save
   ```
   Conferir no log da `api-staging`: **"Manager em modo REMOTE"**.
4. **Ordem importa**: supervisor em `remote` **antes** da API voltar em `remote`
   (evita janela de dupla-posse durante a transição).

**Aceite (prova de que blindou):**
- Conectar a sessão em `http://178.105.54.0:3006`.
- `pm2 restart api-staging` com a sessão conectada → **sessão continua conectada**.
- `ps -eo pid,ppid,cmd | grep '[s]taging/src/bot-worker.js'` → PPID = pid do
  `bot-supervisor-staging` (não da `api-staging`).

**Rollback (≤2min):** `BOT_SUPERVISOR_MODE=inline` no `.env` + delete/start
`api-staging` + `pm2 stop bot-supervisor-staging`. Auto-standby garante ausência
de dupla-posse mesmo com o supervisor de pé.

> **⚠️ Política de memória (REGRA #1):** manter `bot-supervisor-staging` de pé
> permanentemente custa **≈ +100MB de baseline** (os workers apenas migram da
> `api-staging` para o supervisor — mesma contagem/RSS; Redis `/1` já roda). No
> box com 5.2GB livres é trivial, mas fica registrado.
> **Alternativa mais leve (0 RAM):** manter staging `inline` e aceitar a queda no
> deploy, subindo staging só durante validação (botão liga/desliga). Não blinda —
> só convive. **Recomendação: mover para `remote` (blindagem real).**

### TRILHO B — PROD: init-queries 408 → queda periódica (CAUSA RAIZ CONFIRMADA, prioridade alta)

**Correção do diagnóstico anterior:** o 408 init-queries **NÃO é benigno**. A
telemetria de ciclo de vida (2026-07-01) provou que ele derruba as sessões.

**Evidência (hoje, prod):** cada sessão de cliente caiu ~11–12x no dia
(158808:9, 158811:12, 170219:12, 178384:11), ~1 queda/75–90min. **Toda** conexão
(`opened connection to WA`) é seguida 60s depois de `unexpected error in 'init
queries'` (statusCode 408, `executeInitQueries → fetchProps → waitForMessage`), e
em seguida o WA encerra o stream com code 500/428 → nosso handler reinicia
(`bot-worker.js:2005-2043`, "Quedas periódicas de sessão WA estável"). Correlação
perfeita: `open == init408` nas sessões estabelecidas; `init408=0 → quedas=0`.

**Descartado com dado:**
- Versão WA: `fetchLatestBaileysVersion` → `[2,3000,1035194821]` isLatest:true (rede OK).
- Memória/GC: workers recém-abertos (RSS baixo) também tomam 408 na 1ª conexão → não é GC.
- Deploy / dupla-posse / logout: fora (uptimes estáveis; connectionReplaced=0).

**Causa raiz:** Baileys `^6.7.16` (resolvido 6.7.21) manda a IQ de init props e
**não recebe resposta** do WA → timeout de 60s (`defaultQueryTimeoutMs`) → sessão
meio-inicializada → WA encerra (500/428) → loop de reconexão. Interação
biblioteca↔protocolo WA, não infra. Idêntico em prod e staging.

**Fix (validar SEMPRE em staging antes de prod — é mudança de dependência):**
1. **Primário — bump do Baileys.** Testar a versão mais nova da linha 6.7.x/6.8.x
   (checar changelog/issues por correção de `fetchProps`/init-queries no protocolo
   WA `2.3000.x`). Critério de sucesso em staging: `init queries` 408 some e a
   sessão fica `ready` estável (sem `quedas`).
2. **Se o bump não resolver — tornar a init-query não-fatal.** Avaliar opções do
   `makeWASocket` (`bot-worker.js:1730`) na versão instalada (ex.: desabilitar/relaxar
   o fetch de props se a API do Baileys permitir). Aumentar `defaultQueryTimeoutMs`
   **não** resolve (a resposta nunca chega; só adia a falha).
3. **Band-aid já presente (manter):** o cooldown de 30min
   (`RECONNECT_STABLE_CLOSE_COOLDOWN_MS`) reduz o spam de "A sincronização foi
   concluída", mas o cliente segue offline entre quedas — não substitui o fix.

**Higiene (RAM-neutra):** baixar o nível do log de init-queries em
`instrumentBaileysLoggerForHealth` (`bot-worker.js:929`) — hoje são ~milhares de
linhas/dia inflando o `bot.log` (já mitigado parcialmente pelo logrotate).

### TRILHO C — Blindagem preventiva de PROD (RAM-neutra)

- ✅ **`pm2-logrotate` instalado** (100M / retain 10 / compress) — feito em 2026-07-01.
- **Guard anti-reversão de modo (código, na branch):** no boot da API com
  `APP_ENV=production`, se `BOT_SUPERVISOR_MODE != remote` **e** houver
  `waSession` com `status='connected'`, emitir `logger.error` +
  `AnalyticsEvent('ops_mode_regression')`. Pega o `.env` derivando de volta para
  `inline` sem susto silencioso. Teste unitário puro (sem DB) em `test/`.
- **Runbook:** nunca `pm2 update` / `pm2 restart all` fora de janela — é o único
  vetor que derruba prod em massa hoje (recicla o daemon e reinicia o supervisor).
  O guard PID em `deploy_safe_dashboard.sh:451` já aborta o deploy se o supervisor
  reiniciar; manter.

### TRILHO D — Documentação (não regredir)

- Atualizar `AGENTS.md`: **estado canônico de staging passa a `remote`** (o
  auto-standby + envGuard eliminaram a dupla-posse que motivou o `inline`).
  Registrar o custo de RAM (+~100MB) e o guard anti-reversão como invariante.

## Critérios de aceite (feito = verificado)

- [ ] Staging: `pm2 restart api-staging` com sessão conectada **não** derruba a sessão.
- [ ] Staging: workers com PPID = `bot-supervisor-staging`.
- [ ] Staging: log da API mostra "Manager em modo REMOTE"; supervisor sem STANDBY.
- [ ] Prod: supervisor segue 0-restart após o próximo deploy em `main` (guard PID verde).
- [ ] (Se Trilho B) `defaultQueryTimeoutMs` validado em staging antes de prod.
- [ ] Guard anti-reversão com teste passando.
- [ ] `AGENTS.md` atualizado.
