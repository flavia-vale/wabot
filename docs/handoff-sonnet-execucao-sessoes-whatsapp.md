# Handoff de execução (Sonnet) — sessões WhatsApp caindo

> Este documento é a instrução de execução. A investigação/RCA (feita pelo Opus,
> com evidência da VPS) está em `docs/rca-sessoes-whatsapp-caindo-2026-07.md` —
> **leia esse arquivo antes de começar.** Branch de trabalho:
> `claude/whatsapp-session-stability-pvlpm9` (PR #1169). Todo código novo entra
> por `feature → develop → main`, **validado em staging antes de prod** (AGENTS.md).

## Contexto em uma tela

Dois problemas **independentes**, ambos com causa raiz provada:

- **P1 — Staging cai a cada merge.** Staging está em `BOT_SUPERVISOR_MODE=inline`;
  o deploy roda `pm2 restart api-staging`, que mata os bot-workers forkados →
  sessão cai. Correção: cutover de staging para `remote` (Tarefa A).
- **P2 — Prod: cada cliente cai ~1x/h.** Loop de init-queries: toda conexão
  (`opened connection to WA`) é seguida 60s depois de `unexpected error in 'init
  queries'` (statusCode 408, `fetchProps` sem resposta do WA) → WA encerra o stream
  (500/428) → nosso handler reinicia (`src/bot-worker.js:2005-2043`) → repete.
  Baileys pinado `^6.7.16` (resolvido 6.7.21). Descartado: deploy, memória/GC,
  dupla-posse, versão de fetch. Correção: Tarefa B.

Prod roda em `remote` (workers são filhos do `bot-supervisor`); deploy da API **não**
os toca. **Consequência importante:** mudança em `src/bot-worker.js`/Baileys só entra
em vigor nos workers de prod quando o **`bot-supervisor` é reiniciado** — e reiniciar
o supervisor derruba/reconecta TODAS as sessões de uma vez (é o único jeito de carregar
o código novo). Isso é uma queda **única e planejada** para acabar com as quedas de
hora em hora — deve ser anunciada/agendada, não feita às cegas.

## Ferramenta de medição (baseline antes/depois) — use nos dois ambientes

Mede, por worker, quantas conexões abriram, quantas falharam init-queries (408) e
quantas quedas "estáveis" houve no dia. Ajuste o LOGDIR conforme o ambiente:
- prod: `/home/deploy/BOTinho-shared/logs/bot.log`
- staging: `/home/deploy/wabot-staging-shared/logs/bot.log`

```bash
DAY=$(date +%Y-%m-%d) LOGDIR=/home/deploy/BOTinho-shared/logs node -e '
const fs=require("fs"),rl=require("readline");
const start=new Date(process.env.DAY+"T00:00:00-03:00").getTime();
const r=rl.createInterface({input:fs.createReadStream(process.env.LOGDIR+"/bot.log")});
const p={};const g=k=>p[k]||(p[k]={open:0,q408:0,close:0,codes:{}});
r.on("line",l=>{let o;try{o=JSON.parse(l)}catch{return}if(!(o.time>=start))return;const m=o.msg||"",k=o.pid;
 if(m.includes("opened connection to WA"))g(k).open++;
 else if(m.includes("init queries"))g(k).q408++;
 else if(m.includes("estável fechada")||m.includes("Quedas periódicas")){g(k).close++;if(o.code!=null)g(k).codes[o.code]=(g(k).codes[o.code]||0)+1}});
r.on("close",()=>{let O=0,Q=0,C=0;for(const[k,s]of Object.entries(p)){O+=s.open;Q+=s.q408;C+=s.close;console.log("pid",k,"open="+s.open,"init408="+s.q408,"quedas="+s.close,"codes="+JSON.stringify(s.codes))}
 console.log("\nTOTAIS: opens="+O,"init408="+Q,"quedas="+C,"| ratio 408/open="+(O?(Q/O).toFixed(2):"n/a"))})'
```
**Gate de sucesso do fix:** `ratio 408/open` cai para ~0 e `quedas` por sessão vai a
~0 numa janela de observação de ≥60 min.

---

## Tarefa B (PRIORIDADE — afeta clientes de prod): corrigir o loop init-queries 408

Fazer em **feature branch → develop (staging) → validar → main (prod)**.

### B1. Baseline
Rodar a ferramenta de medição em prod e anotar `ratio 408/open` e `quedas` atuais.

### B2. Escolher a alavanca (testar em staging, uma de cada vez)
Duas hipóteses de correção; comece pela 1, depois a 2 se necessário:

1. **Bump da versão do WhatsApp Web (menor risco primeiro).** O `makeWASocket`
   (`src/bot-worker.js:1730`) usa `version` de `fetchVersionCached()`
   (`:1654`), que chama `fetchLatestBaileysVersion()` (retornou
   `[2,3000,1035194821]`). Testar **fixar uma versão WA conhecida como boa** (ou
   usar a constante embutida do Baileys em vez do fetch "latest"), pois uma versão
   WA que o 6.7.21 não trata bem faz a IQ de props não ser respondida. Baixo risco,
   sem mudar dependência.
2. **Bump da biblioteca Baileys.** `npm view @whiskeysockets/baileys versions` e
   também `npm view baileys version` (a lib foi renomeada de `@whiskeysockets/baileys`
   para `baileys`). Subir para a mais nova estável e testar. Mudança de dependência
   → só via staging.

### B3. Validar em staging
- Merge da feature em `develop` → autodeploy staging.
- **Se staging estiver `inline`:** o deploy reinicia `api-staging` e recarrega o
  código novo automaticamente. **Se estiver `remote`:** reinicie
  `bot-supervisor-staging` para carregar o código novo
  (`pm2 restart bot-supervisor-staging --update-env`).
- Conectar uma sessão em `http://178.105.54.0:3006`, observar ≥60 min, rodar a
  ferramenta de medição (LOGDIR de staging). **Aprovar só se o gate bater.**

### B4. Promover para prod (janela anunciada)
- PR `develop → main`, merge → autodeploy prod (NÃO reinicia o supervisor por default).
- **Passo manual obrigatório para o fix pegar:** reiniciar o supervisor de prod:
  `pm2 restart bot-supervisor --update-env`. **Isso reconecta TODAS as sessões uma
  vez** — anunciar antes. É a troca de "1 reconexão planejada" por "fim das quedas
  de hora em hora".
- Rodar a ferramenta de medição em prod na hora seguinte; confirmar `408/open ~0`.

### B5. Se nenhuma alavanca resolver
Não é infra. Registrar as medições no doc de RCA e escalar como issue de
compatibilidade Baileys↔WA (não mascarar com timeout maior — a resposta nunca chega).

---

## Tarefa A (blindar staging contra queda de deploy): cutover para `remote`

Config, sem código. Respeitar pegadinha #1 (delete+start, nunca `restart --update-env`)
e #9 (sempre a partir de `~/wabot-staging`). Redis `/1` já está de pé.

1. `~/wabot-staging/.env`: trocar `BOT_SUPERVISOR_MODE=inline` → `remote`.
2. `pm2 delete bot-supervisor-staging && cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only bot-supervisor-staging`
   → conferir no log **"modo REMOTE"** + "consumindo comandos" (não `STANDBY`, não `inconsistente`).
3. `pm2 delete api-staging && cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only api-staging && pm2 save`
   → conferir **"Manager em modo REMOTE"**.
4. **Ordem:** supervisor em `remote` ANTES da API voltar (evita janela de dupla-posse).

**Aceite:** conectar sessão em `:3006`; `pm2 restart api-staging` → sessão **fica
conectada**; `ps -eo pid,ppid,cmd | grep '[s]taging/src/bot-worker.js'` → PPID =
`bot-supervisor-staging`.

**Rollback (≤2min):** `.env` volta a `inline` + delete/start `api-staging` +
`pm2 stop bot-supervisor-staging` (auto-standby impede dupla-posse).

> **Memória (AGENTS.md REGRA #1):** manter `bot-supervisor-staging` de pé custa
> ~+100MB baseline (workers migram da api-staging p/ o supervisor; Redis /1 já roda).
> Box com 5.2GB livres — ok, mas registrar. Atualizar AGENTS.md: estado canônico de
> staging passa a `remote`.

---

## Blindagem preventiva de prod (Trilho C do RCA — RAM-neutra)

- ✅ `pm2-logrotate` já instalado (2026-07-01).
- **Guard anti-reversão de modo (código):** no boot da API `production`, se
  `BOT_SUPERVISOR_MODE != remote` **e** houver `waSession status='connected'`, logar
  `error` + `AnalyticsEvent('ops_mode_regression')`. Teste puro em `test/`.
- **Nunca** `pm2 update` / `pm2 restart all` fora de janela (recicla o daemon e
  derruba o supervisor). O guard PID em `deploy_safe_dashboard.sh:451` já aborta o
  deploy se o supervisor reiniciar — manter.

## Proibições (não regredir)

- Nada de mudança direto em prod sem passar por staging.
- Não desligar timeouts do pipeline nem baixar `IMAGE_HTML_MAX_BYTES`.
- Não `redis-cli FLUSHALL`/`del` em filas BullMQ.
- Mudança que aumente RAM significativamente exige sinalizar à usuária antes (REGRA #1).
