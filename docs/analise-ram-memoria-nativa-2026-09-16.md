# Reduzir RAM atacando a memória NATIVA — análise 2026-09-16

> Continuação de `docs/diagnostico-rss-sessoes-whatsapp-2026-09-13.md`,
> `docs/poc-shard-4-sessoes-teste-controlado.md` (POC reprovada) e
> `docs/revisao-poc-shard-ram-2026-09-16.md` (§9 e §10, as medições que a
> reprovaram). **Nenhuma linha de produção foi alterada por esta análise.** O
> que entra no repositório aqui é um instrumento somente-leitura
> (`scripts/diag-memoria-nativa.mjs`) e este documento.

## 0. Resumo em quatro linhas

1. **O QUE ACONTECEU:** a tentativa de juntar sessões num processo só (shard)
   foi medida e reprovada — consolidar **gasta mais**, não menos. O que sobrou
   sem resposta é: 94% do custo de uma sessão é memória nativa que
   `process.memoryUsage()` não enxerga, e ninguém olhou **de que tipo** ela é.
2. **PORQUE:** todas as medições até aqui usaram totais (`smaps_rollup`, RSS,
   heap). Total não diz se a memória é arena do alocador, heap do V8, pilha de
   thread ou biblioteca — e cada uma dessas pede uma ação diferente.
3. **O QUE DEVE SER FEITO:** rodar a decomposição (30 segundos, leitura pura de
   `/proc`), e só então escolher entre as quatro alavancas da §3.
4. **COMO:** a ordem prática está na §5. Nada aqui é aplicado sem o OK da dona
   do produto — REGRA #1 da política de memória.

## 1. Os números que valem (não re-medir)

| Medida | Valor | Fonte |
|---|---:|---|
| RAM do servidor | 15,6 GB | 2026-09-11 |
| Robôs ligados / teto configurado / limite seguro da política | 42 / 40 / 35 | 2026-09-11 |
| Custo por robô | **218 MiB PSS** (314 RSS) | 2026-09-16 |
| Base fixa (api + dashboard + supervisor + staging) | ≈ 1,0 GB | 2026-09-11 |
| Swap em uso / tráfego de swap | 41 MB / **zero** | 2026-09-11 |
| CPU ociosa | 98% | 2026-09-11 |

**O amarelo em `/admin/capacidade` vem da contagem de vagas, não de recurso.**
`evaluateCapacity` reserva o maior valor entre 20% da RAM e 1.536 MB e divide o
resto por 350 MB/robô: `(15.613 − 3.123) / 350 = 35`. Com 42 ligados a folga
pela política é negativa, com RAM, disco, CPU e swap todos verdes.

⚠️ **Não somar processos por RSS.** RSS conta a mesma página compartilhada uma
vez por processo e superestima qualquer economia de consolidação. Todo número
desta análise é PSS (`/proc/<pid>/smaps_rollup`). No mesmo instante, o mesmo
processo media RSS 146 e PSS 81.

## 2. A conta que reorienta a investigação

A aritmética da POC deixou, sem querer, a decomposição do custo de um worker:

```text
worker dedicado (PSS)        218 MiB
  − custo fixo do processo    90 MiB   (Node + Baileys + Prisma + Sharp carregados)
  = custo da sessão          128 MiB   (socket, Signal, filas, estado por conta)
```

**O custo fixo é ~41% da memória da frota: 42 × 90 MiB ≈ 3,8 GB.** Era
exatamente isso que a consolidação existia para atacar — um processo em vez de
42 pagaria o fixo uma vez só. Ela falhou porque, dentro do shard, a sessão
passou a custar 244 MiB em vez de 128 (90% a mais), e o que se ganhava no fixo
se perdia com folga no variável.

A conclusão prática não é "desistir do custo fixo". É **atacá-lo sem
multi-tenancy**: tirar de dentro de cada processo aquilo que ele carrega e não
precisa carregar. É o que a §3 lista.

E a parte variável (128 MiB por sessão) é justamente a que **não aparece no
heap**: dos 243,5 MiB que a sessão adicionou ao shard, só 14 MiB estavam em
`heapUsed` + `external`. Os outros 229,5 MiB são nativos.

## 3. As alavancas ainda não testadas

Ordem por **ganho ÷ risco**, começando pelo que não exige reiniciar o
`bot-supervisor` (reiniciar reconecta as 42 sessões de uma vez — decisão
humana, anunciada antes).

---

### 3.0 — Antes de tudo: descobrir de que é feita a memória nativa

**Risco: zero.** Leitura de `/proc`. Não reinicia nada, não escreve nada, não lê
`.env` nem banco.

Tudo o que foi medido até aqui é total. `smaps_rollup` diz **quanto**; só o
`smaps` completo diz **o quê**. As quatro respostas possíveis pedem ações
opostas, e não dá para escolher a alavanca antes de saber qual delas é:

| O que o smaps mostrar | O que significa | Alavanca |
|---|---|---|
| `arena_glibc` com PSS alto e muitas arenas pequenas | memória liberada que nunca voltou ao sistema — fragmentação do alocador | §3.1 |
| `anonimo` dominando | heap do V8, buffers, pilhas de thread | §3.2 e §3.3 |
| `biblioteca` alta em PSS (não só em RSS) | código nativo por processo, não compartilhado como se supunha | §3.4 |
| nada disso destaca | o custo é difuso; aí a alavanca que resta é §3.5 |  |

```bash
cd ~/wabot && node scripts/diag-memoria-nativa.mjs --top=5
```

Ele imprime, por worker: PSS/RSS, número de threads, quantas arenas do glibc
existem e quanto PSS cada classe de região ocupa, mais as bibliotecas nativas
mais caras em PSS (aí aparece, com nome e tamanho, o motor do Prisma, o libvips
do Sharp e o OpenSSL). O bloco final já diz, em uma frase, para qual lado a
medição aponta.

Vale rodar também contra o supervisor e a API, para comparar:

```bash
node scripts/diag-memoria-nativa.mjs --padrao=supervisor
node scripts/diag-memoria-nativa.mjs --padrao=api/server.js
```

---

### 3.1 — Arenas do glibc (`MALLOC_ARENA_MAX`)

**Mecanismo.** O glibc cria até `8 × núcleos` arenas de alocação por processo —
com 8 vCPU, **até 64 arenas**, cada uma reservando 64 MiB de endereço virtual.
Memória liberada dentro de uma arena só volta ao sistema quando o topo dela está
livre; com várias threads alocando (pool do libuv, plataforma do V8, thread do
transporte de log, pool do libvips), as arenas ficam fragmentadas e o RSS sobe
sem o heap subir. É o retrato exato de "PSS cresce, `heapUsed` não".

**Ganho estimado: desconhecido, e provavelmente pequeno.** Tentei reproduzir o
efeito num teste controlado (8 tarefas concorrentes de AES-GCM + HMAC + buffers
de tamanho variado, que é o formato do trabalho do Signal por mensagem):

```text
MALLOC_ARENA_MAX=(padrão)  PSS 63,1 MiB   blocos reservados: 15
MALLOC_ARENA_MAX=2         PSS 61,7 MiB   blocos reservados: 11
```

**1,4 MiB — cerca de 2%.** O teste roda num ambiente de 4 núcleos e não
reproduz processo longevo nem o pool do libvips, então ele **não refuta** a
hipótese para produção; o que ele faz é tirar esta alavanca do topo da lista.
Quem decide é o número de `arena_glibc` da §3.0.

**Como medir antes de aplicar.** A coluna `arenas`/`PSS(arenas)` do
`diag-memoria-nativa.mjs`. Se as arenas responderem por menos de ~15% do PSS,
**não aplicar** — o ganho não paga nem a mudança de env.

**Risco: baixo, mas não é de graça.** É variável de ambiente, nenhuma linha do
caminho de sessão muda, e desligar é apagar a linha. Dois cuidados: (a) limitar
arenas aumenta disputa de trava entre threads no `malloc` — com CPU 98% ociosa
há folga, mas é preciso conferir o event loop depois; (b) o glibc lê a variável
**no início do processo**, então ela só vale para worker forkado depois de o
supervisor já tê-la no ambiente — ou seja, exige `pm2 delete` + `start` do
supervisor (pegadinha #1) e reconecta a frota. **Validar em staging primeiro.**

---

### 3.2 — A thread de transporte do log (uma isolate inteira do V8 por processo)

**Esta é a de melhor ganho ÷ risco, e o ganho está medido.**

**Mecanismo.** `src/logger.js` usa `pino({ transport: { targets: [...] } })`.
Desde o pino 7, `transport` não é um destino: é um `thread-stream`, que **sobe
uma worker thread** — e worker thread no Node é uma **isolate do V8 inteira**,
com heap, pilha e arenas próprios. Ela não aparece em `heapUsed`/`heapTotal`
(que são da isolate principal) e aparece inteira no RSS. É literalmente o
formato do achado "94% invisível".

Medido neste ambiente, uma worker thread **vazia**:

```text
sem worker thread:  PSS 44,6 MiB
com worker thread:  PSS 56,3 MiB   (delta 11,7 MiB, reproduzido 2x)
```

**11,7 MiB é o piso.** A thread real do produto carrega `pino-pretty` dentro
dela e colore cada linha de log, então custa mais — quanto, só medindo.

**Ganho estimado: ≥ 11,7 MiB por processo.** Vale para os 42 workers **e** para
api, dashboard, supervisor e os três de staging: **≥ 0,55 GB na frota**, mais
CPU e mais disco (o `bot.log` deixa de ser escrito em formato colorido).

⚠️ **A correção não é "tirar o `pino-pretty`".** Enquanto sobrar um alvo em
`transport`, a thread continua existindo. O que remove a thread é trocar o
mecanismo por um destino direto em produção
(`pino(opts, pino.destination({ dest: logFile }))`), mantendo o `pino-pretty`
só fora de produção. Dois ganhos no mesmo lugar: some a thread **e** some a
serialização dupla de cada linha.

**Como medir antes de aplicar.** Contagem de threads por worker, hoje:

```bash
for p in $(pgrep -f "/home/deploy/wabot/src/bot-worker"); do
  printf "%s %s threads\n" "$p" "$(ls /proc/$p/task 2>/dev/null | wc -l)"
done | sort -k2 -rn | head
```

Depois, em staging, medir PSS de um worker antes e depois pelo
`diag-memoria-nativa.mjs`.

**Risco: baixo.** O `bot.log` continua igual em conteúdo (só perde a cópia
colorida no log do PM2, que ninguém lê para RCA — os RCAs deste produto leem o
`bot.log`). Reversível por env. **Custo real:** `src/logger.js` está em
`WORKER_CODE_PATHS_RE`, então o deploy reinicia o supervisor e reconecta a
frota. Deve ir junto com as outras mudanças de código de worker, numa reinicialização
anunciada só.

---

### 3.3 — Sharp / libvips: 50 MB de cache nativo e um pool de threads por worker

**Mecanismo.** Cinco módulos importam `sharp` no topo
(`imageScrapers`, `inlineThumbnail`, `storeBrandCard`, `destinationWatermark`,
`imageMutation`), e todos são alcançados por `bot-worker.js`. Ou seja: **todos
os 42 workers carregam o libvips.** Os defaults do Sharp, nunca alterados neste
repositório (`grep -rn "sharp\.\(cache\|concurrency\)" src/` não devolve nada):

- `sharp.cache()` → **50 MB de cache de operação, por processo**, memória nativa
  pura, invisível em `heapUsed`;
- `sharp.concurrency()` → número de núcleos, ou seja **8 threads de libvips por
  worker**, cada uma com pilha e arena próprias.

**Ganho estimado: até 50 MiB por worker que já processou imagem**, mais 7
threads por worker. Na frota, isso é da ordem de **1-2 GB** — mas o cache enche
preguiçosamente, então o ganho real depende de quantos workers de fato passaram
por uma operação de imagem. A medição da §3.0 responde isso sem adivinhação (a
linha `libvips` em "bibliotecas mais caras" e a contagem de threads).

**Como medir antes de aplicar.** Comparar o PSS e a contagem de threads dos
workers que publicaram foto nas últimas horas contra os que não publicaram:

```bash
cd ~/wabot && node scripts/diag-memoria-nativa.mjs --top=8
# cruzar com quem enviou imagem, pelo MessageLog do período
```

**Risco: baixo.** `sharp.cache({ memory: 0, files: 0, items: 0 })` custa
re-decodificar quando a MESMA operação se repete — cenário raro aqui, porque
cada oferta traz uma foto diferente. `sharp.concurrency(1)` deixa um
redimensionamento isolado mais lento; as fotos são pequenas e a CPU está 98%
ociosa. Nenhum dos dois muda o resultado da imagem publicada. Reversível por
env. Mesmo custo de deploy da §3.2 — agrupar.

**Extra do mesmo tema:** importar `sharp` sob demanda (dentro da função que
processa imagem, não no topo do módulo) tira o libvips do processo de quem nunca
publica foto. Ganho menor em PSS (o `.so` é compartilhado entre os 42), mas tira
a inicialização e o pool de threads. Só vale a pena se a §3.0 mostrar `libvips`
pesando em PSS, não só em RSS.

---

### 3.4 — Quanto custa ter 42 cópias do motor do Prisma

**Mecanismo.** `src/db.js` faz `new PrismaClient()`, e o worker importa `db.js`
no topo. O Prisma 5 usa, por padrão, o motor de consulta em Rust carregado como
biblioteca nativa (`libquery_engine-*.node`) dentro do processo — com seu
próprio alocador, seu próprio pool e a representação do schema (que aqui é
grande) em memória. **Isso acontece 42 vezes.**

**Ganho estimado: não estimo — e é exatamente por isso que está nesta lista.**
Qualquer número que eu desse aqui seria analogia, e foi analogia ("miniatura de
card costuma ter 3-20KB") que produziu o piso de 3000 bytes que teve de ser
desfeito no mesmo dia. O `diag-memoria-nativa.mjs` imprime o PSS de
`libquery_engine` por worker **sem estimar nada**. Se der dezenas de MiB por
processo, existe aqui uma conversa de arquitetura (o worker fala com o banco por
IPC em vez de abrir cliente próprio); se der poucos MiB, o assunto morre com
uma linha de medição.

**Como medir:** a seção "bibliotecas mais caras (PSS)" da §3.0.

**Risco de aplicar qualquer coisa aqui: ALTO.** Tirar o Prisma do worker muda o
caminho de leitura de configuração, credencial e `MessageLog` de todas as
sessões. **Não recomendo implementar** — recomendo **medir** e registrar o
número. É informação barata que hoje não existe.

---

### 3.5 — Robôs ligados que não precisam estar ligados

**Mecanismo.** Não ter processo é 100% de economia, com raio de dano de uma
conta. A revisão levantou isso (§4.E) e ninguém mediu: das 146 sessões
persistidas, 110 estavam desconectadas e 15 paradas pela cliente. A pergunta é
quantos dos **42 workers vivos** pertencem a conta que não usa o robô.

Conta com acesso vencido **já sai sozinha** (`loadConfig` → `process.exit(0)`,
com o `status` persistido para não entrar em laço de ressurreição), então esse
caso está coberto. O que não está medido é: worker de conta **sem nenhuma
origem monitorada** e worker de conta cuja última conexão é antiga.

**Ganho estimado: 218 MiB por worker que não precisava existir** — o maior
ganho por unidade desta lista, e o único que não depende de hipótese sobre
memória nativa. Quantas unidades existem, ninguém sabe.

**Como medir (somente leitura, sem tocar em sessão):**

```bash
cd ~/wabot && sqlite3 prisma/prod.db "
SELECT u.email,
       (SELECT COUNT(*) FROM \"Group\" g WHERE g.userId = u.id AND g.type = 'monitor') AS origens,
       s.status, s.lifecycle, u.plan, u.accessExpiresAt
  FROM WaSession s JOIN User u ON u.id = s.userId
 WHERE s.status IN ('connected','connecting')
 ORDER BY origens ASC;"
```

Linha com `origens = 0` é robô que recebe mensagem, descarta tudo e ocupa uma
vaga.

**Risco: médio, e é risco de PRODUTO, não de memória.** Desligar o robô de uma
cliente que só ainda não terminou de configurar é pior que o custo da memória —
ela abre o painel, vê desconectado e conclui que o produto não funciona. Por
isso: **medir primeiro, decidir com a dona do produto depois**, e qualquer
desligamento passa por `scripts/parar-sessao.mjs` (que marca parada de
propósito e não dispara o aviso de robô caído), nunca por `kill`.

---

## 4. O que eu NÃO recomendo atacar, e por quê

| Não atacar | Por quê |
|---|---|
| **Juntar sessões num processo (shard)** | Medido e reprovado: a sessão custa 244 MiB no shard contra 128 no worker dedicado. Não existe instante da janela em que o shard tenha sido mais barato. |
| **Teto de heap (`--max-old-space-size`) do shard ou dos workers** | Medido e descartado: `heapTotal` do shard ficou em 47,6 MiB com teto de 384. Não há teto a aplicar onde o heap nem chega perto. |
| **Painel de memória baseado em `process.memoryUsage()`** | Mede os 6% que não importam. Mostraria uma frota saudável enquanto a memória acaba. Se houver painel, que seja de PSS. |
| **jemalloc por `LD_PRELOAD`** | Muda o alocador de **todo** processo Node do servidor, o rollback é global e a sonda da §3.1 sugere que o alocador não é o protagonista. Só voltar a isso se a §3.0 mostrar arena dominando E o `MALLOC_ARENA_MAX` não resolver. |
| **Reescrever o `useMultiFileAuthState` para SQLite/Redis** | Mexe em credencial de WhatsApp de 42 contas, com ganho não quantificado. O pior desfecho possível deste produto é sessão perdida. Não antes de a §3.0 provar que o estado do Signal é o peso. |
| **Cap/poda no `imageCache`** | Já medido como pequeno: guarda URL → resultado, não buffers. Endurecer é higiene, não economia. |
| **Mais swap** | O swap está parado em 41 MB com `si`/`so` = 0. Não há pressão a aliviar. |
| **Subir `MAX_SESSIONS_PER_PROCESS` de novo** | É o oposto de reduzir RAM: hoje o teto (40) já está acima do limite seguro da política (35), com 42 ligados. Subir gasta a reserva que absorve pico de GC e scrape pesado. |
| **Vazamento por idade nos workers** | Inconclusivo por falta de dispersão: 41 dos 42 workers têm 2 h de vida. Só volta à mesa com uma frota de idades variadas — ou acompanhando 3-4 workers por algumas horas com a cadência da §3.0. |
| **Vazamento no supervisor** | Medido e descartado: RSS 124 MiB contra teto de 400 MB, estável, e todos os restarts do PM2 são padrão de deploy. |

## 5. Ordem recomendada

1. **Rodar a §3.0** (30 segundos, leitura pura). É o que decide as próximas
   escolhas; tudo o que vem depois muda conforme o resultado.
2. **Rodar a medição da §3.5** (SQL somente leitura). Pode entregar o maior
   ganho da lista sem nenhuma mudança de código.
3. **Desligar o que sobrou da POC reprovada** — ver §6. Não precisa reiniciar o
   supervisor.
4. **Preparar §3.2 (log) e §3.3 (Sharp) juntas**, validar em staging com PSS
   antes/depois, e só então levar a produção **numa reinicialização anunciada
   só** do `bot-supervisor`.
5. **§3.1 (arenas)** entra na mesma leva **apenas se** a §3.0 mostrar arena
   acima de ~15% do PSS.
6. **§3.4 fica em medição**, sem implementação, até haver número.

Nenhum passo de 3 em diante é aplicado sem o OK explícito da dona do produto.

## 6. Resíduo da POC reprovada que ainda custa em produção

A POC está em `develop` **e em `main`**, com o padrão `observe`:

```js
// src/supervisor/index.js
const SHARD_POC_MODE = parseEnumEnv('WA_SESSION_SHARD_POC', process.env.WA_SESSION_SHARD_POC || 'observe', ...)
```

Isso contraria o padrão de interruptor de rollout deste repositório
(`COUPON_BRAND_CARD_ENABLED`, `WA_IGNORE_UNMONITORED_GROUPS`,
`BADSESSION_KEEP_ESTABLISHED_AUTH` nascem desligados) e deixa ligada uma rota
que, aberta, consulta a cada 5 segundos: `user.findMany` com join de sessão,
dois `messageLog.groupBy` de 24 h sobre todos os conectados, dois `findMany` de
200 linhas, quatro `getBotMetrics` e um `getShardMetrics` — num SQLite de 478 MB
com 42 workers escrevendo. É candidato direto a `SQLITE_BUSY`, que tem sinal
próprio no produto (`ops_sqlite_busy`).

**O caminho barato, hoje, sem reiniciar o supervisor:** `WA_SESSION_SHARD_POC=off`
no `.env` de produção e `pm2 delete api && pm2 start ecosystem.config.cjs --only api`
(pegadinha #1). Em modo `remote`, reiniciar a API **não toca nas sessões** — é
exatamente para isso que o `bot-supervisor` existe.

O padrão do código deveria virar `off` num PR próprio, junto da decisão de
manter ou remover o `src/session-shard-worker.js`. Isso é decisão da dona do
produto, não minha: o código está testado e pode servir de base se um dia a
premissa mudar.

## 7. Achado paralelo: 8 reinicializações do supervisor em 3 dias

2,7 por dia, cada uma reconectando as 42 sessões de uma vez. **Não é RAM** — é
exposição ao padrão que o WhatsApp associa a robô, e é o mesmo evento que a §3.2
e a §3.3 vão custar quando forem aplicadas.

Não precisa de código: basta **agrupar os deploys que tocam
`WORKER_CODE_PATHS_RE`** (`src/bot-worker.js`, `src/supervisor/`, `src/core/`,
`src/converters/`, `src/messageProcessor.js`, `src/manager.js`, `src/db.js`,
`src/logger.js`, `src/analytics.js`, `prisma/schema.prisma`,
`package-lock.json`) numa janela anunciada, em vez de deixá-los saírem um a um.
Deploy que mexe só em dashboard, rota, documentação ou teste continua não
reiniciando nada.

Conferir se as 8 foram mesmo deploy (se não foram, é incidente próprio):

```bash
pm2 describe bot-supervisor | grep -iE "uptime|restart"
```

## 8. Limites desta análise

- **Nada foi medido em produção por esta sessão.** Os números de produção vêm
  dos documentos de 11, 13 e 16 de setembro. As duas medições novas (worker
  thread e `MALLOC_ARENA_MAX`) foram feitas num ambiente de 4 núcleos e servem
  para ordenar a lista, não para estimar o ganho no servidor.
- **`sharp.cache()` = 50 MB e `sharp.concurrency()` = núcleos** são os padrões
  documentados da biblioteca, não medição minha. A §3.0 confirma em campo.
- O peso do motor do Prisma (§3.4) está deliberadamente **sem estimativa**.
- A decomposição do `smaps` classifica arena do glibc **pela forma** (bloco de
  64 MiB alinhado em 64 MiB, sem arquivo). O kernel não rotula arena; um
  alocador diferente do glibc não seria reconhecido como tal.
