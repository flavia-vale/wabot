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
- **PROD está blindado e NÃO está perdendo sessões estabelecidas.** Prod roda em
  `remote`: os bot-workers são filhos do `bot-supervisor` (não da API), então
  `pm2 restart api` no deploy não os toca. Evidência de log: `logged out = 0`,
  `connection closed = 103` (em dias, dominado por handshakes de pareamento),
  `worker_restart = 0`, `conflict/connectionReplaced = 0`, `Bad MAC = 0`.
- **O "408" que aparece 14.767x no `bot.log` é ruído benigno**: init-queries do
  Baileys (`executeInitQueries → fetchProps`) estouram timeout com o socket **de
  pé** — o erro é engolido e a sessão continua. Não é queda; é o que inflou o
  `bot.log` para 835MB.
- A "blindagem" nunca saiu do ar em prod — **ela nunca foi ligada em staging.**

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

### TRILHO B — PROD: silenciar o 408 (opcional, RAM-neutro, baixo risco)

O 408 init-queries é ruído benigno (não derruba sessão). Duas opções, validar em
staging antes de prod:

- **Reduzir o ruído/os retries** definindo `defaultQueryTimeoutMs` explícito e mais
  folgado no `makeWASocket` de `src/bot-worker.js:1730` (hoje usa o default do
  Baileys). Não muda comportamento de sessão; só evita init-queries estourarem por
  latência VPS↔WA e enchendo o log.
- **Baixar o nível de log** do erro de init-queries (via
  `instrumentBaileysLoggerForHealth`, `src/bot-worker.js:929`) para não poluir o
  `bot.log`. Higiene, não estabilidade.

Só entrar aqui se houver relato concreto de queda de prod em horário específico —
caso contrário, é apenas limpeza de log (já mitigada pelo logrotate).

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
