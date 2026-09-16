# Revisão independente da POC de shard (economia de RAM) — 2026-09-16

> Revisão do que já está em `develop` (PRs #1692 e #1695, commits `7d93bc5f`,
> `59f0b7a5`, `f45c6b8d`) contra o que os dois documentos prometem:
> `docs/diagnostico-rss-sessoes-whatsapp-2026-09-13.md` e
> `docs/poc-shard-4-sessoes-teste-controlado.md`.
> Nenhuma linha de produção foi alterada por esta revisão — é só leitura.

## 0. Resumo em quatro linhas

1. **O QUE ACONTECEU:** o pedaço mais arriscado do plano (multi-sessão no mesmo
   processo) já está mergeado em `develop`; o pedaço barato e reversível
   (log, Sharp, caches, cancelamento) não foi feito.
2. **PORQUE:** a ordem P1 → P2 do próprio diagnóstico foi invertida, e o painel
   entregue não tem baseline, gates automáticos, manifesto nem script de volta —
   coisas que o plano chama de obrigatórias antes de apertar o botão.
3. **O QUE DEVE SER FEITO:** segurar o canário em produção, corrigir 5 defeitos
   que derrubam processo (lista §1), fazer a medição de 10 minutos que decide o
   projeto (§4.B) e executar o P1 antes de densificar.
4. **COMO:** a ordem prática está em §6.

## 1. Defeitos que podem derrubar produção

### 1.1 O shard roda sem guarda de crash — 4 sessões caem juntas

`installWorkerCrashGuards` passou a ser condicionado a `registerProcessHandlers`,
que **só o worker dedicado passa como `true`**. O `session-shard-worker.js` não
instala guarda nenhuma.

O guard existe exatamente para o caso documentado no AGENTS.md: um `throw`
assíncrono benigno do Baileys (428 "Connection Closed" disparado por
`sendRetryRequest` depois de um 440) não pode matar o processo. Sem ele, no
Node 22 um `unhandledRejection` **encerra o processo** — e no shard esse
processo carrega até quatro contas.

É a hipótese **H6** do plano ("crash amplia o blast radius") sem nenhuma
mitigação implementada.

**Correção:** instalar `installWorkerCrashGuards` no `session-shard-worker.js`
(nível de processo) e fazer erro de um tenant virar `stopSession(userId)` em vez
de exceção que escapa.

### 1.2 `exitRuntime` no shard é um `throw` disparado de dentro do pipeline

```js
exitRuntime: code => { throw Object.assign(new Error(...), { code: 'SESSION_EXIT' }) }
```

`loadConfig()` chama `exitRuntime(0)` quando o acesso da cliente venceu. No
worker dedicado isso era `process.exit(0)` (saída limpa). No shard vira uma
exceção lançada de dentro de um caminho assíncrono — que, sem 1.1, derruba as
quatro sessões porque **uma** cliente ficou com o plano vencido.

**Correção:** `exitRuntime` no shard deve agendar `runtime.stopSession(userId)`,
nunca lançar.

### 1.3 `createShardProcessController` não escuta `error` do processo filho

`child.on('message')` e `child.once('exit')` existem; `child.on('error')` não.
Um evento `error` sem listener num `EventEmitter` **lança no supervisor** — e o
supervisor é dono das 37 sessões. Um EPIPE no `child.send()` basta.

**Correção:** `child.on('error', err => { logger.error(...); ready = false })`.

### 1.4 `ensureStarted()` não tem trava de concorrência

Com `child === null`, dois `start(userId)` simultâneos executam `forkImpl` duas
vezes; a segunda sobrescreve `child` e o **primeiro processo shard fica órfão**,
sem referência para parar — potencialmente já tendo aberto credencial.

**Correção:** memorizar a promise de boot (`let booting = null`) e reaproveitá-la.

### 1.5 Formato de métricas divergente aciona restart indevido da sessão

`GET_BOT_METRICS` para sessão no shard devolve `pocShard.sessionMetrics(userId)`
— o snapshot do contexto — enquanto o worker dedicado devolve
`{...sendQueueMetrics, incomingQueue, sessionHealth, reception, chatScope, worker, runtime}`.
Faltando a chave `worker`:

- `classifyWorkerHealth()` (`src/workerHealth.js:17`) devolve
  `status:'stale', reason:'worker_metadata_missing', restartRecommended:true`;
- `restartStaleWorkerIfNeeded` então faz `stopBot` + `startBot` sempre que a
  cliente salva credencial da **Amazon**;
- a conta canário escolhida (`flavia.vale@usp.br`) é justamente uma conta com
  Amazon cadastrada.

Junto disso, `GET /dashboard/status` devolve esse objeto no campo `queue` — a
tela do painel da cliente passa a ler um formato que não existe.

**Correção:** o shard tem que devolver **o mesmo objeto** do worker dedicado
(`engine.command('metrics')`), não o snapshot do contexto.

## 2. Defeitos que corrompem a verdade do banco

### 2.1 Três caminhos escrevem `status: 'connected'` sem checar conexão

- `boot()` do supervisor, na reconciliação de owner órfão;
- `moveToShard()` no sucesso;
- `rollback()`, nos dois ramos (inclusive no atalho idempotente).

O heartbeat do worker dedicado **é enviado também quando a sessão está caída**
(é o mecanismo do `lifecycle: 'reconnecting'`), e `waitForBotHeartbeat` só olha
`lastHeartbeatAt`. Ou seja: uma sessão desconectada pode ser gravada como
`connected`.

`WaSession.status` não é cosmético neste produto — alimenta o painel admin,
`resolveSessionOwner`, o guard `ops_mode_regression` (que compara
`status='connected'` com o modo do supervisor), o funil de ativação e o card
"sem receber".

**Correção:** operação de posse escreve `ownerInstance` e `lifecycle`. `status`
é do worker.

### 2.2 A reconciliação de órfão no boot não filtra o shard lógico

```js
db.waSession.findMany({ where: { ownerInstance: { startsWith: 'shard:' } } })
```

Sem `belongsToThisShard`. Com `SHARD_COUNT > 1` cada supervisor reivindicaria as
sessões dos outros no boot. Hoje é 1, então é latente — mas o repositório já tem
suporte a shard lógico e o erro é silencioso.

### 2.3 Falha no meio do handoff perde o lifecycle anterior

O `catch` de `moveToShard` grava `lifecycle: 'reconnecting'`, não o valor que
existia antes. Como não existe manifesto persistido (§3.1), não há de onde
restaurar o estado real.

## 3. O que o plano exige e o código não tem

| Item do plano | Situação |
|---|---|
| `WaShardExperiment` / `Member` / `Sample` / `Event` | **não existe** nenhuma tabela |
| Máquina de estados + `version` (compare-and-swap) | só `lifecycle` como semáforo improvisado |
| Amostras a cada 15 s persistidas | **não existem** — o painel só mostra "agora" |
| Baseline dedicado congelado (2 h, p50/p95) | **não existe** |
| Gates automáticos e rollback por gate | **não existem** |
| `WA_SESSION_SHARD_POC_MAX_RSS_MB` | documentado e **nunca lido pelo código** |
| `WA_SESSION_SHARD_POC_MAX_EVENT_LOOP_P95_MS` | idem |
| Pre-flight do painel (14 itens) | só checa `status`/`lifecycle` do membro |
| `Idempotency-Key` + confirmação textual | **ausentes** |
| `AdminAuditLog` com before/after | escrito **antes** da ação e sem before/after |
| `scripts/shard-poc-rollback.mjs` | **não existe** |
| Resposta assíncrona de verdade | rota devolve `202` mas **aguarda** o handoff inteiro |

Sem amostras e sem baseline, **o critério de aprovação do próprio plano
("economia p50 ≥ 25%") é incalculável** com o que está no ar.

### 3.1 O `202` que não é assíncrono

`POST /shard-poc/members/:userId/start` faz `reply.code(202).send(await moveSessionToShard(...))`.
O comando tem timeout de 90 s (`SHARD_MOVE_SESSION`), maior que o timeout
habitual de proxy/HTTP. O operador pode perder a resposta **no meio de uma troca
de posse de credencial** e ficar sem saber em que estado a conta está — que é o
pior momento possível para ficar cego. O plano pede explicitamente "não bloquear
a requisição HTTP até o final".

## 4. Onde eu discordo das decisões

### 4.A A ordem foi invertida — P2 entrou, P1 não

O diagnóstico coloca P1 (instrumentação, log, caches, Sharp, thumbnail,
`AbortSignal`) **antes** de P2 (densificação). Foi mergeado só o P2. Conferido
no código de hoje:

- `src/bot-worker.js:3461` continua com
  `logger.info({ jid, monitorGroups: cfg.groups.monitor }, 'mensagem recebida')`
  — o array inteiro de grupos monitorados, por mensagem;
- `src/logger.js:14` continua com `pino-pretty` como transport em produção;
- não há `sharp.cache({...})` nem `sharp.concurrency(1)` em lugar nenhum;
- `shouldSyncHistoryMessage: () => false` não foi adicionado;
- `imageCache` continua sem cap/poda;
- não há `AbortController`/`AbortSignal` na fila nem na rede.

Todos são horas de trabalho, risco quase zero, reversíveis por env, e atacam
justamente `external`, pressão de GC e disco. Fazer o P2 antes do P1 significa
medir o shard com o ruído do P1 ainda dentro da medição.

### 4.B A economia provável está no limite do critério de reprovação

Com 293 MiB por sessão e uma base fixa de processo Node + Baileys + Prisma +
Sharp na casa de 90–130 MiB, 4 sessões num shard dão ~0,9 GiB contra 1,17 GiB
em workers dedicados — **cerca de 25%**, que é exatamente o piso abaixo do qual
o próprio plano manda reprovar.

Existe um experimento de dez minutos que decide o projeto inteiro **antes** de
qualquer troca de posse em produção:

```text
RSS(shard com 1 sessão) − RSS(worker dedicado com 1 sessão)  → custo fixo do shard
RSS(shard com 2 sessões) − RSS(shard com 1 sessão)           → custo incremental real
```

Se o incremento da segunda sessão vier perto de 250 MiB, não há o que testar com
quatro, e o risco de multi-tenancy deixa de se justificar. Essa medição não
precisa de handoff, nem de conta de cliente: basta subir o shard com uma conta
de staging.

### 4.C Canário em produção antes do caminho de volta estar pronto

O plano diz, no item 16: *"o caminho de volta precisa estar implementado e
testado antes do botão que inicia o teste ser habilitado"*. Hoje o rollback
existe em código, mas: não tem manifesto, não tem script fora do painel, não
tem teste de integração com processo real e **nunca rodou uma vez** — todos os
testes usam runtime falso. Habilitar `WA_SESSION_SHARD_POC=enabled` em produção
nesse estado inverte a regra que o próprio documento criou.

### 4.D A refatoração do worker inteiro precisa de duas redes de segurança

Todo `src/bot-worker.js` (≈5 mil linhas) virou o corpo de
`createBotSessionRuntime`. O que faz o worker dedicado continuar existindo é:

```js
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { ... }
```

O ESM do Node resolve symlinks; `process.argv[1]` não. Se o diretório de deploy
passar a ser symlink (padrão comum de release), essa comparação falha e **todo
worker dedicado sobe e não faz nada, em silêncio** — 37 sessões mudas, sem erro
no log. Comparar `realpathSync(process.argv[1])` custa uma linha.

E não existe **nenhum** teste que prove a premissa da POC: `createBotSessionRuntime`
nunca foi chamada duas vezes no mesmo processo em teste algum. Os testes cobrem
só runtimes falsos. Faltam dois testes: (i) o worker dedicado sobe e emite
heartbeat; (ii) dois contextos reais coexistem sem cruzar estado.

### 4.E Hibernação foi descartada rápido demais

O documento acerta que não dá para acordar por mensagem. Mas os próprios números
dele dizem: 146 sessões persistidas, **110 desconectadas**, 15 paradas pela
cliente, e uma divergência de 47 `ready` contra 36 `connected`. Antes de aceitar
o risco de multi-tenancy vale medir quantos dos 37 workers vivos pertencem a
conta com acesso vencido, parada de propósito ou sem nenhuma origem monitorada.
Não ter worker é 100% de economia, sem blast radius.

### 4.F O default de `WA_SESSION_SHARD_POC` deveria ser `off`

O plano chama `observe` de fail-closed, mas o supervisor usa `observe` como
**default**: uma VPS sem a env já nasce com a rota e o painel ligados. O padrão
do repositório para interruptor de rollout (`COUPON_BRAND_CARD_ENABLED`,
`WA_IGNORE_UNMONITORED_GROUPS`, `BADSESSION_KEEP_ESTABLISHED_AUTH`) é nascer
desligado.

## 5. Impactos colaterais que precisam ser anunciados

### 5.1 O log deixa de ser diagnosticável — este é o custo escondido do shard

`src/logger.js` exporta um singleton sem `userId`, e `bot-worker.js` o usa
direto. Com quatro tenants intercalando linhas no mesmo `bot.log`, praticamente
todos os RCAs do histórico deste produto ficariam impossíveis de refazer: grupo
dessincronizado, mensagem travada por `msgId`, bytes de miniatura por origem,
código velho nos bots, recepção cega.

**Correção obrigatória antes do degrau B:** `logger.child({ userId })` por
contexto, propagado para dentro do runtime da sessão.

### 5.2 Mergear isto em `main` reconecta as 37 sessões

O diff toca `src/bot-worker.js`, `src/core/`, `src/supervisor/` e
`src/manager.js` — todos dentro de `WORKER_CODE_PATHS_RE`. O deploy de produção
vai reiniciar o `bot-supervisor` e **reconectar a frota inteira de uma vez**.
Precisa ser anunciado e agendado.

Detalhe menor: `src/session-shard-worker.js` **não** está em
`WORKER_CODE_PATHS_RE`; uma mudança só nesse arquivo não dispararia restart.

### 5.3 `protocol.js` é `[PROTECTED_CORE]` e ganhou três comandos

A mudança é aditiva (não quebra `decodeEvent`), então não exige bump de
`PROTOCOL_VERSION`. Mas enquanto o supervisor não for reiniciado, `shard:*`
responde `Comando desconhecido` e o painel mostra esse texto cru. Vale tratar
essa resposta como "supervisor ainda não tem a POC" em linguagem clara.

### 5.4 O painel custa caro a cada 5 segundos

`GET /shard-poc/overview` faz, por chamada: `user.findMany` com join de sessão,
dois `messageLog.groupBy` de 24 h sobre todos os conectados, dois `findMany` de
200 linhas, quatro `getBotMetrics` e um `getShardMetrics` — e a tela repete tudo
a cada 5 s enquanto estiver aberta. Em SQLite de 478 MB com 37 workers
escrevendo, é candidato direto a `SQLITE_BUSY` (o produto tem sinal próprio para
isso: `ops_sqlite_busy`).

Sugestões: subir o intervalo para 15 s (é o período de amostragem que o próprio
plano define), separar a rota cara (seleção/atividade, cache de 60 s) da rota
barata (métricas do shard) e limitar a janela de `MessageLog`.

### 5.5 Semáforo global + timeout que não cancela = oferta perdida

O shard serializa Sharp em 1 e scraping em 2 **entre tenants**, enquanto a fila
de entrada continua com `MSG_QUEUE_TIMEOUT_MS` de 25 s **que não aborta o
trabalho** (é a H5 do próprio documento, não corrigida). A espera na fila do
semáforo conta contra o timeout: mensagem vira `timeout:incoming`, a oferta se
perde, e o trabalho abandonado continua segurando buffers.

Isso vai acontecer no degrau C e será atribuído erradamente ao multi-tenancy.
`AbortSignal` (P1) precisa vir antes do semáforo compartilhado.

### 5.6 Outros

- `pocShard.start` **contorna** o circuit breaker (`MAX_SESSIONS_PER_PROCESS`),
  o restart budget e a quarentena de sessão.
- `LIST_RUNNING_BOTS` virou N round-trips de IPC; se o shard demorar, a contagem
  que alimenta o circuit breaker e o aviso "vagas acabando" pode estourar o
  timeout do comando.
- O rollback automático por membro mora dentro de `healthMonitorTick`, que
  **não tem trava de reentrância** e agora pode bloquear até ~45 s por membro
  (≈3 min com quatro). Esse tick é quem ressuscita a frota inteira.
- `flavia.vale@usp.br` está hardcoded na query da rota admin, além da constante
  em `src/ops/shardPoc.js`.
- `WA_SHARD_SESSION_FACTORY_MODULE` permite carregar módulo arbitrário por env;
  é superfície nova sem uso fora de teste.

## 6. Defeitos menores de robustez

1. `BaileysSessionContext.start()`: se a factory devolve runtime inválido, o
   objeto já criado **não é parado** (`this.runtime` ainda é `null`) — socket
   pode ficar aberto sem dono.
2. Contexto que falha fica em `failed`; a tentativa seguinte sempre lança uma vez
   antes de limpar o mapa. Deveria limpar e reaproveitar.
3. `SessionShardRuntime.drain()` liga `draining` e nunca desliga: shard drenado
   nunca mais aceita sessão sem reiniciar o processo.
4. O histograma de event loop **nunca é resetado** — p95 vira estatística
   vitalícia e nunca se recupera de um pico. O gate "p95 acima de 250 ms por 2
   minutos" não pode funcionar assim. Some-se que há cinco monitores por shard
   (um por sessão + um do runtime) medindo exatamente a mesma coisa.
5. O shard forka **sem `resolveWorkerExecArgv`**: não tem
   `--max-old-space-size`. Quatro sessões rodam com heap padrão do V8 (na casa
   de GiB numa VPS de 15 GiB), justamente no processo onde o teto importa mais.
6. `process.exit()` logo depois de `process.send({type:'SHARD_STOPPED'})` pode
   perder a mensagem.
7. `dedicated.drain: async () => true` é um stub: o passo "pedir drain do worker
   dedicado" do plano não existe (a drenagem real acontece dentro do `shutdown`
   do worker — funciona, mas o passo documentado é fictício).
8. O teste `test/bot-worker-retry-cache-wiring.test.js` continua verde, mas o
   nome ("escopo de módulo") ficou mentiroso: os caches agora são por sessão.
   Por tenant é o comportamento **certo** para shard — mas o texto do AGENTS.md
   sobre "escopo de módulo" precisa ser atualizado junto.

## 7. O que está bem feito (não regredir)

- **A exclusão de posse está correta.** `moveToShard` bloqueia comandos, para o
  dedicado, **espera o exit real** e recusa abrir no shard se o PID não saiu.
  É a invariante mais importante do plano e foi implementada como pedido.
- Os dois laços de ressurreição (boot e health monitor) ganharam filtro de
  `lifecycle` `moving*`/`restoring*` e de `ownerInstance` `shard:*` — sem isso
  haveria dupla posse durante a janela do handoff.
- A reconciliação de órfão no boot é a decisão certa: shard é filho do
  supervisor, logo owner `shard:*` depois de restart é órfão por definição.
- O rollback por membro dentro do health monitor limita o raio de dano quando
  uma sessão sai do shard.
- O kill switch é verificado **no supervisor** (não só na API), que é onde
  precisa ganhar.

## 8. Ordem recomendada

**Antes de qualquer canário em produção:**

1. Corrigir §1.1 a §1.5 (os cinco que derrubam processo).
2. Corrigir §2.1 (parar de escrever `status: 'connected'` por bookkeeping).
3. `logger.child({ userId })` (§5.1) — sem isso não há como investigar nada.
4. Endurecer o guard de `argv[1]` com `realpathSync` e adicionar os dois testes
   que provam a premissa (§4.D).
5. Fazer a medição de 1 → 2 sessões em staging (§4.B). **Se o incremento passar
   de ~180 MiB, encerrar a POC aqui** e ir só para o P1.

**Se a medição justificar continuar:**

6. Executar o P1 inteiro (log por mensagem, `pino-pretty`, `sharp.cache`/
   `concurrency`, `shouldSyncHistoryMessage`, cap do `imageCache`,
   `AbortSignal`) e **remedir** — parte da economia pode aparecer sem shard.
7. Implementar amostragem de 15 s persistida + baseline congelado + gates
   automáticos (§3). Sem isso não há como aprovar nem reprovar.
8. Escrever `scripts/shard-poc-rollback.mjs` e **testá-lo** antes de habilitar
   o botão.
9. Tornar o start realmente assíncrono (`202` + consulta de status).
10. Só então degrau A (1 sessão, 2 h) → B (2, 6 h) → C (4, 24 h).

**Independente da POC:** documentar no `AGENTS.md` o novo contrato de
`createBotSessionRuntime`, o guard de `argv[1]`, as envs da POC e a invariante
"o shard nunca abre credencial sem exit confirmado do dedicado". Hoje nada disso
está lá, e é o tipo de conhecimento que o projeto perde entre sessões.

---

## 9. Medição executada em 2026-09-16 (substitui as projeções acima)

Rodada no VPS, em staging, com o shard real (`src/session-shard-worker.js`) e a
única conta conectada de staging. Todos os números em **PSS** (mediana da
janela), que é a métrica honesta para somar processos — RSS conta a mesma
página compartilhada uma vez por processo.

### 9.1 Os três números

| Medida | PSS | RSS | amostras |
|---|---:|---:|---:|
| Shard **vazio** (custo fixo, `F`) | **89,6 MiB** | 148,4 MiB | 44 |
| Shard com **1 sessão** | **333,1 MiB** | 398,9 MiB | 120 (20 min) |
| Worker **dedicado** de produção (`D`, média de 42) | **218 MiB** | 314 MiB | 42 processos |

### 9.2 O que isso significa

| | custo da sessão |
|---|---:|
| dentro do worker dedicado (`D − F`) | **128 MiB** |
| dentro do shard | **244 MiB** |

**A sessão custa 90% a mais dentro do shard.** Com esse número, consolidar
**gasta mais memória** do que manter um processo por sessão:

| Sessões | Shard | Dedicados | Resultado |
|---|---:|---:|---|
| 2 | 577 MiB | 436 MiB | **−32%** |
| 4 | 1.064 MiB | 872 MiB | **−22%** |
| 8 | 2.038 MiB | 1.744 MiB | **−17%** |

Para a POC **empatar** com 4 sessões, a sessão no shard precisaria custar menos
de **196 MiB**; para entregar os 25% do critério, menos de **141 MiB**. Medido:
**244 MiB**.

A comparação ainda favorece o shard: a sessão medida é de **staging** (tráfego
baixo), contra a média de 42 sessões de **produção** em uso real.

### 9.3 A hipótese do teto de heap está DESCARTADA

A revisão (§6.5) apontou que o shard é forkado sem `resolveWorkerExecArgv`,
logo sem `--max-old-space-size=384`, e levantou isso como possível causa do
excesso. **A medição derruba a hipótese:**

| | vazio | 1 sessão | delta |
|---|---:|---:|---:|
| `heapTotal` | 36,9 MiB | 47,6 MiB | +10,7 |
| `heapUsed` | 34,7 MiB | 44,0 MiB | +9,3 |
| `external` | 3,7 MiB | 8,4 MiB | +4,7 |
| **PSS** | 89,6 MiB | 333,1 MiB | **+243,5** |

O heap sequer chega perto de 384 MiB — não há teto nenhum a aplicar. O defeito
de `execArgv` continua sendo um defeito (§6.5), mas **não explica este número**.

### 9.4 Achado que vale para além da POC: 94% do custo é invisível

Dos 243,5 MiB que a sessão adicionou, apenas **14 MiB** aparecem em
`process.memoryUsage()` (heap + `external`). Os outros **229,5 MiB — 94% —**
são memória nativa que a API do Node não enxerga: contextos de OpenSSL/Signal,
buffers de WebSocket, arenas do alocador do glibc.

Isso invalida uma parte da instrumentação proposta no plano (P1, item 1:
"publicar `process.memoryUsage()` por worker: `rss`, `heapUsed`, `heapTotal`,
`external`, `arrayBuffers`"). Só `rss` — e de preferência **PSS**, lido de
`/proc/<pid>/smaps_rollup` — descreve o custo real. Um painel construído sobre
heap e `external` mostraria uma frota saudável enquanto a memória acaba.

### 9.5 O que ainda NÃO foi descartado

Um confundidor permanece, e ele é material: a sessão do shard foi medida nos
**20 minutos seguintes ao start**, que é justamente a janela do sync inicial do
WhatsApp; os 42 workers de produção estão no ar há horas ou dias, já com o
pico assentado. O próprio diagnóstico de 13/09 observou workers **encolhendo**
20-40 MiB ao longo de 30 minutos.

A série temporal já coletada separa os dois casos, sem medir nada novo:

```bash
awk -F, '$2=="sessoes_1"{n++; if(n<=12) a+=$5; if(n>108) b+=$5} END{printf "primeiros 2min: PSS %.1f MiB | ultimos 2min: PSS %.1f MiB | delta %+.1f\n", a/12, b/12, b/12-a/12}' /tmp/shard-rss-*.csv
```

- **PSS caindo ao longo da janela** → é pico de sync; exige um soak mais longo
  (2-4h) antes de concluir.
- **PSS estável ou subindo** → o custo é estrutural e a POC está reprovada.

### 9.6 Defeito do instrumento (corrigir antes de reusar)

`scripts/diag-shard-rss.mjs` **trava no encerramento**: depois de pedir
`SHUTDOWN_SHARD` ele espera o `exit` do processo filho **sem prazo**. Numa
execução real com sessão conectada, o shard não terminou de fechar e o script
ficou pendurado por horas. Os dados não se perdem (o CSV é escrito a cada
amostra), mas o script precisa de um `kill` forçado após um prazo.

⚠️ Isso não é só chateação de ferramenta: **o rollback da POC depende de o
shard conseguir encerrar.** Um shard que não fecha com uma sessão é um achado
sobre a arquitetura, não sobre o script.

### 9.7 Recomendação atualizada

Com o que está medido, a recomendação muda de "seguir com cuidado" para:

1. Rodar a checagem de §9.5 (custo zero, dados já coletados).
2. Se o PSS não estiver caindo: **encerrar a POC de shard** e registrar o
   motivo — não há economia a extrair, e o risco de quatro clientes num
   processo só deixa de ter contrapartida.
3. Em qualquer dos casos, executar o **P1** do diagnóstico original, que
   continua intocado e ataca exatamente a memória nativa que este número
   revelou: log por mensagem, `pino-pretty` fora de produção, `sharp.cache`/
   `sharp.concurrency`, cap do `imageCache`, `AbortSignal` na fila e na rede.

---

## 10. O confundidor caiu — e apareceu algo maior (2026-09-16)

A checagem de §9.5 respondeu, e respondeu ao contrário do esperado:

```text
primeiros 2min: PSS 292,8 MiB | ultimos 2min: PSS 400,3 MiB | delta +107,5
```

**O PSS não estava assentando: estava subindo.** +36,7% em 20 minutos, ~5,4
MiB por minuto, com **uma sessão de staging praticamente ociosa**.

Isso mata a hipótese do pico de sync inicial, que era a única defesa restante
da POC. E fecha o veredito, porque **não existe instante da janela em que o
shard tenha sido mais barato**:

| Momento | custo da sessão | 1 sessão vs dedicado | 4 sessões vs 4 dedicados |
|---|---:|---|---|
| início da janela | 203 MiB | −34% | −3,5% |
| fim da janela | 311 MiB | −84% | −53% |

**POC de shard: reprovada.** Não há economia a extrair, e o risco de quatro
clientes num processo só perde qualquer contrapartida.

### 10.1 A pergunta que passou a valer mais que a POC

O `bot-worker` dedicado faz o mesmo? A diferença entre as duas respostas muda
a investigação inteira de RAM:

- **Se os workers dedicados também crescem assim**, o veredito do diagnóstico
  de 13/09 ("custo basal da arquitetura, não vazamento demonstrado") está
  errado, e os 218 MiB de média são apenas onde cada worker está na própria
  curva. Aí existe vazamento de verdade afetando os 42 robôs, e ele é o
  problema — não a densidade por processo.
- **Se só o shard cresce**, o crescimento foi introduzido pela refatoração
  (todo o `bot-worker.js` virou closure, dois monitores de event loop por
  processo, estado por sessão que antes era por processo).

Nos dois casos a POC continua reprovada; o que muda é para onde vai o esforço.

### 10.2 Teste de uma foto só, sem esperar nada

A frota de produção tem robôs de idades diferentes rodando agora. Se o PSS
sobe com o tempo de vida do processo, a assinatura do vazamento aparece numa
única leitura:

```bash
for p in $(pgrep -f "/home/deploy/wabot/src/bot-worker"); do
  age=$(ps -o etimes= -p $p 2>/dev/null | tr -d ' ')
  pss=$(awk '/^Pss:/{print $2}' /proc/$p/smaps_rollup 2>/dev/null)
  [ -n "$age" ] && [ -n "$pss" ] && echo "$age $pss"
done | awk '{h=int($1/3600); s[h]+=$2; n[h]++} END {for(k in s) printf "%3dh de vida | %2d robos | PSS medio %.0f MiB\n", k, n[k], s[k]/n[k]/1024}' | sort -n
```

⚠️ **Leitura com cuidado:** robô mais velho também pode ser robô de conta mais
movimentada (as que caem menos são as que ficam de pé), então correlação com
idade **não prova** vazamento sozinha. O que ela faz é dizer se vale montar a
medição direta — acompanhar 3 ou 4 workers de produção por algumas horas, com
a mesma cadência usada aqui.

### 10.3 Não extrapolar os 5,4 MiB/min

Vinte minutos não autorizam projetar horas. O número serve para dizer
**direção** (cresce, não assenta), não taxa sustentada. O próprio diagnóstico
de 13/09 registrou workers de produção oscilando ±5% e vários **encolhendo**
20-40 MiB em 30 minutos — comportamento incompatível com crescimento linear.
As duas observações precisam ser reconciliadas pela medição de §10.2, não por
argumento.
