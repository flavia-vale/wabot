# memoria-e-capacidade — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

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

## ADMIN > Capacidade (observabilidade da VPS)

A rota `/admin/capacidade` (permissão `tech:read`) apresenta o host contratado,
RAM/CPU/disco/swap, processos PM2, workers reais, staging, histórico, forecast e
alertas. A coleta roda dentro da API a cada 1 hora, com `unref()` e
single-flight; **não existe processo PM2 novo** e a tela nunca cria, apaga ou
redimensiona recursos Hetzner. Atualização manual exige `tech:write` e é
auditada como `admin.capacity.refresh`.

Política conservadora (`src/ops/capacity/policy.js`): reserva o maior valor
entre 20% da RAM e 1.536 MB; cada sessão custa pelo menos 350 MB ou o p95
observado (o maior); swap não aumenta a capacidade. Dados ausentes ficam
`null`/`insufficient_data`. Swap ocupado sem atividade é informativo; pressão
contínua, pouca `MemAvailable`, disco e headroom determinam atenção/criticidade.
O forecast só fornece horizonte quando há cobertura suficiente e crescimento
positivo, sempre com faixa e confiança.

Snapshots horários são retidos por 90 dias; rollups horários por 12 meses
e diários permanecem. Alertas exigem confirmação em duas amostras, possuem
cooldown de 24 h, registram piora e recuperação e nunca executam ações. Eventos
de restart, staging, reboot/OOM e mudança de host/política explicam o histórico
com payload sanitizado e dedupe.

Integração Hetzner é opcional e somente leitura:

```text
HCLOUD_READ_TOKEN=<token read-only, nunca enviar ao browser/log>
HCLOUD_PROJECT_ID=14422101
HCLOUD_SERVER_ID=128727108
CAPACITY_SWEEP_INTERVAL_MS=3600000
```

Sem token, usa o baseline `wabot-prod / CX33 / 4 vCPU / 8 GB / 40 GB` e marca
a fonte como `baseline`; falha externa preserva o último inventário como stale.
O cache Hetzner dura no mínimo 6 h.

Antes de produção: PR contra `develop`, autodeploy, validar em
`http://178.105.54.0:3006` e observar por 24 h (<1% CPU média e <50 MB adicionais)
conforme `specs/014-admin-capacity-observability/quickstart.md`. A validação de
24 h é manual e não pode ser inferida dos testes locais.

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

## RAM dos robôs — rodada 3: alocador, geração jovem e o medidor de crescimento (2026-09-19)

Depois das janelas 1 e 2 (`MALLOC_ARENA_MAX=2`, log inline, cache do Sharp), o
robô ficou em 92,8 MiB (PSS) com 2,5 h e **voltou a 122,6 MiB com 11,6 h**.
`docs/analise-ram-rodada-3-2026-09-19.md` mediu, em ambiente controlado com as
mesmas versões do lock, de que é feito o custo e de onde vem o crescimento.

| Peça | Onde |
|---|---|
| Interruptores novos (nascem DESLIGADOS) | `resolveWorkerSpawnEnv` / `resolveWorkerExecArgv` em `src/core/workerSpawnOptions.js` |
| Regra pura do veredito de crescimento | `src/ops/memory/growthDiagnosis.js` |
| Medidor só-leitura por robô, com série | `scripts/diag-memoria-crescimento.mjs` (`--ipc`, `--serie`) |

**O que a medição fechou (não re-medir sem motivo):**

- **O custo fixo é o grafo de imports (~71 MiB privados), e 45 deles são o
  Baileys** (WAProto de 11 MB + libsignal). Sharp ~10, motor do Prisma ~7,
  ioredis ~7, nodemailer ~3, axios <1. Não há mais gordura nativa relevante no
  custo fixo — **a memória a recuperar está no crescimento com a idade.**
- **O crescimento tem cara de retenção do alocador**: dois terços dele estão em
  `[heap]`+arena do glibc. Num churn de buffers de HTML/imagem, depois de
  liberar tudo, o glibc segura **69 MiB**; com limiares fixos de mmap/trim,
  **40**; jemalloc com `background_thread:true`, **10**. ⚠️ jemalloc SEM a
  thread de fundo segura 77 — a purga só roda em atividade. Não ligar um sem o
  outro. jemalloc custa +5-9 MiB fixos por processo.
- **`--max-semi-space-size=8`**: −14 MiB sob tráfego, pausas de GC MAIS curtas,
  vazão igual. Abaixo de 8 promove objeto cedo e come o ganho.
  **`--optimize-for-size`**: −13 MiB fixos e −37 sob carga, com ~10% de CPU em
  GC e pausas mais curtas; não é aceita em `NODE_OPTIONS`, por isso mora no
  `execArgv`.
- Derrubados: `--jitless` (não economiza e quebra o grafo), trocar `axios`,
  `sharp.cache(0)`, COW entre forks (`fork()` do Node é spawn+exec — nada a
  compartilhar). **O motor do Prisma HONRA `TOKIO_WORKER_THREADS`** (verificado).

**Não regredir:**

- **Tudo nasce desligado.** `resolveWorkerSpawnEnv({})` continua `{}` e
  `resolveWorkerExecArgv({})` continua só o teto de heap — teste trava.
- **`WA_WORKER_LD_PRELOAD` aceita UM caminho absoluto**, sem `:` nem espaço;
  `WA_WORKER_MALLOC_CONF` só `chave:valor,...`. Nunca ler `LD_PRELOAD` cru do
  `.env`: valeria para API e supervisor, que não são o alvo.
- **`LD_PRELOAD` de arquivo inexistente NÃO derruba o robô** (medido: o loader
  avisa e segue com glibc). Fail-safe por construção.
- **Sem medir a série (24 h, 1x/hora) não se conclui nada sobre crescimento** —
  o `--serie` recusa com menos de 3 medidas ou 2 h e avisa reinício da frota no
  meio. Nem heap snapshot nem inspector em produção: pausa de segundos derruba
  o keepalive.
- **Aplicar exige reiniciar o supervisor** (env lida no fork) e o código dos
  interruptores está em `src/core/` (`WORKER_CODE_PATHS_RE`): mergear na MESMA
  janela em que as envs entram no `.env` — uma reconexão, não duas. jemalloc
  ainda exige `apt install libjemalloc2` no VPS: anunciar.

Ordem recomendada: medir 24 h → staging com jemalloc + semi-space 8 por 24 h →
produção (as duas na mesma janela) → medir 24 h → só então
`--optimize-for-size`. Testes: `test/core/worker-spawn-options.test.js`,
`test/ops-memory-growth-diagnosis.test.js`.

### Resultado em produção: jemalloc + semi-space 8 (medido 2026-09-23 — não regredir)

Produção roda com as duas alavancas desde **2026-09-22 ~22:50 UTC**. As chaves
estão no `.env` de `~/wabot`:

```
WA_WORKER_MALLOC_ARENA_MAX=2        # janela 1; inerte com jemalloc, volta a valer no rollback
WA_WORKER_LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
WA_WORKER_MALLOC_CONF=background_thread:true,dirty_decay_ms:5000,muzzy_decay_ms:5000,narenas:2
WA_WORKER_MAX_SEMI_SPACE_MB=8
```

Medição de 24 h com a mesma idade de robô dos dois lados. "Antes" são 142
robôs com série longa. "Depois" são 54 robôs com série longa. Mediana de
memória anônima (`RssAnon`):

| Idade do robô | Antes | Depois |
|---|---:|---:|
| 0 a 2 h | 108,4 MiB | 86,6 MiB |
| 2 a 6 h | 131,4 MiB | 96,6 MiB |
| 6 a 12 h | 142,3 MiB | 93,5 MiB |
| 12 a 24 h | 146,4 MiB | 103,7 MiB |

| Crescimento por hora (idade ≥ 2 h) | Antes | Depois |
|---|---:|---:|
| memória anônima (`/proc`) | 0,90 MiB | 0,63 MiB |
| RSS total (`getBotMetrics`) | 2,02 MiB | 0,73 MiB |

- **O ganho veio do alocador.** A memória do V8 (`heapTotal`) ficou igual,
  entre 52 e 54 MiB com 12 a 24 h. O semi-space 8 não mexeu nela de forma
  visível. A economia está fora do V8, que é onde a análise apontava.
- **Na frota, são ~43 MiB por robô a partir de 12 h de vida**, ou ~2,3 GB com
  54 robôs.
- **Nenhum sinal de crash do alocador.** Zero `<jemalloc>` nos logs de erro e
  zero `segfault` no kernel. Erros fatais de robô: 0 nas 24 h antes e 2 nas
  24 h depois (`write EPIPE` durante reinício do supervisor e `ENOENT` num
  arquivo de credencial). Nenhum é do alocador. Os robôs que renasceram
  sozinhos passaram de 7 para 14 em 24 h, e só esses 2 foram erro fatal.
- A política de capacidade **não muda**: ela usa o maior entre 350 MB e o p95
  por robô, de propósito. O ganho aparece como folga de RAM, não como vaga nova.

**Não regredir:**

- **Com jemalloc, a coluna `heap_brk`/`glibc` vai a ~5 MiB e não prova
  nada.** O jemalloc não usa a área `[heap]`. Comparar sempre `RssAnon` ou PSS
  por faixa de idade. O veredito `retencao_alocador` do
  `diag-memoria-crescimento.mjs --serie` depende dessa coluna e **não dispara
  mais**; retenção do jemalloc apareceria como `fora_heap`.
- **O marco de "depois" se grava ANTES do restart**, nunca depois. Na primeira
  leitura o marco foi gravado ~40 s depois da frota nascer, os robôs com
  jemalloc caíram no "antes" e o resultado saiu errado. O corte correto foi a
  hora em que a env entrou no `.env` (22:37).
- **Comparar por idade de robô, nunca por relógio.** Houve três reinícios da
  frota na janela, e só a comparação na mesma idade sobrevive a isso.
- **Antes de reiniciar o `bot-supervisor` à mão, conferir que não há deploy
  rodando** (`pm2 describe api` com uptime baixo, `ps aux | grep -E "npm ci|deploy_safe"`).
  Em 2026-09-22 o restart das 22:37 coincidiu com um deploy (a `api` também
  reiniciou às 22:39, e `node_modules/bullmq` tinha mtime 22:37). O supervisor
  ficou "online" sem processar comando nenhum por ~14 min, com zero robôs e o
  painel mostrando `listRunningBots`/`isRunning timed out`. Voltou com mais um
  `pm2 restart bot-supervisor`. A colisão com o `npm ci` é a causa **provável**,
  não provada; o log de erro tinha `Cannot find package .../bullmq/index.js`,
  sem hora na linha.

Rollback, se precisar (reconecta a frota):

```bash
sed -i '/^WA_WORKER_\(LD_PRELOAD\|MALLOC_CONF\|MAX_SEMI_SPACE_MB\)=/d' ~/wabot/.env
pm2 restart bot-supervisor --update-env && pm2 save
```

Próxima alavanca da §6 da análise, se quiser mais: `WA_WORKER_V8_OPTIMIZE_FOR_SIZE=1`
(−13 MiB fixos medidos em laboratório, ~10% de CPU em GC). Custa outra
reconexão da frota e precisa da mesma medição por idade.

## Teto de robôs por processo (`MAX_SESSIONS_PER_PROCESS`) — RCA 2026-09-01, não regredir

O `bot-supervisor` recusa ligar sessão quando já tem `MAX_SESSIONS_PER_PROCESS`
(default **20**; **produção está em 80** desde 2026-09-18 — ver a medição
vigente abaixo) robôs vivos — `checkSessionCircuitBreaker` em
`src/supervisor/index.js`. **Isso é o teto comercial da operação**: cheio,
NENHUMA cliente nova consegue conectar, e quem desligar o próprio robô não
consegue voltar (perde a vaga para outra conta).

**O que aconteceu:** uma cliente desligou o robô, tentou reconectar por número
de celular 7 vezes em 40min e leu sempre "Falha na conexão / Bot não está
conectado". O servidor estava em 20/20. As rotas de conectar
(`POST /session/start` e `POST /session/pairing-code`) **descartavam o retorno
do `startBot`**, então a recusa virava, no QR, um código que nunca chega, e no
pareamento o erro cru `Bot não está rodando` → `WA_NOT_CONNECTED` → um texto que
não diz nada. **183 recusas** acumularam no contador do Redis sem que ninguém
percebesse.

Hoje:
- as duas rotas conferem o resultado via `classifyBotStartOutcome`
  (`src/domain/session/service.js`, pura/testada) e devolvem **503** com texto
  leigo: `WA_CAPACITY_LIMIT` (o servidor recusou — teto cheio ou shard) vs.
  `WA_START_FAILED` (aceitou e não subiu). Linguagem obrigatória: nada de
  "worker", "supervisor", "circuit breaker", "shard" na tela — teste
  `test/session-service.test.js` falha se jargão voltar;
- a recusa vira sinal durável `ops_session_capacity_limit`
  (`recordOperationalSignal` no supervisor, allowlist em `src/analytics.js`,
  mapa em `src/observability/operationalSignals.js`) — visível em
  `AnalyticsEvent` e no `/metrics`, em vez de só no log;
- `startBot` devolver `false` **não é sempre erro**: no caminho inline ele
  devolve `false` quando o robô JÁ estava ligado. Por isso a decisão olha
  `isRunning` junto — não voltar a tratar o booleano sozinho como falha.

**Medição real (2026-09-01, prod):** 20 robôs = **5,31 GB de RSS**, média
**272 MB por robô**. Base fixa (api 226 MB + dashboard 225 MB + supervisor
92 MB + staging ~344 MB + logrotate) ≈ 0,9 GB. VPS de 7,6 GB ficava com 2,0 GB
livres e **1,6 GB já em swap**. Ou seja: **cada vaga nova custa ~272 MB** e o
teto de 20 não era capricho, era o que cabia. Subir o teto é mudança
memory-heavy → REGRA #1 da política de memória abaixo (avisar antes, com
estimativa).

**Medição real (2026-09-18, prod — números VIGENTES, use ESTES para estimar):**
o servidor foi ampliado de novo, para **30,6 GB** (`free -m` diz 31.337 MB
totais), e as duas janelas de economia de memória entraram em produção no mesmo
dia (`MALLOC_ARENA_MAX=2` e `LOG_TRANSPORT_MODE=inline` + cache do Sharp — ver
`docs/analise-ram-memoria-nativa-2026-09-16.md`). Com **47 robôs** ligados:

| medida | 2026-09-11 | **2026-09-18** |
|---|---:|---:|
| RAM total | 15.613 MB | **31.337 MB** |
| RAM disponível | 4.919 MB (31%) | **24.342 MB (78%)** |
| RSS somado dos robôs | 11.832 MB (36 robôs) | **8.540 MB (47 robôs)** |
| **média por robô (RSS)** | 329 MB | **182 MB** |
| swap em uso | 41 MB, sem tráfego | **0** |

**A média por robô CAIU 45%** (329 → 182 MB) — não é ruído: são as janelas de
memória nativa, medidas em PSS no documento e confirmadas aqui em RSS, que é a
unidade da política de capacidade.

⚠️ **O teto de vagas em produção é 80, NÃO 40** (confirmado pela dona do
produto em 2026-09-18). Todo texto deste arquivo que dizia 40 estava
desatualizado — não repetir 40 como se fosse o valor vigente.

⚠️ **O limite seguro da política saltou de 35 para ~71.**
`evaluateCapacity` reserva o maior valor entre 20% da RAM e 1.536 MB — aqui
**6.267 MB** — e divide o resto por 350 MB/robô: `(31.337 − 6.267) / 350 = 71`.
Com **47 robôs** ligados, a folga pela política é de **24 vagas** (era zero em
11/09). A leitura anterior ("a folga pela política é zero", "o painel amarela
pela contagem de vagas") **deixou de valer**.

⚠️ **O teto de 80 continua sendo MAIOR que o limite seguro (71)** — ou seja,
quem primeiro amarela é a política, não a contagem de vagas, e entre 71 e 80 o
servidor aceitaria robô que a política já não recomenda. Não é problema hoje
(47 ligados), mas é o número a vigiar: chegando perto de 71, o sinal que decide
é o **swap**, não a RAM livre.

⚠️ **A política continua usando 350 MB/robô**, não os 182 medidos: ela usa o
MAIOR entre 350 e o p95 observado, de propósito — o colchão existe para pico de
GC e scrape pesado. Pela média medida caberiam ~137 robôs; **não é esse o número
a usar para decidir.**

⚠️ **Subir o teto de vagas continua sendo REGRA #1 da política de memória** e
exige reiniciar o `bot-supervisor` (reconecta TODAS as sessões). Ter folga não é
autorização — a decisão é da dona do produto.

**Medição de 2026-09-11 (HISTÓRICA — servidor e robôs mudaram desde então):**
o servidor foi ampliado para **15,6 GB** (8 vCPU, disco de 38 GB) e o teto subiu
para **40**. Com **36 robôs** ligados:

| medida | valor |
|---|---|
| RAM total | 15.613 MB |
| RAM disponível | 4.919 MB (31%) |
| RSS somado dos 36 robôs | 11.832 MB |
| média por robô | **329 MB** |
| maior robô | 495 MB |
| swap em uso | 41 MB, **sem tráfego** (`si`/`so` = 0) |
| CPU ociosa | 98% |
| disco / inodes | 62% / 19% |

**A média por robô SUBIU de 272 para 329 MB** — estimativa nova usa 329, não
272. Base fixa medida no mesmo instante: api 218 + dashboard 208 + supervisor
120 + staging (api 163 + visual 124 + supervisor 111) + logrotate 80 ≈ **1,0 GB**.

⚠️ **O teto de 40 é MAIOR que o limite seguro que a política calcula (35).**
`evaluateCapacity` (`src/ops/capacity/policy.js`) reserva o maior valor entre 20%
da RAM e 1.536 MB — aqui 3.123 MB — e divide o resto por 350 MB/robô:
`(15.613 − 3.123) / 350 = 35`. Com 36 ligados a folga pela política é **zero**, e
é por isso que `/admin/capacidade` mostra **atenção** com todos os recursos
verdes: o amarelo vem da CONTAGEM DE VAGAS, não de RAM, disco, CPU ou swap.
Não procurar defeito de recurso quando o painel amarela com swap parado.

As duas leituras de margem respondem perguntas diferentes e as duas importam:
**margem física** (4,9 GB livres ≈ 14 robôs a mais) e **margem pela política**
(zero — a reserva de 3,1 GB já está sendo consumida). A reserva existe para
absorver pico de GC e scrape pesado; gastá-la não quebra nada hoje, mas tira o
colchão.

**O sinal que muda a decisão é o SWAP, não a RAM livre.** Enquanto `swap_usada`
ficar parada (os 41 MB são resíduo antigo) e `si`/`so` = 0, o servidor está
confortável. Swap subindo de um dia para o outro = subdimensionado de verdade →
aumentar RAM (alvo ~20 GB para 40 robôs com folga), não subir mais o teto.
Vigilância de uma linha por dia:

```bash
free -m | awk 'NR==2{print "livre_mb="$7} NR==3{print "swap_usada_mb="$3}'
```

⚠️ **Mudar o teto exige reiniciar o `bot-supervisor`** (o valor é lido no boot),
e isso **reconecta TODAS as sessões de uma vez** — decisão humana, anunciada
antes, nunca às cegas.

Diagnóstico rápido no VPS:
```bash
grep -ihE "circuit breaker|limite de sessões" ~/.pm2/logs/bot-supervisor-*.log | tail
redis-cli -n 0 get supervisor:session_circuit_breaker_alert:shard-1-of-1
for p in $(pgrep -f "/home/deploy/wabot/src/bot-worker"); do awk '/VmRSS/{print $2}' /proc/$p/status; done \
 | awk '{s+=$1; n++} END {printf "%d robos | RSS total %.2f GB | media %.0f MB\n", n, s/1048576, s/n/1024}'
```

### Aviso por e-mail ANTES de acabar a vaga (2026-09-09 — não regredir)

`ops_session_capacity_limit` só nasce **depois** da primeira recusa: quando ele
aparece, alguma cliente já ficou sem conectar. Este aviso é o contrário — chega
enquanto ainda faltam vagas (default **2**), com tempo de liberar memória ou
aumentar o servidor.

| Peça | Onde |
|---|---|
| Decisão (PURA, sem banco/rede) | `src/ops/sessionCapacityAlertPolicy.js` |
| Passada | `src/ops/sessionCapacityAlertSweep.js` |
| Texto (editável pela aba E-mails) | `admin_vagas_acabando` em `src/email/registry.js` |
| Boot | `startSessionCapacityAlertSweep()` em `src/api/server.js` |

Onde roda: `setInterval` + `unref()` dentro da API, mesmo padrão de
`startCredentialExpirySweep` — **sem processo PM2 novo, zero impacto de RAM**
(uma contagem a cada 15min). A contagem vem de `listRunningBots()` do
`manager.js`, a **mesma fonte** que o circuit breaker usa, então o aviso não
pode discordar do que recusa a cliente. O teto é lido pela **mesma fórmula** do
supervisor (`MAX_SESSIONS_PER_PROCESS`, default 20; **produção está em 80**).

**Não regredir:**

- **Sai pelo caminho de AVISO INTERNO** (`sendAdminAlert`), nunca pelo
  despachante da cliente — de lá vêm o endereço (`ADMIN_ALERT_EMAIL`), o
  cooldown por assunto e o histórico em `EmailSendLog`. As travas do
  despachante (descadastro, conta parada, teto semanal) são regras de
  relacionamento com a CLIENTE e nenhuma pode calar um alerta de operação.
- **O assunto do cooldown carrega o teto** (`max=<n>`): subir o teto é situação
  nova e pode avisar de novo sem esperar a janela do teto antigo.
- **Fail-safe em todo caminho.** Contagem indisponível (supervisor fora do ar,
  comando estourado) ou teto não confiável → **não avisa**. Alarme falso
  recorrente treina a pessoa a ignorar justamente este alerta.
- **Aviso barrado não vira sinal de envio** — sem SMTP ou dentro do cooldown,
  nada é gravado.
- **Linguagem leiga:** "vagas de robô", nunca "sessão por processo", "worker",
  "shard" ou "circuit breaker". Teste falha se jargão voltar.

Envs (todas opcionais): `CAPACITY_ALERT_FREE_SLOTS` (2),
`CAPACITY_ALERT_COOLDOWN_HOURS` (12), `CAPACITY_ALERT_SWEEP_INTERVAL_MS`
(15min), `CAPACITY_ALERT_ENABLED` (`false` desliga). Aplicar env exige
`pm2 delete` + `start` (pegadinha #1).

⚠️ **Sem `SMTP_*` no `.env` nenhum e-mail sai** — inclusive este. Conferir isso
antes de procurar defeito. Teste: `test/ops-session-capacity-alert.test.js`.

⚠️ **API e supervisor releem o teto só no PRÓPRIO boot.** Mudar
`MAX_SESSIONS_PER_PROCESS` e reiniciar só uma das pontas faz o aviso e a recusa
real discordarem até a outra subir.

Conferir o teto que está VALENDO em produção (o teto vem do `.env` via dotenv,
então `/proc/<pid>/environ` **não** serve — ele mostra só o ambiente do exec):
```bash
grep -n "MAX_SESSIONS_PER_PROCESS" ~/wabot/.env || echo "ausente no .env -> vale o padrao 20 (prod estava em 80 em 2026-09-18)"
# o que o supervisor de PRODUCAO leu no boot. Dois cuidados: o pm2 numera o
# arquivo por instancia (pegue o mais recente por data, nao por nome) e
# `*supervisor*` casaria tambem os logs de STAGING, que tem outro teto.
grep -h "maxSessionsPerProcess" "$(ls -t ~/.pm2/logs/bot-supervisor-out-*.log | head -1)" | tail -1
pgrep -fc "/home/deploy/wabot/src/bot-worker"   # robos ligados agora
```

### "Limite de robôs" era a frase de TRÊS causas diferentes (RCA 2026-09-07 — não regredir)

Cliente mandou print de **"Nosso servidor está no limite de robôs ligados ao
mesmo tempo"** com o servidor comprovadamente fora do teto. O texto não estava
errado por acaso: `classifyBotStartOutcome` devolvia essa frase para
**qualquer** `startAccepted === false`, e o supervisor devolve `false` por três
motivos distintos — teto cheio (`checkSessionCircuitBreaker`), conta fora do
shard (`belongsToThisShard`) e vaga presa por robô que não terminou de
desligar. Nem a tela nem o log da API diziam qual tinha sido: só o log do
`bot-supervisor`, no VPS.

Duas armadilhas de leitura que isso escondia:

- **"Robô ligado" ≠ "robô conectado".** O teto conta `listRunningBots()`, que é
  **processo forkado** — robô desconectado, reconectando ou em teardown ocupa
  vaga. O painel pode mostrar 12 conectados com o servidor em 20/20 e recusando.
- **Shard errado recusa UMA conta só**, com o servidor vazio — e aparecia como
  "estamos lotados", que manda a cliente esperar por uma vaga que já existe.

`src/domain/session/startRefusal.js` (`classifyStartRefusal`, puro) decide o
motivo **do lado da API**, e as duas rotas de conectar (`/session/start` e
`/session/pairing-code`) o passam para `classifyBotStartOutcome`:

| Motivo | Código | O que a cliente lê |
|---|---|---|
| teto de fato cheio | `WA_CAPACITY_LIMIT` | texto histórico, "tente de novo em alguns minutos" |
| conta em servidor que não a atende | `WA_SESSION_MISPLACED` | "não adianta tentar de novo, vamos resolver" (`retryable: false`) |
| recusa sem teto cheio / sem medição | `WA_START_REFUSED` | "espere um minuto e tente de novo" |

**Não regredir:**

- **A classificação mora na API, não no protocolo.** `src/supervisor/protocol.js`
  é [PROTECTED_CORE] e, em modo `remote`, **o supervisor não é reiniciado no
  deploy** — mudar o retorno de `START_BOT` ficaria dormente e deixaria as duas
  pontas divergentes. A API já tem os dados: carrega o MESMO `.env`
  (`MAX_SESSIONS_PER_PROCESS`, `SHARD_COUNT`, `SHARD_INDEX`) e `listRunningBots()`
  é comando existente.
- **Servidor errado é avaliado ANTES do teto.** Conta fora do shard é recusada
  mesmo com o servidor vazio; concluir "teto" ali contaria a história errada.
- **Sem medição confiável NUNCA afirmar teto.** `listRunningBots()` falhou →
  `runningCount: null` → texto genérico. `toCount` trata `null` como `null` e
  nunca como `0` (`Number(null)` é 0 — foi exatamente esse o erro pego no teste).
- **Ordem no `startRefusal.js` é a fonte única** — não reintroduzir texto de
  recusa nas rotas. E o log da recusa leva `reason`, `running` e `max`: é o que
  permite responder à cliente **sem** entrar no VPS.
- Linguagem leiga nas três frases (nada de "shard", "worker", "supervisor",
  "processo"). Teste falha se jargão voltar.

Teste: `test/session-start-refusal.test.js`.

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

- **Orçamento por sessão WhatsApp ativa:** ~**0,18 GB** de RSS medidos em
  2026-09-18 (média 182 MB com 47 robôs; era 329 MB em 11/09 e 272 MB em 01/09
  — a queda é das janelas de memória nativa). Base fixa
  (api+dashboard+supervisor+staging+OS) ~**1 GB**.
- **Fórmula:** `RAM ≈ 1 GB + N_sessões × 0,18 GB + (staging co-locado? +0,4 GB) + ~20% folga`.
- ⚠️ **Para decidir CAPACIDADE, use 0,35 GB por sessão, não os 0,18 medidos** —
  é o que `evaluateCapacity` usa (o maior entre 350 MB e o p95 observado), e o
  colchão existe para pico de GC e scrape pesado.
- **Servidor vigente (2026-09-18):** **30,6 GB** de RAM, disco de 38 GB, swap de
  4 GB. Teto de vagas em **80**; limite seguro da política em **~71**. Com 47
  robôs ligados são **24 vagas de folga pela política**, contra zero em 11/09 —
  e quem amarela primeiro passa a ser a política (71), não o teto (80).
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
