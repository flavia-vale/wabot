# RAM dos robôs — rodada 3: o que ainda há para cortar, e como saber se cresce (2026-09-19)

> Continuação de `docs/analise-ram-memoria-nativa-2026-09-16.md` (janelas 1 e 2:
> `MALLOC_ARENA_MAX=2`, `LOG_TRANSPORT_MODE=inline`, cache do Sharp). **Nada de
> produção foi alterado por esta rodada.** Entram no repositório: interruptores
> novos em `src/core/workerSpawnOptions.js` (nascem DESLIGADOS), um medidor
> só-leitura (`scripts/diag-memoria-crescimento.mjs`) com a regra pura em
> `src/ops/memory/growthDiagnosis.js`, e este documento.

## 0. Resumo em quatro linhas

1. **O QUE ACONTECEU:** as duas janelas levaram o robô de 194,6 para 92,8 MiB
   (PSS) — e depois ele voltou a subir com a idade (122,6 MiB às 11,6 h). Sobrou
   a pergunta "isso para?" e a dúvida sobre onde ainda há memória nativa.
2. **PORQUE:** medido aqui, em ambiente controlado: (a) o custo fixo do robô é
   quase todo o **Baileys** (45 MiB privados, estrutural); (b) o crescimento com
   a idade tem a assinatura de **retenção do alocador**: o glibc não devolve o
   que o programa liberou. Num churn de buffers de HTML e imagem, o glibc segura
   **69 MiB** depois de tudo livre; o jemalloc com purga em segundo plano segura
   **10**.
3. **O QUE DEVE SER FEITO:** primeiro **medir a série por robô** com o script
   novo (24 h, 1x/hora, sem reiniciar nada) para confirmar em qual balde cresce.
   Depois, numa janela só: **jemalloc** nos robôs (a alavanca grande) e
   **`--max-semi-space-size=8`** (a alavanca barata do V8). Ambas por env,
   ambas desligadas por padrão, ambas reversíveis apagando uma linha.
4. **COMO:** ordem por ganho ÷ risco na §6; comandos prontos na §7. Nada é
   aplicado em produção sem o OK da dona do produto (REGRA #1 da política de
   memória) — e jemalloc é um pacote a instalar no VPS (`libjemalloc2`).

## 1. Método desta rodada (e o que ele NÃO prova)

Tudo abaixo foi medido **neste ambiente**: Node 22.22, glibc 2.39, 4 núcleos,
jemalloc 5.3, as MESMAS versões de `@whiskeysockets/baileys`, `sharp`,
`@prisma/client`, `ioredis` e `pino` do `package-lock.json`. Cada número vem de
um processo limpo, com `--max-old-space-size=384` e `MALLOC_ARENA_MAX=2`
(como produção hoje), repetido 2-3 vezes.

O que isso prova: **mecanismo e ordem de grandeza** — quanto cada pacote custa
a mais, quanto cada alocador retém, quanto cada flag do V8 muda. O que NÃO
prova: o número exato em produção (8 núcleos, 29 threads, tráfego real). Por
isso cada proposta traz o comando de medir lá **antes e depois**.

⚠️ Duas medidas diferentes aparecem nas tabelas, e a diferença importa:

- **PSS** — o que a rodada anterior usou. Num processo sozinho é igual ao RSS.
- **Anon** (`Anonymous` de `smaps_rollup`) — só memória **privada** do
  processo. É a que de fato multiplica por 43 em produção: código de
  biblioteca (`.so`, o binário do Node) é compartilhado entre os robôs e pesa
  ~2 MiB em PSS por robô, como a rodada anterior já mediu.

## 2. Onde está a memória de um robô (medido, não deduzido)

### 2.1 O custo fixo é o grafo de imports — e o grafo é quase todo Baileys

Custo INCREMENTAL de cada pacote em cima do Baileys (que é obrigatório):

| processo | PSS | **anon (privado)** | threads |
|---|---:|---:|---:|
| Node vazio | 41 | 6 | 7 |
| + `@whiskeysockets/baileys` | 100 | **51** | 7 |
| + `sharp` (só importar) | 114 | 62 | 11 |
| + `sharp` (uma operação) | 118 | 61 | 17 |
| + `@prisma/client` (motor conectado) | 118 | 58 | 17 |
| + `ioredis` | 108 | 58 | 7 |
| + `nodemailer` | 103 | 54 | 7 |
| + `axios` | 100 | 51 | 7 |
| **grafo inteiro do worker** | **138** | **71** | 23 |

Lendo por diferença sobre a linha do Baileys (51 MiB anon):

| pacote | custo privado por robô | threads | dá para tirar do robô? |
|---|---:|---:|---|
| **Baileys** (WAProto de 11 MB + libsignal) | **~45 MiB** | 0 | **não** — é a sessão |
| sharp / libvips | ~10 MiB | +4 no import, +6 na 1ª operação | não: todo robô publica foto |
| Prisma (motor Rust) | ~7 MiB | +10 | só trocando o motor (§4.6) |
| ioredis | ~7 MiB (inclui init de TLS/rede) | 0 | não: dedup/rate-limit global |
| nodemailer | ~3 MiB | 0 | **sim**, lazy (§4.5) |
| axios | <1 MiB | 0 | não vale o esforço |

**Consequência:** com a frota a 92,8 MiB/robô às 2,5 h, o grafo de imports
(~71 MiB privados) é **~75% do custo de um robô assentado**. O que resta de
"gordura nativa" no custo fixo é pequeno: ~3 MiB (nodemailer) + ~7 MiB (motor
do Prisma, só com upgrade grande). **A memória a recuperar agora não está no
custo fixo — está no crescimento.**

### 2.2 O crescimento com a idade: retenção do alocador, reproduzida

A frota foi de 92,8 (2,5 h) para 122,6 MiB/robô (11,6 h): arena +9,3, heap
(brk) +10,5, anon +9,6. **Dois terços do crescimento estão nos heaps do
glibc** — o balde onde só entra memória que o programa já liberou e o alocador
não devolveu.

Reproduzi o padrão do pipeline (HTML de 200 KB–2 MB + 3 imagens de 80–900 KB +
miniaturas por "mensagem", 8 mensagens vivas em fila, 40 rodadas; depois
libera TUDO, GC, espera 12 s) e medi o que fica preso:

| alocador | preso depois de liberar tudo (anon) | `[heap]` brk |
|---|---:|---:|
| glibc, `MALLOC_ARENA_MAX=2` (**produção hoje**) | **69 MiB** | 64 |
| glibc + `MALLOC_MMAP_THRESHOLD_=65536` `MALLOC_TRIM_THRESHOLD_=262144` | **40 MiB** | 34 |
| jemalloc, padrão (SEM thread de fundo) | 77 MiB | 0 |
| **jemalloc + `background_thread:true,dirty_decay_ms:5000`** | **10 MiB** | 0 |

Nos quatro casos o heap do V8 terminou em 12,6 MiB e `arrayBuffers` em ~3 —
ou seja, **o que fica preso não é dado vivo, é o alocador**.

Três leituras, todas importantes:

- **Por que o glibc retém.** O limiar de `mmap` do glibc é **dinâmico**: ao
  liberar um bloco grande (o HTML de 2 MB de uma loja), ele sobe o limiar até
  esse tamanho, e todo buffer seguinte passa a vir do `[heap]` — que só encolhe
  pelo topo. Buffer de imagem liberado no meio fica lá. É exatamente "PSS sobe,
  heapUsed não". Fixar o limiar desliga o ajuste dinâmico (−42%).
- **jemalloc sem thread de fundo NÃO ajuda um processo ocioso.** A purga só
  roda em atividade do alocador; um robô quieto de madrugada fica com tudo
  preso (77 MiB). Com `background_thread:true` a purga é por tempo: **−85%**.
  Não ligar um sem o outro.
- **O jemalloc custa +5 a 9 MiB anon fixos por processo** (medido no grafo
  inteiro: 76-80 contra 71) e 1-3 threads. Na frota, ~0,3 GB de custo contra
  um teto de economia de ~2,5 GB (43 × 60). O saldo depende de quanto da
  retenção de produção é de fato o alocador — que é o que o medidor da §3
  responde.

### 2.3 A geração jovem do V8 custa até 32 MiB por robô sob tráfego

`new_space` físico num processo em repouso: 0,5 MiB. Sob alocação (JSON de
protos, strings, objetos de vida curta): **32 MiB** (2 semi-spaces de 16, o
padrão do Node 22). Medido com workload de 400 mil objetos e o custo do GC
(pausas e frequência):

| flag | anon sob carga | new_space | old_space | GCs menores | p99 pausa | maior pausa | tempo |
|---|---:|---:|---:|---:|---:|---:|---:|
| padrão | 58,7 | 32 | 4,5 | 96 | 1,23 ms | 4,2 ms | 812 ms |
| `--max-semi-space-size=8` | **45,0** | 16 | 4,8 | 110 | **0,68 ms** | 4,3 ms | 820 ms |
| `--max-semi-space-size=4` | 36,3 | 8 | **16,8** | 159 | 0,47 ms | 5,0 ms | 774 ms |
| `--optimize-for-size` | **21,8** | 2 | 10,1 | 555 | **0,45 ms** | 3,6 ms | 807 ms |

- **8 MiB é o ponto sem custo**: −14 MiB sob carga, vazão igual, old-space não
  cresce, pausas MAIS curtas (scavenge menor). Aceita em `NODE_OPTIONS` — mas
  aqui vai por `WA_WORKER_MAX_SEMI_SPACE_MB` para só alcançar os robôs.
- **4 MiB já promove objeto cedo** (old-space 4,5 → 16,8): parte do ganho vira
  trabalho de GC maior depois. Não recomendo.
- **`--optimize-for-size` é a mais forte** e também cortou **13 MiB do custo
  FIXO** do grafo de imports (anon 71 → 58): o V8 guarda menos código otimizado
  e cresce o heap devagar. Custo: 5,8× mais scavenges (cada um menor: pausa
  máxima **caiu**), ~10% de CPU em GC contra 6%. Não é aceita em
  `NODE_OPTIONS` — por isso mora em `execArgv`
  (`WA_WORKER_V8_OPTIMIZE_FOR_SIZE=1`). É a segunda alavanca a testar, não a
  primeira: é a que mais muda o comportamento do V8.

⚠️ O incidente de junho/2026 ("pausa de GC derruba o keepalive") era **heap sem
teto num VPS sem swap** — pausa longa de mark-compact. Aqui o efeito é o oposto:
GCs mais frequentes e mais curtos. Ainda assim o `eventLoopDelayMs.p99` que o
worker já expõe é o critério de aprovação em staging.

### 2.4 Coisas que a medição derrubou

| hipótese | veredito |
|---|---|
| `--jitless` economizaria memória | **não**: anon 57,9 (igual ao padrão), 19% mais lento, e o grafo de imports **não carrega** (WebAssembly desligado) |
| cortar `axios` (3 sites) | <1 MiB. Não vale |
| `sharp.cache` de 50 para 8 MB rende muito | numa operação, 79,7 vs 78,7 — o cache só enche com operações REPETIDAS, raras aqui. O ganho real da janela 2 veio da isolate do log, como o documento anterior já concluiu |
| COW entre os forks compartilha heap | **não existe**: `child_process.fork()` do Node é `spawn` + `exec` de um binário novo, não `fork(2)`. O que se compartilha é só arquivo (`.so`, binário) — 2,2 MiB PSS/robô já medidos. Nada a ganhar |
| o motor do Prisma ignora `TOKIO_WORKER_THREADS` | **honra**: com `=2`, as threads `tokio-runtime-w` caem de núcleos+1 para 3 |

## 3. Diagnóstico do crescimento: comando concreto, sem derrubar nada

O que separa cache saudável, retenção do alocador e vazamento **não é o total**
— é em qual balde a memória cresce:

| cresce em | é | alavanca |
|---|---|---|
| `[heap]` + arena do glibc, com `heapUsed` do V8 parado | **retenção do alocador** (não é bug) | jemalloc / limiares (§4.1, §4.2) |
| `heapUsed` do V8, e não volta | **vazamento em JS** | heap snapshot em staging; alocador não resolve |
| `arrayBuffers` (Buffers vivos) | **buffers presos na fila** — `buildPayload` guarda a foto até o último destino sair | soltar o buffer no fim da mensagem; limitar espera |

`scripts/diag-memoria-crescimento.mjs` (só-leitura) grava, por robô e por
rodada, PSS, glibc, anônimo, arenas, threads e — com `--ipc` — o lado do V8
(`heapUsed`, `heapTotal`, `external`, `arrayBuffers`, tamanho da fila, p99 do
event loop), pedido pelo **mesmo comando que o painel usa a cada carregamento**
(`getBotMetrics` via supervisor). `--serie` calcula a inclinação (MiB/h) de
cada balde e dá o veredito por robô e pela frota, em `growthDiagnosis.js`
(puro, testado). Ele **recusa concluir** com menos de 3 medidas ou 2 h, e avisa
quando a frota reiniciou no meio.

Em produção o script só existe depois do deploy em `main`. Até lá, o bloco
abaixo faz o mesmo sem IPC (é o suficiente para separar glibc de resto):

```bash
# ---------- cole daqui (só-leitura) ----------
mkdir -p /tmp/medidas; F=/tmp/medidas/prod-robos.tsv
[ -f $F ] || printf "quando\tpid\tidade_min\tthreads\tRssAnon_MiB\theap_brk_MiB\tanon_fora_heap_MiB\n" > $F
for p in $(pgrep -f "/home/deploy/wabot/src/bot-worker"); do
  awk -v pid=$p -v quando=$(date +%FT%T) -v idade=$(( $(ps -o etimes= -p $p) / 60 )) \
      -v th=$(awk '/^Threads:/{print $2}' /proc/$p/status) -v ra=$(awk '/^RssAnon:/{printf "%.1f", $2/1024}' /proc/$p/status) '
    /\[heap\]/ {inheap=1; next} /^[0-9a-f]+-[0-9a-f]+ / {inheap=0}
    inheap && /^Rss:/ {heap+=$2}
    END {printf "%s\t%s\t%s\t%s\t%s\t%.1f\t%.1f\n", quando, pid, idade, th, ra, heap/1024, ra-heap/1024}' /proc/$p/smaps
done >> $F
column -t $F | tail -50
# ---------- até aqui ----------
```

Rode 1x por hora por 24 h (à mão ou num `crontab` do usuário `deploy`). A
leitura: `heap_brk` subindo com `anon_fora_heap` parado → alocador; os dois
subindo juntos → vale o `--ipc` para ver se é V8 ou Buffer.

Com o script versionado no VPS, é:

```bash
cd ~/wabot && node scripts/diag-memoria-crescimento.mjs --ipc     # a cada hora
cd ~/wabot && node scripts/diag-memoria-crescimento.mjs --serie   # depois de 3+ medidas
```

⚠️ `--ipc` manda **um** comando `getBotMetrics` por robô (43), com 3 em
paralelo e timeout de 5 s cada — o painel manda o mesmo comando a cada
carregamento de tela. Não é carga nova.

⚠️ **Não** usar `kill -USR1` (inspector) nem heap snapshot em produção: o
snapshot pausa o processo por segundos e derruba o keepalive do WhatsApp. Heap
snapshot é para staging, com a mesma conta, e só se o veredito for
`vazamento_js`.

## 4. As alavancas, uma a uma

Para cada uma: mecanismo, estimativa por processo, como medir, risco para as
sessões, como reverter sem redeploy.

### 4.1 jemalloc nos robôs (`WA_WORKER_LD_PRELOAD` + `WA_WORKER_MALLOC_CONF`)

- **Mecanismo:** troca o alocador do processo por `LD_PRELOAD`. O jemalloc
  devolve páginas sujas ao sistema por tempo (`dirty_decay_ms`) numa thread de
  fundo, e não tem o limiar dinâmico de `mmap` do glibc.
- **Estimativa:** no churn sintético, retenção de 69 → 10 MiB. Custo fixo +5 a
  9 MiB e +1-3 threads. Se a retenção de produção se comportar como a
  sintética, robô assentado cai de ~120 para ~70-80 MiB — **~1,5 a 2 GB na
  frota**. Se não se comportar, o custo fixo é o preço da resposta (~0,3 GB).
- **Como medir:** `--serie` antes (frota assentada, 24 h) e depois (mesmas 24 h
  de idade), comparando inclinação de `glibc` (vai a zero — jemalloc não usa
  `[heap]`) e o `PSS` médio à mesma idade.
- **Risco:** baixo-médio. jemalloc + Node é caminho batido; o motor do Prisma
  (Rust) e o libvips passam a alocar nele também. O que confere em staging:
  sessão conecta, foto sai, banco grava, 24 h sem crash, `eventLoopDelayMs.p99`
  igual. **`LD_PRELOAD` de arquivo inexistente não derruba o processo** (o
  loader avisa e segue com glibc — medido). Requer `apt install libjemalloc2`
  no VPS — pacote do sistema, sem processo novo, mas é mudança de host:
  anunciar.
- **Reverter sem redeploy:** apagar as duas linhas do `.env` +
  `pm2 restart bot-supervisor --update-env` (reconecta a frota — como qualquer
  mudança de fork).
- **Config recomendada:** `background_thread:true,dirty_decay_ms:5000,muzzy_decay_ms:5000,narenas:2`.
  `narenas:2` mantém o que a janela 1 conquistou (padrão do jemalloc seria
  4 × núcleos = 32 arenas).

### 4.2 Limiares fixos do glibc (`WA_WORKER_MALLOC_MMAP_THRESHOLD` / `_TRIM_THRESHOLD`)

- **Mecanismo:** setar qualquer limiar **desliga o ajuste dinâmico**; buffer
  ≥ 64 KB volta a vir de `mmap` e é devolvido no `free`.
- **Estimativa:** retenção −42% no sintético (69 → 40). Sem custo fixo.
- **Risco:** baixo. Custo em CPU: `mmap`/`munmap` + zerar página a cada buffer
  grande (imagens, HTML). CPU está 98% ociosa.
- **Quando usar:** se o jemalloc for recusado (pacote no host) ou reprovado.
  **Não somar com jemalloc** (as envs `MALLOC_*` do glibc são ignoradas por
  ele; não atrapalham, mas confundem a leitura).
- **Reverter:** apagar as linhas + restart do supervisor.

### 4.3 Geração jovem do V8 (`WA_WORKER_MAX_SEMI_SPACE_MB=8`)

- **Mecanismo:** §2.3. Semi-space de 16 → 8 MiB; new_space físico de 32 → 16.
- **Estimativa:** −14 MiB por robô **sob tráfego** (robô ocioso não ganha nada).
  Na frota, até ~0,6 GB nas horas cheias.
- **Como medir:** `--ipc` mostra `V8tot` (heapTotal) por robô; deve cair ~16
  MiB nos robôs ativos. Critério de aprovação: `eventLoopP99Ms` igual ou menor.
- **Risco:** baixo. Scavenges mais frequentes e mais curtos (medido).
- **Reverter:** apagar a linha + restart do supervisor.

### 4.4 `--optimize-for-size` (`WA_WORKER_V8_OPTIMIZE_FOR_SIZE=1`)

- **Mecanismo:** §2.3. Semi-space de 1 MiB, fator de crescimento do heap
  conservador, menos código otimizado retido.
- **Estimativa:** −13 MiB fixos + até −37 sob tráfego, por robô. Potencial de
  **~1 a 2 GB** na frota.
- **Risco:** médio. Mais GC (10% vs 6% de CPU no sintético) e menos
  otimização de JIT — o libsignal (crypto em JS puro) pode ficar mais lento
  por mensagem. Só depois de 4.3 aprovada, e medindo `eventLoopP99Ms` e o
  tempo de preparo das mensagens (`timeout:incoming` no painel).
- **Reverter:** apagar a linha + restart do supervisor.

### 4.5 `nodemailer` fora do robô (lazy import) — código, próxima janela

- **Mecanismo:** `src/bot-worker.js` importa `email/adminAlerts.js` no topo só
  para o aviso interno de número repetido; isso arrasta `nodemailer`, o
  despachante e os 78 KB de textos do catálogo para 43 processos.
- **Estimativa:** ~3 MiB por robô (~0,13 GB na frota). Pequeno, mas de graça.
- **Risco:** baixíssimo (import dinâmico no ponto de uso). É mudança em
  `bot-worker.js` → só vale após restart do supervisor: **agrupar com a
  próxima janela de código de worker**, nunca sozinha.

### 4.6 Prisma sem o motor Rust — registrar, não fazer agora

- **Mecanismo:** Prisma ≥ 6.16 tem o "query compiler" em JS + driver adapter
  (`better-sqlite3`), sem `libquery_engine` e sem tokio.
- **Estimativa:** −7 MiB privados e −10 a −16 threads por robô; `better-sqlite3`
  põe ~2-3 MiB de volta. Saldo ~−5 MiB × 43 ≈ 0,2 GB.
- **Risco:** alto (upgrade de major do Prisma, toca todo caminho de banco).
  **Não vale por memória.** Fica registrado para quando o Prisma for
  atualizado por outro motivo.

### 4.7 `WA_WORKER_TOKIO_THREADS=2` — agora verificado, continua pequeno

Honrado pelo motor (§2.4). Ganho: pilhas e caches por thread, ~1-3 MiB por
robô. Risco médio (consulta ao banco serializada em 2 threads; vigiar
`ops_sqlite_busy`). Só depois das alavancas grandes, e sozinho na sua janela.

## 5. A arquitetura 1-processo-por-cliente: o que custa e o caminho do meio

**O que o isolamento custa hoje, medido:** o custo fixo por processo é o grafo
de imports — ~71 MiB privados — e 45 deles são o Baileys, que existiria por
sessão de qualquer jeito. A consolidação (shard) atacaria os ~26 MiB restantes
por cliente (sharp, Prisma, ioredis, nodemailer, Node) e foi **medida e
reprovada** em 16/09: dentro do shard a sessão custou 244 MiB em vez de 128. A
esta altura dá para dizer POR QUE: num processo com mais tráfego a retenção do
alocador cresce mais — o shard concentrava o churn de N clientes num heap só.
Isso não é argumento contra o isolamento; é argumento contra o glibc.

**O que NÃO existe para ganhar:** compartilhamento de heap entre forks (§2.4)
e "hibernar" sessão (não se acorda por mensagem sem socket; e as 5 contas sem
origem eram clientes em teste no meio da configuração — encerrado em 17/09).

**O único caminho intermediário que preserva isolamento de falha e posse
única da credencial:** tirar do processo da sessão o trabalho **pesado e sem
estado** — download de HTML, busca de foto, `sharp` — para um pool pequeno
(2-3 processos) forkado pelo supervisor, falando por IPC. O processo da sessão
fica com Baileys + Prisma + fila; o socket e o `AUTH_INFO_DIR` continuam de um
dono só.

| | ganho por sessão | o que perde |
|---|---|---|
| libvips fora | ~10 MiB fixos + threads | — |
| churn de buffer fora | a maior parte da retenção (§2.2) e as pausas de GC do scraping saem do processo que mantém o keepalive | falha no pool degrada foto (card sem foto → plano B), não sessão |
| custo | 2-3 processos × ~120 MiB, e a retenção concentrada neles (paga 3 vezes, não 43) | mais IPC de Buffer, mais um timeout no caminho da mensagem |

**Não é para agora.** Antes de tocar arquitetura, jemalloc responde a mesma
pergunta (retenção) por uma linha de `.env` — se ele resolver, o pool deixa de
ter motivo de memória e sobra só o argumento de estabilidade do event loop, que
merece rodada própria com medição de `eventLoopP99Ms`.

## 6. Ordem de execução (ganho ÷ risco)

| # | ação | reinicia a frota? | ganho estimado | risco |
|---|---|---|---|---|
| 1 | **Medir 24 h** com `diag-memoria-crescimento.mjs` (ou o bloco da §3) | **não** | a resposta de qual balde cresce | zero |
| 2 | `apt install libjemalloc2` no VPS + staging com 4.1 e 4.3 ligadas por 24 h | staging | prova de "nada quebra" | baixo |
| 3 | **Produção: 4.1 + 4.3 na MESMA janela** (uma reconexão) | sim, uma vez | ~1,5-2,5 GB | baixo-médio |
| 4 | Medir 24 h de novo; comparar `--serie` com o passo 1 | não | o número real | zero |
| 5 | `--optimize-for-size` (4.4), sozinho, só se 3 aprovou e sobrou apetite | sim | ~1-2 GB | médio |
| 6 | lazy `nodemailer` (4.5) na próxima janela de código de worker | carona | 0,13 GB | baixíssimo |
| 7 | `TOKIO_WORKER_THREADS=2` (4.7), sozinho | sim | ~0,1 GB | médio |

⚠️ **4.1 e 4.3 juntas, de propósito.** A rodada anterior defendia uma alavanca
por janela para preservar atribuição. Aqui as duas agem em baldes que o medidor
separa (glibc vs. heap do V8), então a atribuição se preserva mesmo aplicadas
juntas — e cada janela custa uma reconexão de 43 sessões.

**Aplicar exige código em produção:** os interruptores novos entram em
`src/core/workerSpawnOptions.js`, que casa com `WORKER_CODE_PATHS_RE` — o deploy
para `main` **reinicia o supervisor**. Fazer o merge na mesma janela em que as
envs são escritas no `.env` (como o passo D da rodada anterior): uma
reinicialização, não duas.

## 7. Runbook

### Staging

```bash
sudo apt-get install -y libjemalloc2 && ls -l /usr/lib/x86_64-linux-gnu/libjemalloc.so.2
cd ~/wabot-staging && cat >> .env <<'ENV'
WA_WORKER_LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
WA_WORKER_MALLOC_CONF=background_thread:true,dirty_decay_ms:5000,muzzy_decay_ms:5000,narenas:2
WA_WORKER_MAX_SEMI_SPACE_MB=8
ENV
pm2 delete api-staging && pm2 start ecosystem.config.cjs --only api-staging && pm2 save   # staging é inline: quem forka é a api
sleep 60; w=$(pgrep -f "/home/deploy/wabot-staging/src/bot-worker" | head -1)
tr '\0' '\n' < /proc/$w/environ | grep -E "LD_PRELOAD|MALLOC_CONF"          # tem que aparecer
grep -c jemalloc /proc/$w/maps                                              # > 0 = alocador trocado
tr '\0' '\n' < /proc/$w/cmdline | grep semi                                 # --max-semi-space-size=8
```

Aprovação em staging (24 h): sessão conectada, oferta com foto saindo,
`bot.log` sem erro novo, `ALVO=staging node scripts/diag-memoria-crescimento.mjs --ipc`
com `p99ms` igual ao de antes. **Staging não mede economia** (uma sessão, sem
tráfego) — mede que nada quebra.

### Produção (só com OK, anunciado)

```bash
bash /tmp/medir.sh antes                                 # o medidor da rodada anterior continua valendo
cd ~/wabot && node scripts/diag-memoria-crescimento.mjs --ipc   # se já estiver em main
cat >> ~/wabot/.env <<'ENV'
WA_WORKER_LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
WA_WORKER_MALLOC_CONF=background_thread:true,dirty_decay_ms:5000,muzzy_decay_ms:5000,narenas:2
WA_WORKER_MAX_SEMI_SPACE_MB=8
ENV
# merge develop -> main (o deploy reinicia o supervisor e os robôs nascem com as envs)
# ou, se o código já estiver em main: pm2 restart bot-supervisor --update-env && pm2 save
w=$(pgrep -f "/home/deploy/wabot/src/bot-worker" | head -1); grep -c jemalloc /proc/$w/maps
```

Depois: `diag-memoria-crescimento.mjs --ipc` 1x/hora por 24 h e `--serie`. O
número a comparar é o **PSS médio à mesma idade de frota** e a inclinação de
`glibc` (deve ir a ~0 com jemalloc).

**Rollback (qualquer uma):**

```bash
sed -i '/^WA_WORKER_\(LD_PRELOAD\|MALLOC_CONF\|MAX_SEMI_SPACE_MB\|V8_OPTIMIZE_FOR_SIZE\)=/d' ~/wabot/.env
pm2 restart bot-supervisor --update-env && pm2 save    # reconecta a frota
```

## 8. O que NÃO atacar, e por quê

| não atacar | por quê |
|---|---|
| **Baileys (45 MiB privados)** | é a sessão. Reduzir exigiria fork da lib (WAProto de 11 MB é carregado inteiro). `--jitless` não ajuda e quebra o grafo |
| **`--max-semi-space-size` abaixo de 8** | promoção precoce come o ganho (old-space 4,5 → 16,8 com 4) |
| **`sharp.cache(0)`** | cache já em 8 MB; só enche com operação repetida. Ganho zero medido |
| **trocar `axios` por `fetch`** | <1 MiB |
| **`UV_THREADPOOL_SIZE`** | continua descartado: serve DNS/fs do scraping; ganho de thread é ~100-200 KB cada |
| **`--v8-pool-size`** | GC paralelo → pausa mais longa; ganho de memória desprezível |
| **shard / consolidação** | medido e reprovado; e agora se entende por quê (§5) |
| **`useMultiFileAuthState` → store cacheado** | AUMENTA memória (hoje lê arquivo por chave, sem cache); é CPU/IO, não RAM |
| **stream em vez de Buffer no HTML/imagem** | reduz só o PICO; a retenção é do alocador, e jemalloc a resolve na raiz por uma linha |
| **subir `IMAGE_HTML_MAX_BYTES`/`IMAGE_BUFFER_MAX_BYTES` para baixo** | quebra o scrape da Amazon (regra canônica) e só mexe no pico |
| **heap snapshot / inspector em produção** | pausa de segundos derruba o keepalive. Só staging, só com veredito `vazamento_js` |
| **hibernar sessão ociosa** | não acorda por mensagem; e não há robô ocioso de verdade (17/09) |
| **build do Node com pointer compression** | halve o heap do V8, mas é binário próprio do Node — fora do orçamento operacional |

## 9. Buffers presos na fila — hipótese a confirmar, não a aplicar

`buildPayload` é lazy de propósito (BullMQ não serializa Buffer) e captura
`cachedImages`/`cachedOriginPhoto` da mensagem até o **último destino** sair.
Um destino com preservação apertada segura jobs por horas
(`queueMaxAgeMin`, 5 h) — e com eles as fotos. É a única hipótese desta rodada
que apontaria para **código**, e por isso é a que exige dado: o medidor com
`--ipc` mostra `arrBuf` e `fila` por robô; correlação positiva entre os dois é
a prova. Se confirmar, o conserto é pequeno (soltar as referências quando o
último job da mensagem termina), vai na próxima janela de código de worker, e
o veredito `buffers_em_fila` do `--serie` é o gatilho.

## 10. Limites desta rodada

- Números de §2 são deste ambiente (4 núcleos, glibc 2.39). Produção tem 8
  núcleos e 29 threads; a ordem das alavancas vale, os MiB exatos não.
- O churn da §2.2 imita o pipeline (tamanhos de HTML/imagem, fila de 8), não o
  reproduz. A retenção real de produção pode ser maior (mais tempo, mais
  variedade de tamanho) ou menor.
- O saldo do jemalloc depende de quanto da retenção de produção é alocador —
  a §3 responde isso ANTES de aplicar, sem custo.
- `--optimize-for-size` foi medido em workload de JSON; o custo em CPU do
  libsignal (crypto por mensagem) não foi medido.
- Nada aqui mexeu em `sessionCore.js` ([PROTECTED_CORE]): os interruptores
  entram pelo mesmo `resolveWorkerSpawnEnv`/`resolveWorkerExecArgv` da rodada
  anterior.

## 11. Resultado em produção (2026-09-23)

As duas alavancas (jemalloc com purga em segundo plano e semi-space 8) estão em
produção desde 2026-09-22 ~22:50 UTC. Medido por 24 h, na mesma idade de robô:

| Idade do robô | `RssAnon` antes | `RssAnon` depois |
|---|---:|---:|
| 0 a 2 h | 108,4 MiB | 86,6 MiB |
| 2 a 6 h | 131,4 MiB | 96,6 MiB |
| 6 a 12 h | 142,3 MiB | 93,5 MiB |
| 12 a 24 h | 146,4 MiB | 103,7 MiB |

O crescimento com a idade caiu de 0,90 para 0,63 MiB/h na memória anônima e de
2,02 para 0,73 MiB/h no RSS total. A memória do V8 não mudou, então o ganho é
do alocador, como a §2.2 previa. Nenhum crash atribuível ao jemalloc.

Detalhes, lições de método e o incidente do restart que colidiu com um deploy
ficam em `docs/rca/memoria-e-capacidade.md`, seção "Resultado em produção".
