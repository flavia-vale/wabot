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
3. **O QUE DEVE SER FEITO:** **a decomposição já foi rodada em produção
   (§2-A): 58% do PSS da frota é fragmentação do alocador do sistema.** A
   alavanca passou a ser uma variável de ambiente, e a segunda é reduzir as
   29-34 threads por robô que criam essas arenas.
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

## 2-A. A MEDIÇÃO (produção, 41 robôs, 2026-09-16) — ela reordena tudo

Rodada em produção com o bloco da §3.0. **Responde a pergunta que estava aberta
desde 13/09 e muda a ordem das alavancas.**

| Classe de região | PSS somado | % do total |
|---|---:|---:|
| **arena do glibc** | **4,95 GB** | **58%** |
| anônimo (heap do V8, buffers, pilhas) | 2,70 GB | 32% |
| heap principal (brk) | 0,69 GB | 8% |
| biblioteca (`.so`/`.node`) | 0,09 GB | 1% |
| arquivo | 0,05 GB | <1% |
| **total** | **8,70 GB** | |

Por worker: **28 a 34 arenas**, **29 a 34 threads**, PSS de 98,8 a 357,1 MiB.

### 2-A.1 Os três achados

**1. A memória invisível tem nome: é fragmentação do alocador.** 58% do PSS da
frota está em arena secundária do glibc — o balde que, por construção, é
memória que o processo já liberou e que nunca voltou ao sistema operacional. Não
é heap do V8 (que é `anonimo`), não é código (`biblioteca` é 1%).

**2. A variação entre workers é quase toda nas arenas — e isso é a prova de que
é fragmentação, não dado vivo.** Com o MESMO código e a MESMA contagem de
threads:

| | menor | maior | razão |
|---|---:|---:|---:|
| arena do glibc | 35,7 MiB | 228,3 MiB | **6,4×** |
| anônimo | 50,3 MiB | 98,6 MiB | 2,0× |

Se o peso fosse dado vivo, `anonimo` e `heap_principal` acompanhariam. Eles
quase não acompanham. **Se todos os 41 se comportassem como o melhor deles, as
arenas somariam 1,43 GB em vez de 4,95 GB — uma diferença de 3,5 GB.** Isso é o
TAMANHO DO PRÊMIO, não uma promessa de economia: concentrar arenas reduz a
folga, não elimina a necessidade de memória viva.

⚠️ **Não é idade.** Os pids mais baixos (processos que subiram primeiro) estão
entre os MAIS LEVES, e os grupos se misturam ao longo da tabela. O que separa é
histórico de alocação, ou seja, tráfego — exatamente o que produz fragmentação.

**3. A causa das arenas está à vista: 29-34 threads por worker.** O glibc cria
arena por disputa entre threads (teto de `8 × núcleos` = 64 aqui; a frota para
em ~30 porque é isso que as threads pedem). A conta bate com os pools que o
processo carrega:

| Pool | threads (estimativa pelo padrão de cada um) |
|---|---:|
| plataforma do V8 | ~7 (núcleos − 1) |
| pool do libuv | 4 (`UV_THREADPOOL_SIZE` padrão) |
| motor do Prisma (tokio) | ~8 |
| libvips do Sharp | ~8 (`sharp.concurrency()` = núcleos) |
| principal + transporte do pino | 2 |

**Threads são a torneira; arenas são a poça.** Fechar a torneira (menos threads)
e limitar o número de poças (`MALLOC_ARENA_MAX`) atacam o mesmo fenômeno por
pontas diferentes, e nenhuma das duas mexe em lógica de sessão.

### 2-A.2 O que a medição DERRUBOU

- **§3.4 (as 42 cópias do motor do Prisma) morre como custo de código.** A
  coluna `biblioteca` é **2,2 MiB de PSS por worker**, e no detalhe do maior
  worker só `libvips-cpp.so` passa de 1 MiB (2,1 MiB). `libquery_engine` sequer
  aparece. É o esperado: biblioteca compartilhada por 41 processos tem o PSS
  dividido por 41 — e é exatamente por isso que RSS engana. **Não há conversa de
  arquitetura a ter aqui.** O que o Prisma custa está dentro das arenas (threads
  do tokio + alocação), não no mapeamento do código.
- **Minha sonda local de `MALLOC_ARENA_MAX` (§3.1) subestimou por um fator
  grande** — 2% contra os 58% reais. O ambiente tinha 4 núcleos e poucas
  threads; produção tem 8 núcleos e 30 threads. Regime diferente, resultado
  diferente. **Fica registrado como lição de método:** sonda em ambiente que não
  reproduz o número de threads não serve para estimar fragmentação de alocador.

### 2-A.3 Ordem nova

1. **`MALLOC_ARENA_MAX`** (era §3.1, 4º lugar) — passa a **primeira**, com
   58% do PSS medido atrás dela.
2. **Reduzir threads** (novo, §3.6) — **prevenção, não correção**: a §2-A.6
   mostrou que threads são constantes na frota e não explicam a dispersão.
   Ainda assim, 16 das 29 são do motor do Prisma (§2-A.4) e cada thread a menos
   é uma arena a menos onde memória pode ficar presa.
3. **Thread do transporte do log** (§3.2) — continua valendo pelos 11,7 MiB da
   isolate medidos, e de quebra é uma arena a menos.
4. **Sharp** (§3.3) — só o cache nativo de 50 MB. A parte de threads está
   **morta**: `vips` deu zero nos 41 robôs (§2-A.6).
5. **Robôs que não precisam estar ligados** (§3.5) — inalterado.
6. ~~Prisma (§3.4) como custo de código~~ — encerrado. Mas **reaberto como
   produtor de threads**, dentro de §3.6.

⚠️ **O que ainda NÃO está medido:** quanto `MALLOC_ARENA_MAX=2` de fato devolve.
Os 3,5 GB acima são o teto teórico se a fragmentação fosse a zero, não previsão.
E limitar arenas aumenta disputa de trava no `malloc` entre as 30 threads — com
CPU 98% ociosa há folga, mas o event loop precisa ser conferido depois.

### 2-A.4 De onde vêm as 29 threads (medido, 2026-09-16)

```text
     16 tokio-runtime-w     <- motor do Prisma (Rust)
      7 node                <- plataforma do V8
      4 libuv-worker        <- pool do libuv
      1 opentelemetry-e     <- exportador do Prisma
      1 DelayedTaskSche     <- agendador do V8
```

**O motor do Prisma é 55% das threads de cada robô.** Dezesseis threads
assíncronas por processo — vezes 41 robôs, **656 threads no servidor** — para
falar com um arquivo SQLite. SQLite é banco embutido: não há conexão de rede
nem pool remoto que justifique esse número. É o padrão do tokio (threads =
núcleos, mais o pool de bloqueio), e ninguém nunca o ajustou aqui.

E são as threads que criam as arenas. Ou seja: o mesmo Prisma que a §2-A.2
tinha ENCERRADO como custo de código volta como **o maior produtor de threads
da frota** — mecanismo diferente, prioridade oposta.

### 2-A.5 Duas correções minhas que a medição impôs

**1. Sharp NÃO estava criando 8 threads.** Eu escrevi, na §3.3, "8 threads de
libvips por worker". **Zero threads de vips na amostra.** O libvips está
carregado (`libvips-cpp.so` aparece com 2,1 MiB de PSS), mas o pool dele é
criado sob demanda e esse worker não tinha nenhuma operação em curso. O número
veio do padrão documentado da biblioteca, não de medição — exatamente o tipo de
analogia que esta análise diz para não fazer. **§3.3 cai de posição**: o cache
de 50 MB continua de pé como hipótese (e mora dentro das arenas), mas a parte
de threads não se sustenta como estava escrita.

**2. §3.4 (Prisma) foi encerrada cedo demais.** A conclusão sobre CÓDIGO
continua certa (2,2 MiB de PSS por worker, `libquery_engine` nem aparece). O que
eu não vi é que o custo dele não estava no código nem nas arenas diretamente —
está nas **16 threads** que produzem as arenas. Reaberta, com alavanca nova
(§3.6), não com a reescrita de arquitetura que eu havia descartado.

### 2-A.6 A correlação foi medida — e o veredito é limpo

```text
41 robos | 1189 threads (tokio 656 = 55%, vips 0) | 1219 arenas | 5215 MiB em arena
```

| | menor | maior | varia |
|---|---:|---:|---|
| threads por robô | **29** | **29** | **nada** |
| threads do Prisma | **16** | **16** | **nada** |
| threads do vips | **0** | **0** | **nada** |
| arenas por robô | 28 | 33 | 1,2× |
| **MiB em arena** | **35,8** | **237,0** | **6,6×** |

**Os 41 robôs têm exatamente a mesma contagem de threads e praticamente a mesma
contagem de arenas. O que varia 6,6× é só o quanto ficou preso dentro delas.**

Isso responde a pergunta e inverte a ordem que eu tinha proposto:

- **Não é "mais threads ⇒ mais arenas ⇒ mais memória".** Threads e arenas são
  constantes na frota; a memória não é. Cortar thread **não explica nem corrige
  a dispersão** — ela vem do histórico de alocação de cada conta, ou seja, de
  tráfego.
- **O problema é reaproveitamento, não quantidade.** Bloco liberado dentro da
  arena nº 17 só pode ser reusado por thread ligada à arena nº 17. Com ~30
  arenas por processo, memória livre numa não serve para a outra: é assim que
  se chega a 7,2 MiB presos por arena no robô pesado contra 1,3 MiB no leve.
  **Concentrar em 2 arenas ataca exatamente isso** — é a alavanca §3.1, e agora
  ela está sozinha na frente.
- **Cortar thread continua valendo, mas em segundo lugar e por outro motivo:**
  menos thread = menos arena = menos pool separado onde memória pode ficar
  presa. É prevenção, não a correção da dispersão que existe hoje.
- **`vips` é zero nos 41.** Confirma a §2-A.5: o pool do Sharp não existe em
  nenhum worker da frota, nem nos pesados. A parte de threads da §3.3 está
  **morta**; sobra o cache de 50 MB, que vive dentro das arenas.

⚠️ **Detalhe a acompanhar, não a concluir:** entre as duas leituras (minutos de
intervalo) o total em arena foi de 5.069 para 5.215 MiB, +146 MiB. **Duas
amostras não são tendência** — pode ser tráfego. Vale repetir o bloco da §3.0
algumas vezes ao longo de um dia antes de dizer qualquer coisa. Se estiver
subindo de forma sustentada, a conversa muda de "recuperar memória" para
"conter crescimento", que são coisas diferentes.

### 2-A.7 O interruptor já está escrito e NASCE DESLIGADO

`resolveWorkerSpawnEnv` (`src/core/workerSpawnOptions.js`, puro/testado) e o
`WA_WORKER_V8_POOL_SIZE` no `resolveWorkerExecArgv`. Sem env configurada o
objeto devolvido é vazio e o fork fica **byte a byte** como sempre foi — mesmo
padrão dos demais interruptores de rollout do projeto.

| env | vira | ataca | risco |
|---|---|---|---|
| `WA_WORKER_MALLOC_ARENA_MAX` | `MALLOC_ARENA_MAX` | os 58% em arena | baixo: só disputa de trava no `malloc`, com CPU 98% ociosa |
| `WA_WORKER_TOKIO_THREADS` | `TOKIO_WORKER_THREADS` | 16 threads do Prisma | médio: serializa consulta ao banco → vigiar `ops_sqlite_busy` |
| `WA_WORKER_UV_THREADPOOL_SIZE` | `UV_THREADPOOL_SIZE` | 4 threads do libuv | médio: serve leitura de arquivo (o auth do Baileys) e DNS |
| `WA_WORKER_V8_POOL_SIZE` | `--v8-pool-size` | 7 threads do V8 | médio: GC paralelo — pausa longa derrubava sessão em jun/2026 |

⚠️ **Nomes próprios (`WA_WORKER_*`), não os nomes que as bibliotecas leem**, por
dois motivos: (1) `MALLOC_ARENA_MAX` direto no `.env` valeria também para a API
e para o supervisor, que não são o alvo; (2) para o glibc,
`MALLOC_ARENA_MAX=0` significa **automático**, não desligado — um `0` escrito
com a intenção de desligar ligaria o padrão. Com nome próprio, ausente e `0`
significam a mesma coisa segura: não setar nada.

**Roteiro de validação em staging** (reiniciar lá não custa nada):

1. `WA_WORKER_MALLOC_ARENA_MAX=2` no `.env` de staging, `pm2 delete` + `start`
   (pegadinha #1) e reiniciar o supervisor.
2. Conferir que pegou: `grep MALLOC /proc/<pid do worker>/environ | tr '\0' '\n'`.
3. Rodar o bloco da §3.0 antes e depois e comparar a linha
   `arenas respondem por N% do PSS`.
4. Só então testar `WA_WORKER_TOKIO_THREADS=2` e **contar as threads** com o
   comando da §2-A.4 — é isso que diz se o motor do Prisma honra a variável,
   que não está verificado.
5. Deixar rodando algumas horas e olhar `ops_sqlite_busy` e o event loop antes
   de propor produção.

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

**Dá para rodar HOJE, sem esperar deploy nenhum.** ⚠️ Em produção `~/wabot`
está em `main`, então `scripts/diag-memoria-nativa.awk` **ainda não existe lá** —
apontar `awk -f ~/wabot/scripts/...` devolve "cannot open source file". O bloco
abaixo leva o awk junto e não depende de arquivo nenhum do repositório:

```bash
# ---------- cole daqui ----------
cat > /tmp/mem.awk <<'FIM'
function hex(s,  i,c,v,n) { n=0; for (i=1;i<=length(s);i++) { c=substr(s,i,1); v=index("0123456789abcdef",c)-1; if(v<0)v=index("0123456789ABCDEF",c)-1; n=n*16+v } return n }
/^[0-9a-fA-F]+-[0-9a-fA-F]+ / { split($1,r,"-"); idx++; st[idx]=hex(r[1]); pa[idx]=(NF>=6)?$6:""; next }
/^Size:/ { sz[idx]=$2 } /^Rss:/ { rs[idx]=$2 } /^Pss:/ { ps[idx]=$2 }
END {
  for (i=1;i<=idx;i++) if (pa[i]=="") { b=int(st[i]/67108864); g[b]+=sz[i] }
  for (i=1;i<=idx;i++) {
    if (pa[i]=="[heap]") k="heap_principal"
    else if (pa[i] ~ /^\[stack/) k="pilha"
    else if (pa[i]=="") { b=int(st[i]/67108864); if (g[b]==65536) { k="arena_glibc"; if(!seen[b]++) arenas++ } else k="anonimo" }
    else if (pa[i] ~ /\.(so|node)(\.[0-9]+)*$/) { k="biblioteca"; n=pa[i]; sub(/.*\//,"",n); L[n]+=ps[i] }
    else if (pa[i] ~ /^\//) k="arquivo"
    else k="outro"
    P[k]+=ps[i]; totP+=ps[i]; totR+=rs[i]
  }
  if (DETALHE=="1") {
    printf "\n-- bibliotecas nativas do pid %s (PSS acima de 1 MiB)\n", PID
    for (n in L) if (L[n] > 1024) printf "   %-46s PSS %7.1f\n", n, L[n]/1024
    exit
  }
  printf "pid %-7s thr %-4s PSS %7.1f RSS %7.1f arenas %3d |", PID, TH, totP/1024, totR/1024, arenas
  split("arena_glibc heap_principal anonimo pilha biblioteca arquivo outro",o," ")
  for (j=1;j<=7;j++) printf " %s=%.1f", o[j], P[o[j]]/1024
  printf "\n"
}
FIM
ALVO="/home/deploy/wabot/src/bot-worker"
echo "== $(pgrep -fc "$ALVO") robos | valores em MiB | PSS e' o que vale para somar =="
for p in $(pgrep -f "$ALVO"); do
  awk -v PID=$p -v TH=$(ls /proc/$p/task 2>/dev/null | wc -l) -f /tmp/mem.awk /proc/$p/smaps 2>/dev/null
done | sort -k6 -rn | tee /tmp/mem.txt
awk '{pss+=$6; ar+=$10; for(i=1;i<=NF;i++){split($i,kv,"=");s[kv[1]]+=kv[2]}} END{
  printf "\n== SOMA dos %d robos: PSS %.1f MiB | arenas %d\n", NR, pss, ar
  printf "   arena_glibc %.1f | anonimo %.1f | heap_principal %.1f | biblioteca %.1f | arquivo %.1f\n", s["arena_glibc"], s["anonimo"], s["heap_principal"], s["biblioteca"], s["arquivo"]
  printf "   arenas respondem por %.0f%% do PSS\n", (pss>0? s["arena_glibc"]*100/pss : 0)}' /tmp/mem.txt
MAIOR=$(head -1 /tmp/mem.txt | awk '{print $2}')
awk -v PID=$MAIOR -v DETALHE=1 -f /tmp/mem.awk /proc/$MAIOR/smaps 2>/dev/null
# ---------- ate aqui ----------
```

Ele é o mesmo classificador de `src/ops/memory/smapsBreakdown.js` — as duas
implementações foram conferidas lendo o MESMO arquivo congelado e devolveram o
mesmo PSS, o mesmo RSS e a mesma contagem de arenas. Depois que este PR chegar a
produção, o mesmo conteúdo está versionado em `scripts/diag-memoria-nativa.awk`
e o `.mjs` imprime um pouco mais.

⚠️ **Correção:** enquanto este PR era só documento e script, ele **não**
reiniciava o supervisor. Ao ganhar o interruptor da §2-A.7 ele passou a tocar
`src/core/sessionCore.js` e `src/core/workerSpawnOptions.js`, que **casam com
`WORKER_CODE_PATHS_RE`** — então o deploy **reinicia o `bot-supervisor` e
reconecta as sessões**. Em staging isso não custa nada; em produção é a janela
anunciada da §9, e é justamente a janela em que se quer aplicar a env.

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

**Ganho: esta é agora a PRIMEIRA alavanca — 58% do PSS medido em produção está
aqui (§2-A).** O texto abaixo é o que eu tinha ANTES da medição e fica como
lição de método. Tentei reproduzir o efeito num teste controlado (8 tarefas concorrentes de AES-GCM + HMAC + buffers
de tamanho variado, que é o formato do trabalho do Signal por mensagem):

```text
MALLOC_ARENA_MAX=(padrão)  PSS 63,1 MiB   blocos reservados: 15
MALLOC_ARENA_MAX=2         PSS 61,7 MiB   blocos reservados: 11
```

**1,4 MiB — cerca de 2%.** ⚠️ **Produção mediu 58%.** O ambiente da sonda tem
4 núcleos e poucas threads; produção tem 8 núcleos e 30 threads por worker, que
é justamente o que cria arena. **Sonda que não reproduz o número de threads não
serve para estimar fragmentação de alocador** — eu usei essa sonda para
rebaixar a alavanca e estava errado.
Quem decide é o número de `arena_glibc` da §3.0.

**Já medido:** 58% do PSS, 28-34 arenas por worker, e a dispersão de 6,4× no
tamanho delas com `anonimo` quase constante (§2-A.1). O critério de "menos de
15% não aplicar" foi cumprido com folga.

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
- `sharp.concurrency()` → número de núcleos, ou seja até 8 threads de libvips
  por worker. ⚠️ **Medido em 2026-09-16: ZERO threads de vips na amostra**
  (§2-A.5). O pool é criado sob demanda; o "8 threads" era o padrão documentado
  da biblioteca, não medição. A §2-A.6 diz se ele aparece nos workers pesados.

**Ganho estimado: até 50 MiB por worker que já processou imagem.** ~~mais 7
threads por worker~~ — a parte de threads não se sustentou na medição (§2-A.5). Na frota, isso é da ordem de **1-2 GB** — mas o cache enche
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

### ✅ ENCERRADA PELA MEDIÇÃO (§2-A.2)

`biblioteca` soma **2,2 MiB de PSS por worker**, e no detalhe do maior só
`libvips-cpp.so` passa de 1 MiB. `libquery_engine` não aparece. Biblioteca
compartilhada por 41 processos tem o PSS dividido por 41 — o custo de código é
desprezível e **não há conversa de arquitetura a ter aqui**. O que o Prisma
custa está dentro das arenas (threads do tokio + alocação), atacável por §3.1 e
§3.6. O texto abaixo é o raciocínio de antes da medição.

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
       (SELECT COUNT(*) FROM \"Group\" g WHERE g.userId = u.id AND g.role = 'monitor') AS origens,
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

---

### 3.6 — Cortar as threads que criam as arenas (NOVO, e é a alavanca causal)

**Mecanismo.** Arena do glibc nasce de disputa entre threads. Com 29 threads o
processo chega a ~30 arenas; com 10, tende a muito menos. Esta alavanca age
**acima** da §3.1: em vez de limitar quantas poças existem, fecha a torneira.

**Onde estão as threads, e o que cada corte vale** (contagem medida; o efeito em
arena é hipótese a medir):

| Pool | hoje | como cortar | onde |
|---|---:|---|---|
| motor do Prisma (tokio) | **16** | `TOKIO_WORKER_THREADS` | env do fork |
| plataforma do V8 | 7 | `--v8-pool-size=2` | `resolveWorkerExecArgv` |
| pool do libuv | 4 | `UV_THREADPOOL_SIZE=2` | env do fork |
| exportador + agendador | 2 | — | — |

⚠️ **`TOKIO_WORKER_THREADS` é a variável padrão do tokio, mas NÃO está
verificado que o motor do Prisma a honra** — depende de como ele constrói o
runtime. Isso é medição de um minuto em staging (setar, reiniciar, contar as
threads com o comando da §2-A.4), e é **o primeiro passo desta alavanca**. Se
não honrar, a alavanca vale só 9 threads em vez de 23.

**Como medir o ganho.** O mesmo bloco da §3.0, antes e depois, comparando
`arenas respondem por N% do PSS`.

**Risco: médio, e maior que o das outras.** Cortar thread de pool muda
concorrência de I/O real:

- **libuv de 4 para 2** é o mais sensível: é ele que serve leitura de arquivo e
  DNS. O `useMultiFileAuthState` do Baileys lê e escreve arquivo por credencial,
  e a busca de foto faz DNS. Não descer abaixo de 2 sem medir latência.
- **tokio do Prisma** serializa consulta ao banco. Com SQLite (banco embutido,
  escrita serializada pelo WAL de qualquer forma) a folga é grande, mas um valor
  baixo demais pode aparecer como `SQLITE_BUSY` — que o produto já conta
  (`ops_sqlite_busy`). **É o sinal a vigiar depois de aplicar.**
- **V8 de 7 para 2** afeta GC paralelo e compilação em background. Com CPU 98%
  ociosa, o risco real é pausa de GC mais longa — e pausa de GC longa é
  literalmente o que derrubava sessão no incidente de junho/2026. **Medir o
  event loop antes de promover.**

**Sem reinício do supervisor não vale**, e por isso vai na mesma janela das
outras (§5).

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

## 5. Ordem recomendada (revista pela medição)

1. ✅ **§3.0 rodada** — a resposta está na §2-A.
2. ✅ **Nomes das threads lidos** (§2-A.4) e ✅ **correlação medida** (§2-A.6):
   threads são constantes, a dispersão é de reaproveitamento dentro das arenas.
   `MALLOC_ARENA_MAX` fica sozinho na frente.
3. **Rodar a medição da §3.5** (SQL somente leitura). Independe de tudo acima e
   pode entregar 218 MiB por robô que não precisava existir.
4. **Validar em staging** pelo roteiro da §2-A.7 — o interruptor já está
   escrito e nasce desligado, então isso não exige código novo.
5. **Preparar UMA janela só**, com tudo que exige reinício do supervisor:
   `MALLOC_ARENA_MAX` (§3.1), corte de threads (§3.6), destino do log (§3.2),
   Sharp (§3.3) e o encerramento da POC (§6). **`ops_sqlite_busy` e o event loop
   são os dois sinais a vigiar depois** (§3.6). Validar em staging antes, e medir
   com o mesmo bloco da §3.0 **antes e depois** — o número a comparar é o PSS
   somado e a linha `arenas respondem por N% do PSS`.
6. ~~§3.4 (Prisma) como custo de código~~ — encerrada pela medição.

⚠️ **Por que uma janela só:** cada uma dessas mudanças, sozinha, custa uma
reconexão de todas as sessões. Aplicadas juntas, custam uma. E a frota já levou
8 reinícios em 3 dias (§7).

⚠️ **Contra-indicação a respeitar:** aplicar tudo de uma vez impede saber qual
mudança rendeu o quê. A saída é medir por etapa **em staging**, onde reiniciar
não custa nada, e levar o pacote fechado para produção.

Nenhum passo de 4 em diante é aplicado sem o OK explícito da dona do produto.

## 6. Resíduo da POC reprovada — o que ele custa de verdade

⚠️ **Correção de uma afirmação minha anterior.** Eu disse que o padrão `observe`
deixa "uma rota consultando o SQLite a cada 5 segundos" e que
`WA_SESSION_SHARD_POC=off` resolveria. **As duas partes estavam erradas**, e
isso muda a ação — por isso fica registrado em vez de ser apagado:

- `GET /shard-poc/overview` (`src/api/routes/admin.js`) **não lê a env em
  lugar nenhum** — só exige `tech:read`. Desligar a env não a torna mais barata.
- A tela (`dashboard/app/admin/teste-shard/page.js`) tem guarda de
  `document.visibilityState`: os 5 segundos só correm **enquanto alguém está com
  a página aberta e visível**. Com ninguém olhando, o custo é zero.
- O que a env de fato governa hoje: o modo do supervisor no boot e o
  `POST /shard-poc/members/:userId/start`, que **já está bloqueado** — ele exige
  `enabled` e o padrão é `observe`.

**Então não há urgência de RAM aqui, e a ação não é mexer no `.env`.** O resíduo
que importa é outro, e é de segurança operacional: um experimento **reprovado
por medição** continua alcançável em produção, com um botão que move a sessão de
uma cliente real para o shard — e o caminho de volta, como a revisão registrou
em §4.C, nunca rodou uma vez contra processo de verdade (todos os testes usam
runtime falso).

**O que sugiro**, e é decisão da dona do produto, não minha:

1. Um PR próprio que trate a POC como encerrada: padrão da env para `off` (que
   é o padrão de todo interruptor de rollout deste repositório —
   `COUPON_BRAND_CARD_ENABLED`, `WA_IGNORE_UNMONITORED_GROUPS`,
   `BADSESSION_KEEP_ESTABLISHED_AUTH` nascem desligados) e a rota de `start`
   recusando em qualquer modo enquanto o rollback não for testado de verdade.
2. Manter `src/session-shard-worker.js` e os testes no repositório. O código
   está testado e serve de base se a premissa mudar; apagar perderia o trabalho
   e o registro do que foi medido.
3. Esse PR toca `src/supervisor/index.js`, que está em `WORKER_CODE_PATHS_RE` —
   ou seja, custa uma reconexão da frota. **Deve ir na mesma janela anunciada**
   das alavancas §3.2 e §3.3, nunca sozinho.

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

- **A decomposição da §2-A É medição de produção** (41 robôs, 16/09). Os demais
  números de produção vêm dos documentos de 11 e 13 de setembro.
- **A medição do worker thread (11,7 MiB) continua sendo de um ambiente de 4
  núcleos** e serve para ordenar, não para estimar o ganho no servidor.
- **Quanto `MALLOC_ARENA_MAX=2` devolve NÃO está medido.** Os 3,5 GB da §2-A.1
  são o teto teórico se a fragmentação fosse a zero. A distribuição de threads
  por pool (§2-A.1) é estimada pelos padrões de cada biblioteca — a leitura da
  §2-A.4 a substitui por medição.
- **`sharp.cache()` = 50 MB e `sharp.concurrency()` = núcleos** são os padrões
  documentados da biblioteca, não medição minha. A §3.0 confirma em campo.
- O peso do motor do Prisma (§3.4) está deliberadamente **sem estimativa**.
- A decomposição do `smaps` classifica arena do glibc **pela forma** (bloco de
  64 MiB alinhado em 64 MiB, sem arquivo). O kernel não rotula arena; um
  alocador diferente do glibc não seria reconhecido como tal.

## 9. Runbook: o que fazer agora, com os comandos

**Nenhum passo de produção acontece sem o OK da dona do produto** (REGRA #1 da
política de memória). Todos os comandos de medição são somente leitura: escrevem
só em `/tmp/medidas`, não leem `.env`, não leem banco, não reiniciam nada.

### Passo A — instalar o medidor (uma vez, 10 segundos)

Cole este bloco inteiro no VPS. Ele cria `/tmp/medir.sh` e `/tmp/mem.awk`.

⚠️ **Precisa ser colado, não pode ser `bash ~/wabot/scripts/...`:** em produção
`~/wabot` está em `main`, e este arquivo só chega lá depois do deploy — mas a
medição "antes" tem que ser feita ANTES dele. Depois do deploy ele fica
versionado em `scripts/instalar-medidor-memoria.sh`.

```bash
mkdir -p /tmp/medidas
cat > /tmp/mem.awk <<'FIMAWK'
function hex(s,  i,c,v,n) { n=0; for (i=1;i<=length(s);i++) { c=substr(s,i,1); v=index("0123456789abcdef",c)-1; if(v<0)v=index("0123456789ABCDEF",c)-1; n=n*16+v } return n }
/^[0-9a-fA-F]+-[0-9a-fA-F]+ / { split($1,r,"-"); idx++; st[idx]=hex(r[1]); pa[idx]=(NF>=6)?$6:""; next }
/^Size:/ { sz[idx]=$2 } /^Rss:/ { rs[idx]=$2 } /^Pss:/ { ps[idx]=$2 }
END {
  for (i=1;i<=idx;i++) if (pa[i]=="") { b=int(st[i]/67108864); g[b]+=sz[i] }
  for (i=1;i<=idx;i++) {
    if (pa[i]=="[heap]") k="heap"
    else if (pa[i] ~ /^\[stack/) k="pilha"
    else if (pa[i]=="") { b=int(st[i]/67108864); if (g[b]==65536) { k="arena"; if(!seen[b]++) ar++ } else k="anon" }
    else if (pa[i] ~ /\.(so|node)(\.[0-9]+)*$/) k="lib"
    else if (pa[i] ~ /^\//) k="arq"
    else k="outro"
    P[k]+=ps[i]; tot+=ps[i]
  }
  printf "%.1f %.1f %.1f %.1f %d %d\n", tot/1024, P["arena"]/1024, P["anon"]/1024, P["heap"]/1024, ar, TH
}
FIMAWK
cat > /tmp/medir.sh <<'FIMSH'
#!/bin/bash
# Medicao de memoria nativa dos robos — SOMENTE LEITURA.
# Uso:  bash /tmp/medir.sh [antes|depois|comparar|historico]
#       ALVO=staging bash /tmp/medir.sh ...
set -u
D=/tmp/medidas
if [ "${ALVO:-prod}" = "staging" ]; then PAT="/home/deploy/wabot-staging/src/bot-worker"; NOME=staging
else PAT="/home/deploy/wabot/src/bot-worker"; NOME=prod; fi

medir() {
  local tot=0 arena=0 anon=0 heap=0 arenas=0 thr=0 n=0
  for p in $(pgrep -f "$PAT"); do
    local th; th=$(ls /proc/$p/task 2>/dev/null | wc -l)
    local L; L=$(awk -v TH=$th -f /tmp/mem.awk /proc/$p/smaps 2>/dev/null) || continue
    [ -z "$L" ] && continue
    set -- $L
    tot=$(echo "$tot $1" | awk '{print $1+$2}')
    arena=$(echo "$arena $2" | awk '{print $1+$2}')
    anon=$(echo "$anon $3" | awk '{print $1+$2}')
    heap=$(echo "$heap $4" | awk '{print $1+$2}')
    arenas=$((arenas + $5)); thr=$((thr + $6)); n=$((n+1))
  done
  echo "$(date +%Y-%m-%dT%H:%M:%S) $n $tot $arena $anon $heap $arenas $thr"
}

mostrar() {
  awk -v amb="$NOME" '{
    pct = ($3>0 ? $4*100/$3 : 0)
    printf "  quando .............. %s (%s)\n", $1, amb
    printf "  robos ligados ....... %d\n", $2
    printf "  PSS total ........... %.0f MiB  (%.2f GB)\n", $3, $3/1024
    printf "  em ARENA ............ %.0f MiB  = %.0f%% do total   <-- o numero que importa\n", $4, pct
    printf "  em anonimo .......... %.0f MiB\n", $5
    printf "  em heap ............. %.0f MiB\n", $6
    printf "  arenas .............. %d   (media %.1f por robo)\n", $7, ($2>0?$7/$2:0)
    printf "  threads ............. %d   (media %.0f por robo)\n", $8, ($2>0?$8/$2:0)
  }'
}

case "${1:-agora}" in
  antes|depois)
    L=$(medir); echo "$L" > $D/$NOME-$1.txt; echo "$L" >> $D/$NOME-historico.txt
    echo "== MEDIDA '$1' ($NOME) gravada em $D/$NOME-$1.txt"; echo "$L" | mostrar ;;
  comparar)
    A=$D/$NOME-antes.txt; B=$D/$NOME-depois.txt
    [ -f "$A" ] && [ -f "$B" ] || { echo "Faltam medidas. Rode: bash /tmp/medir.sh antes   e depois   bash /tmp/medir.sh depois"; exit 1; }
    echo "== ANTES ($NOME)"; cat $A | mostrar
    echo; echo "== DEPOIS ($NOME)"; cat $B | mostrar
    echo; echo "== DIFERENCA"
    paste $A $B | awk -v amb="$NOME" '{
      dp=$11-$3; da=$12-$4; dth=$16-$8; dar=$15-$7
      printf "  PSS total ........... %+.0f MiB  (%+.1f%%)\n", dp, ($3>0?dp*100/$3:0)
      if ($4 > 0) printf "  em ARENA ............ %+.0f MiB  (%+.1f%%)\n", da, da*100/$4
      else         printf "  em ARENA ............ %+.0f MiB\n", da
      printf "  arenas .............. %+d  (de %d para %d)\n", dar, $7, $15
      printf "  threads ............. %+d  (de %d para %d)\n", dth, $8, $16
      printf "  %% do PSS em arena ... de %.0f%% para %.0f%%\n", ($3>0?$4*100/$3:0), ($11>0?$12*100/$11:0)
      print ""
      if (amb == "staging") {
        print "  LEITURA (staging): economia NAO se mede aqui — e uma sessao so, com pouco trafego."
        print "  O que vale em staging e a linha ARENAS: tem que ter caido para ~2 por robo."
        print "  Se caiu, a env chegou e nada quebrou. Pode levar para producao."
      } else if (da < -100) print "  LEITURA: a memoria presa em arena caiu de verdade. Deu certo."
      else if (da > 100)    print "  LEITURA: SUBIU. Nao promover. Conferir se a env chegou ao robo (passo 5)."
      else                  print "  LEITURA: praticamente igual. Se as arenas tambem nao cairam, a env NAO chegou ao robo."
    }' ;;
  historico)
    echo "== historico ($NOME)"; printf "%-20s %5s %9s %9s %7s\n" "quando" "robos" "PSS_MiB" "arena_MiB" "%arena"
    awk '{printf "%-20s %5d %9.0f %9.0f %6.0f%%\n", $1,$2,$3,$4,($3>0?$4*100/$3:0)}' $D/$NOME-historico.txt 2>/dev/null || echo "  (vazio — rode 'bash /tmp/medir.sh' algumas vezes)" ;;
  *)
    L=$(medir); echo "$L" >> $D/$NOME-historico.txt; echo "== AGORA ($NOME)"; echo "$L" | mostrar ;;
esac
FIMSH
echo "OK — instalado. Agora use:  bash /tmp/medir.sh"
```

### Passo B — as duas leituras que não dependem de nada (hoje)

**B.1 — A frota está crescendo?** Entre as duas leituras de 16/09 o total em
arena subiu 146 MiB em minutos. **Duas amostras não são tendência.** Rode isto
3 ou 4 vezes ao longo do dia (de manhã, à tarde, à noite):

```bash
bash /tmp/medir.sh
```

E no fim do dia, para ver a série:

```bash
bash /tmp/medir.sh historico
```

Se a coluna `arena_MiB` subir sempre, a conversa muda de "recuperar memória"
para "conter crescimento" — coisas diferentes, com soluções diferentes.

**B.2 — Quantos robôs não precisam estar ligados?** 218 MiB por robô que não
precisava existir. Somente leitura:

```bash
cd ~/wabot && sqlite3 prisma/prod.db "
SELECT u.email,
       (SELECT COUNT(*) FROM \"Group\" g WHERE g.userId = u.id AND g.role = 'monitor') AS origens,
       s.status, s.lifecycle, u.plan, u.accessExpiresAt
  FROM WaSession s JOIN User u ON u.id = s.userId
 WHERE s.status IN ('connected','connecting')
 ORDER BY origens ASC;"
```

Linha com `origens = 0` é robô que recebe mensagem, descarta tudo e ocupa uma
vaga. ⚠️ Desligar é decisão de produto, não de memória — cliente que só ainda
não terminou de configurar abre o painel, vê desconectado e conclui que o
produto não funciona. Medir primeiro, decidir depois.

### Passo C — staging

**C.1** Mergear a PR em `develop` (o autodeploy reinicia o supervisor de
staging, que lá não custa nada) e esperar o deploy terminar.

**C.2** Medir antes:

```bash
ALVO=staging bash /tmp/medir.sh antes
```

**C.3** Ligar a variável:

```bash
echo "WA_WORKER_MALLOC_ARENA_MAX=2" >> ~/wabot-staging/.env
grep WA_WORKER ~/wabot-staging/.env
```

**C.4** Aplicar. ⚠️ **Staging é canonicamente `inline`: quem forka os robôs é a
`api-staging`, não o supervisor.** `pm2 delete` + `start`, do diretório certo
(pegadinhas #1 e #9):

```bash
pm2 delete api-staging
cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only api-staging
pm2 save
```

**C.5** Conferir que chegou ao robô — **é o passo que costuma faltar**:

```bash
sleep 60
w=$(pgrep -f "/home/deploy/wabot-staging/src/bot-worker" | head -1)
echo "worker: $w"
tr '\0' '\n' < /proc/$w/environ | grep -E "MALLOC|TOKIO|UV_THREAD"
echo "arenas agora:"; awk -v TH=0 -f /tmp/mem.awk /proc/$w/smaps
```

A linha do `grep` tem que imprimir `MALLOC_ARENA_MAX=2`. Se não imprimir, a
variável não chegou e o resto da medição não significa nada.

**C.6** Medir depois e comparar:

```bash
ALVO=staging bash /tmp/medir.sh depois
ALVO=staging bash /tmp/medir.sh comparar
```

⚠️ **O que staging PODE e NÃO PODE provar.** Uma sessão só, tráfego baixo. Ele
prova que **nada quebra** e que a variável chega ao robô. ⚠️ **A expectativa de
"arenas caem de ~30 para ~2" estava ERRADA** — staging já tem 1 arena (§10.2).
Ele **não mede a economia** — ela vem da dispersão de
6,6×, que só existe com tráfego real. **Não reprovar por "economizou pouco em
staging".** Critério de aprovação lá, nesta ordem:

1. `MALLOC_ARENA_MAX=2` aparece no `environ` do robô (C.5) — **é o único
   critério que staging de fato testa**;
2. a sessão continua conectada e as ofertas continuam saindo (olhar o painel);
3. `ops_sqlite_busy` não apareceu.

⚠️ **Não olhar a contagem de arenas em staging**: ela já é 1 (§10.2), porque
arena nasce de disputa entre threads e staging quase não tem tráfego. E **não
comparar o PSS antes/depois**: o robô foi reiniciado no meio, e processo novo é
sempre mais leve.

### Passo D — produção (janela anunciada, só com OK)

**Só `MALLOC_ARENA_MAX`, sozinho.** Isso muda a recomendação anterior de
empacotar tudo numa janela só, e o motivo é a medição: esta alavanca responde
por 58% do problema, tem o menor risco das quatro e é **a única cujo ganho não
dá para prever**. Misturar com log, Sharp e corte de thread tornaria impossível
saber o que rendeu o quê — e é esse número que decide se vale continuar.

**D.1** Anunciar: o deploy reconecta todas as sessões de uma vez.

**D.2** Medir antes e guardar:

```bash
bash /tmp/medir.sh antes
```

**D.3** Ligar a variável **antes do merge**. Nada acontece ainda — nenhum
processo relê `.env` sozinho:

```bash
echo "WA_WORKER_MALLOC_ARENA_MAX=2" >> ~/wabot/.env
grep WA_WORKER ~/wabot/.env
```

**D.4** Mergear `develop` → `main`. O deploy sobe o código **e** reinicia o
supervisor, que na subida lê o `.env` e forka os robôs já com a variável —
**uma reinicialização, não duas**.

⚠️ A pegadinha #1 (PM2 cacheia env) **não** se aplica: ela vale para variável
que o PM2 já tinha cacheado, e esta é um nome novo que nunca existiu. Ainda
assim, conferir pelo D.5.

**D.5** Conferir que chegou:

```bash
w=$(pgrep -f "/home/deploy/wabot/src/bot-worker" | head -1)
tr '\0' '\n' < /proc/$w/environ | grep MALLOC
```

**D.6** Medir depois. Aos 15 minutos, 1 hora e 24 horas:

```bash
bash /tmp/medir.sh depois && bash /tmp/medir.sh comparar
```

O número que decide é `em ARENA`. Ele é 4.950 MiB hoje.

### Passo E — o que vigiar nas 24 horas seguintes

```bash
# memoria (1x por hora nas primeiras horas)
bash /tmp/medir.sh

# swap: enquanto estiver parado, o servidor esta confortavel
free -m | awk 'NR==2{print "livre_mb="$7} NR==3{print "swap_usada_mb="$3}'

# banco travando? (nao deveria mudar — arena nao mexe em banco)
cd ~/wabot && sqlite3 prisma/prod.db "
SELECT COUNT(*) AS sqlite_busy_24h FROM AnalyticsEvent
 WHERE event='ops_sqlite_busy' AND createdAt > datetime('now','-1 day');"

# sessoes caindo mais que o normal?
cd ~/wabot && sqlite3 prisma/prod.db "
SELECT COUNT(*) AS quedas_24h FROM WaConnectionEvent
 WHERE type='disconnect' AND occurredAt > datetime('now','-1 day');"
```

Rode as duas últimas **antes** do passo D também, para ter com o que comparar.

**Rollback, se algo piorar:**

```bash
sed -i '/^WA_WORKER_MALLOC_ARENA_MAX=/d' ~/wabot/.env
pm2 restart bot-supervisor --update-env && pm2 save
```

Volta ao comportamento de hoje, sem redeploy. ⚠️ Isso também reconecta todas as
sessões.

### Passo F — só depois, e um de cada vez

`WA_WORKER_TOKIO_THREADS=2` (⚠️ **não está verificado que o motor do Prisma
honra** — o teste é setar, reiniciar e contar as threads:
`cat /proc/$w/task/*/comm | sort | uniq -c | sort -rn`), depois
`WA_WORKER_UV_THREADPOOL_SIZE` e `WA_WORKER_V8_POOL_SIZE`. Cada um com sua
janela e sua medição. E a §3.2 (destino do log, 11,7 MiB medidos por processo),
que é independente de tudo isto.

### O que NÃO fazer

- **Não aplicar os quatro interruptores juntos.** O ganho do principal é
  desconhecido; misturar apaga a atribuição.
- **Não mexer em `WA_WORKER_UV_THREADPOOL_SIZE` antes do arena.** O libuv serve
  a leitura de arquivo do auth do Baileys e o DNS: é o de maior chance de
  aparecer como problema de sessão, e seria confundido com o efeito do arena.
- **Não reprovar pela medição de staging** (ver o aviso do passo C.6).

## 10. O que a execução de 2026-09-17 mostrou (e o que ela NÃO prova)

### 10.1 Staging: o encanamento funciona, a validação NÃO

```text
antes   PSS 179 MiB   arena 42 MiB (23%)   arenas 1   threads 29
depois  PSS  92 MiB   arena 17 MiB (18%)   arenas 1   threads 29
```

E no `environ` do robô:

```text
WA_WORKER_MALLOC_ARENA_MAX=2
MALLOC_ARENA_MAX=2
```

**O que isso prova:** o caminho inteiro funciona. `resolveWorkerSpawnEnv` leu a
variável nossa, traduziu para a do glibc, e ela chegou ao processo do robô. A
sessão continuou de pé. Isso era o objetivo do teste em staging.

⚠️ **O que NÃO prova, e é importante: os 179 → 92 MiB não são economia.** O
robô foi **reiniciado** entre as duas medidas. Processo novo é sempre mais leve
que processo rodando há horas — é exatamente a armadilha em que a POC de shard
caiu (comparar processo recém-nascido com frota assentada). A queda de heap de
56 para 14 MiB é a assinatura disso: heap do V8 zerado, não memória recuperada.

### 10.2 A correção mais importante: staging TEM 1 ARENA, não 30

Eu escrevi que em staging "as arenas têm que cair de ~30 para ~2". **Errado:
staging já estava em 1 arena antes de qualquer mudança.** Com 29 threads, igual
a produção.

Isso não é defeito — **é a confirmação do mecanismo, e é uma informação nova**:
o glibc não cria arena por existir thread, cria por **disputa** entre threads.
O robô de staging tem as mesmas 29 threads, mas quase nenhuma alocação
simultânea, então nunca disputa e fica na arena principal. Os robôs de produção
disputam o tempo todo e chegam a 29 arenas cada.

**Consequência prática: staging não pode validar esta alavanca.** Não há o que
reduzir lá — já está no mínimo. O teste de staging vale como teste de
encanamento e de "nada quebrou", e só. Fica registrado para ninguém tentar
extrair dali um número de economia.

### 10.3 A frota de produção foi reiniciada — e isso é um achado

| quando | robôs | PSS | por robô | arena | % |
|---|---:|---:|---:|---:|---:|
| 16/09 | 41 | 8.702 MiB | **212 MiB** | 5.069 | 58% |
| 17/09 17:13 | 46 | 6.815 MiB | **148 MiB** | 3.380 | 50% |
| 17/09 17:28 | 45 | 6.588 MiB | **146 MiB** | 3.222 | 49% |

**Cinco robôs a MAIS, e 2 GB a MENOS.** A frota foi reiniciada entre as duas
datas (deploy). Não é melhora: é o contador zerando.

E isso é a melhor evidência que temos até agora de que **o acúmulo é real e
reversível por reinício**. Fragmentação de alocador se comporta exatamente
assim: cresce com o tempo de vida do processo e some quando ele renasce. Dado
vivo não faria isso.

⚠️ **Também significa que o "antes" medido hoje é de frota NOVA.** Comparar
"frota nova sem a variável" com "frota nova com a variável" não diz nada — as
duas estarão no fundo da curva.

### 10.4 O experimento que de fato responde: comparar CURVAS, não instantes

⚠️ **SUPERADO pela §12.2** — com o uptime do supervisor MEDIDO (17:20:54), a
frota satura em ~1 hora. O experimento custa uma hora, não dois dias. O texto
abaixo fica como registro do raciocínio.

A frota acabou de reiniciar. **Isso é um ponto de partida limpo e raro.** O
plano que responde a pergunta sem depender de staging:

**Fase 1 — a curva de hoje, sem a variável (custo zero, começa agora).**
Rodar, e só isso:

```bash
bash /tmp/medir.sh
```

Algumas vezes por dia, por 2 dias. No fim:

```bash
bash /tmp/medir.sh historico
```

Isso desenha quanto a memória em arena sobe por hora numa frota que acabou de
nascer. É o mesmo comando do passo B.1 — **serve para as duas coisas**.

**Fase 2 — a mesma curva, com a variável.** Aplicar em produção (passo D),
que já reinicia a frota, e repetir as mesmas leituras nos mesmos intervalos.

**O que compara:** não o PSS de um instante, mas **a inclinação**. Se a curva
com `MALLOC_ARENA_MAX=2` subir mais devagar ou estabilizar mais baixo, a
alavanca funciona. Se subir igual, não funciona — e aí a resposta está em
`anonimo` (2,6 GB), não no alocador.

Duas medidas no mesmo estado de frota é a única comparação honesta disponível;
qualquer outra confunde idade de processo com efeito da mudança.

### 10.5 Pendências pequenas desta execução

- **O SQL do passo B.2 estava errado** e foi corrigido: a coluna é
  `Group.role`, não `Group.type` (`role = 'monitor'`). Erro meu — escrevi a
  consulta a partir da descrição, sem conferir o schema.
- **`WA_WORKER_MALLOC_ARENA_MAX` ficou duplicado no `.env` de staging** (o
  `echo` rodou duas vezes). Inofensivo — as duas linhas têm o mesmo valor —,
  mas vale limpar:
  ```bash
  sed -i '0,/^WA_WORKER_MALLOC_ARENA_MAX=2$/{//d}' ~/wabot-staging/.env
  grep -c WA_WORKER ~/wabot-staging/.env   # tem que devolver 1
  ```
- **`MALLOC_ARENA_MAX=2` no `environ` prova que o código já está em staging**,
  porque só `resolveWorkerSpawnEnv` produz essa variável. Confirmar com
  `cd ~/wabot-staging && git log --oneline -1`.

## 11. A alavanca dos "robôs que não precisam estar ligados" MORREU com dado (2026-09-17)

A consulta do passo B.2 rodou. **44 sessões conectadas; 5 com zero origem
monitorada** — e as cinco são a mesma coisa:

| conta | plano | trial vence em |
|---|---|---|
| luisotaviomouraodesousa91 | trial | 5,1 dias |
| bertouzastore | trial | 5,3 dias |
| leilafuro | trial | 5,2 dias |
| snapr8 | trial | 4,1 dias |
| graficacintia | trial | 3,7 dias |

**Todas em teste grátis, com 3,7 a 5,3 dias pela frente.** Ou seja: cadastraram
há dois ou três dias, conectaram o WhatsApp e ainda não escolheram o grupo de
origem. **Não são desperdício — são clientes no meio da configuração.**

**Não há nada a desligar aqui, e desligar seria o pior movimento possível.** É
exatamente o risco de produto que a §3.5 já registrava: ela abre o painel, vê
"desconectado" e conclui que o produto não funciona. Cinco robôs a ~146 MiB são
~0,7 GB — e o custo de perder cinco clientes em teste é incomparavelmente maior.

**A alavanca §3.5 fica encerrada** enquanto esta foto valer. Vale reconferir de
tempos em tempos (é uma consulta), porque a resposta muda com a base.

**O que esses cinco de fato pedem é conversão, não memória**, e o produto já tem
a ferramenta: `scripts/contato-ativo-semanal.mjs`, grupo *"4. Criou a conta nos
últimos 7 dias e nunca publicou nada"*. Cinco clientes em teste que conectaram e
travaram na escolha de origem valem muito mais que 0,7 GB:

```bash
cd ~/wabot && node scripts/contato-ativo-semanal.mjs --so-pedidos
```

Nada disso é conversa de RAM — é o achado que a medição de memória entregou de
brinde, e é o de maior valor do dia.

### 11.1 Leitura secundária: 23 contas com exatamente 1 origem

Metade da frota monitora **um** grupo. É configuração normal e funcionando (uma
origem espelhando para os destinos), não sinal de nada. Registrado só para
ninguém ler a coluna `origens = 1` como problema.

### 11.2 Placar das alavancas, depois de dois dias de medição

| Alavanca | Situação |
|---|---|
| §3.1 `MALLOC_ARENA_MAX` | **única viva.** 49-58% do PSS; encanamento validado; falta a comparação de curvas (§10.4) |
| §3.6 cortar threads | segundo lugar, como prevenção — threads são constantes na frota (§2-A.6) |
| §3.2 destino do log | vale os 11,7 MiB medidos por processo; independente |
| §3.3 Sharp | só o cache de 50 MB; a parte de threads morreu (`vips` = 0 nos 41) |
| §3.4 Prisma como custo de código | **morta** (2,2 MiB de PSS por robô) |
| §3.5 robôs ociosos | **morta** — os 5 candidatos são clientes em teste no meio da configuração |
| POC de shard | **morta** por medição em 16/09 |

Seis alavancas examinadas, três mortas com dado, uma viva. É o resultado
esperado de medir antes de mexer.

## 12. O interruptor JÁ ESTÁ em produção, e a frota satura em ~1 hora

### 12.1 Correção 1: não há merge a fazer — o código já está em `main`

`resolveWorkerSpawnEnv` entrou em `develop` na PR #1717 (14:14) e em `main` na
promoção #1718 (14:18). **Produção já tem o interruptor, desligado**, que é
exatamente o padrão desenhado: sem env, o fork fica byte a byte como sempre foi.

Isso simplifica o passo D do runbook: **não precisa mergear nada.** Aplicar em
produção é escrever a variável no `.env` e reiniciar o supervisor. Um reinício.

E explica o reinício da frota que eu atribuí a "um deploy": foi **este** deploy,
às 14:18 — o diff tocou `src/core/`, que casa com `WORKER_CODE_PATHS_RE`. Os
dois deploys seguintes (14:51 e 17:43) **não** tocaram código de worker e não
reiniciaram nada.

### 12.2 Eu errei a leitura DUAS vezes, pelo mesmo motivo

`pm2 describe bot-supervisor` deu o dado que faltava: **criado às 17:20:54,
uptime 40m**. Medido, não inferido. Com ele a série fica assim:

| leitura | idade da frota | PSS | arena | % | por robô |
|---|---|---:|---:|---:|---:|
| 17:13 | frota **antiga** (antes do reinício) | 6.815 | 3.380 | 50% | 148 |
| 17:28 | **+7 min** | 6.588 | 3.222 | 49% | 146 |
| 17:52 | **+31 min** | 8.701 | 4.930 | 57% | 193 |

**A frota nova foi de 146 para 193 MiB por robô entre 7 e 31 minutos de vida** —
~2 MiB por robô por minuto. O nível saturado medido em 16/09 era 212 MiB/robô,
ou seja, faltavam 19 MiB: **a saturação acontece em cerca de uma hora.**

⚠️ **Registro do erro, porque ele se repetiu:** minha primeira leitura ("satura
rápido") estava certa. Eu a *corrigi* supondo que o reinício tinha sido às 14:18
— e essa suposição estava errada. Ou seja: errei uma vez ao deduzir o horário do
reinício, e errei de novo ao corrigir com outra dedução em vez de medir.

**É o mesmo modo de falha das duas vezes: concluir sobre uma série temporal sem
saber a que horas o relógio começou.** Regra que fica: antes de interpretar
qualquer medida de memória da frota, ler o uptime do supervisor. É um comando.

```bash
pm2 describe bot-supervisor | grep -iE "uptime|restarts|created"
```

### 12.3 O que isso impõe ao experimento (agora com o dado certo)

**Saturação em ~1 hora torna o experimento barato e decidível no mesmo dia:**
aplicar, esperar uma hora, medir. Não são dois dias.

Mas duas cautelas continuam valendo:

- **Comparar frota saturada com frota saturada.** Medir aos 7 minutos e
  comparar com um valor de ontem daria -31%, e seria idade de processo, não a
  variável. O medidor grava o carimbo de tempo de cada medida justamente para
  isso.
- **Tráfego varia por hora**, e a memória parece responder a carga. Com a
  saturação em ~1h e o platô medido em 8,7 GB em dois dias diferentes, comparar
  platô com platô é razoavelmente robusto — mas medir no mesmo horário do dia
  elimina a dúvida de vez, e não custa nada.

### 12.4 Achado colateral: 7 reinícios do supervisor

`restarts: 7`, `unstable restarts: 0`. Somado aos 8 em 3 dias da §7, a frota
está reiniciando muito — e **o de 17:20 não corresponde a nenhum deploy que
tocasse código de worker** (os merges de 14:51 e 17:43 não tocaram
`WORKER_CODE_PATHS_RE`). Ou foi o deploy de 14:18 chegando tarde, ou foi um
reinício não explicado, que é incidente próprio. Vale conferir:

```bash
grep -iE "boot|iniciado|shard|STANDBY" "$(ls -t ~/.pm2/logs/bot-supervisor-out-*.log | head -1)" | tail -20
pm2 logs bot-supervisor --lines 50 --nostream | tail -30
```

Cada reinício reconecta as 45 sessões de uma vez — é exposição ao padrão que o
WhatsApp associa a robô, e é o custo que a §5 pede para agrupar numa janela só.

## 13. O achado que vale mais que toda a investigação de RAM (2026-09-17)

`scripts/contato-ativo-semanal.mjs` devolveu **186 clientes para procurar**, e o
que está dentro dele vale mais que os 5 GB desta análise inteira.

### 13.1 Duas clientes PAGANTES nunca viram o robô funcionar

| cliente | plano | pagou | acesso até | conta | envios | whatsapp |
|---|---|---|---|---|---:|---|
| taciane silva | basic | **sim** | 14/10 | 9 dias | **0** | **nunca conectou** |
| Taiane Ribeiro | basic | **sim** | 14/10 | 15 dias | **0** | **nunca conectou** |

**Pagaram, têm quase um mês de acesso pela frente e nunca conectaram o
WhatsApp.** Nunca publicaram uma oferta. Último contato: nunca.

É o contato mais urgente da lista inteira — não por receita, por confiança:
cliente que paga e não consegue usar não pede reembolso, some e conta para
outras pessoas.

### 13.2 Onze clientes usaram MUITO e o teste acabou sem ninguém falar com elas

No grupo "venceu nos últimos 3 dias" (24 pessoas, **todas** com "último
contato: nunca"):

| cliente | envios no teste | venceu |
|---|---:|---|
| walace Roberto | **3.432** | há 1 dia |
| Andreza da silva correa | **1.822** | hoje |
| Vitor | **1.407** | hoje |
| Isabele Aguiar | **1.103** | há 1 dia |

Essas pessoas **viram o produto funcionar**, publicaram milhares de ofertas, e o
teste acabou. É a janela de maior conversão que existe — e ninguém ligou.

E nos grupos mais frios, o caso que dói mais:

**GISLAINE RYZIK — plano pro, JÁ PAGOU, 4.903 envios, venceu há 22 dias, último
contato: nunca.** Uma cliente pagante que foi embora sem uma conversa.

### 13.3 A conta que compara as duas frentes

- **Memória:** o prêmio máximo é da ordem de 3-5 GB num servidor de 15,6 GB.
  Vale adiar um upgrade — algo entre R$100 e R$200 por mês, e só se a alavanca
  funcionar, o que ainda não está medido.
- **Contato:** 24 pessoas na janela quente, 11 delas com uso pesado comprovado,
  mais 2 pagantes travadas. A R$69 do Pro, **recuperar dez já paga vários meses
  de servidor** — e não depende de nenhuma hipótese técnica.

**A investigação de RAM continua valendo** (a alavanca está pronta, desligada, e
o experimento agora custa uma hora). Mas se houver que escolher o que fazer
primeiro amanhã de manhã, é a lista, não o alocador.

```bash
cd ~/wabot && node scripts/contato-ativo-semanal.mjs --csv > /tmp/contatos.csv
```

### 13.4 Ruído a limpar na lista (pequeno)

Aparecem contas de teste da própria casa (`Flavia teste`, `Flavia Teste 1`,
`Flavia Teste 2`, `flaviatesteconversa`, `saasdas`, `mariaexemplo`) e **9 contas
já anonimizadas** (`deleted_*@anonimizado.invalid`, que por definição não têm a
quem ligar). Não é defeito de memória nem de dado — é filtro que falta no
script. Enquanto não existir, é só pular na leitura.

## 14. A lição virou ferramenta: o medidor agora imprime a idade da frota

Errei a interpretação da série **duas vezes no mesmo dia**, pelo mesmo motivo:
concluí sobre memória sem saber há quanto tempo os robôs estavam no ar. Escrever
"lembre de conferir o uptime" no documento não resolve — quem está medindo às
23h não vai lembrar.

Então o `medir.sh` passou a imprimir sozinho:

```text
  IDADE da frota ...... robo mais velho 214 min | mais novo 3 min
  ATENCAO: frota com menos de 1h — AINDA NAO SATUROU. Nao comparar com frota assentada.
```

E o `comparar` **recusa a comparação** quando qualquer uma das duas medidas é de
frota com menos de uma hora:

```text
  ATENCAO: uma das medidas e de frota com MENOS DE 1 HORA. A comparacao NAO vale:
    frota nova e sempre mais leve, e isso e idade de processo, nao a variavel.
```

⚠️ **Detalhe de implementação que quebrou o script na primeira tentativa:** o
programa `awk` vive dentro de `awk '...'` no shell, então **apóstrofo dentro de
qualquer texto do awk encerra a string** e o script morre com
`runaway string constant`. Escrever "é" como "e'" — natural em português — é
exatamente o que quebra. Todos os textos do awk são sem apóstrofo de propósito.

Para atualizar no VPS, é recolar o instalador (`scripts/instalar-medidor-memoria.sh`,
ou o bloco da §3.0). O histórico em `/tmp/medidas` **não se perde**: as medidas
antigas ficam com dois campos a menos e o `historico` continua lendo.

## 15. O problema virou outro: a frota quase nunca fica de pé por uma hora

A leitura das 22:50 (4.871 MiB, −44%) **não vale**: `uptime 6m`, robô mais velho
6 minutos. Frota recém-nascida. É só idade de processo.

Mas o dado que veio junto é o achado:

```text
restarts           8
uptime             6m
```

**O contador foi de 7 para 8 em cinco horas.** Hoje houve pelo menos dois
reinícios (17:20 e ~22:44), e **nenhum dos dois corresponde a um deploy que
tocasse `WORKER_CODE_PATHS_RE`** — os merges de 14:51 e 17:43 não tocaram.

### 15.1 Três consequências, e a terceira é a pior

1. **Nenhuma medida de memória é confiável enquanto isso continuar.** Três das
   quatro leituras de hoje foram invalidadas por idade de frota. O experimento
   do `MALLOC_ARENA_MAX` precisa de uma hora de frota assentada — e hoje a frota
   não teve uma hora sossegada.
2. **Cada reinício reconecta as 46 sessões de uma vez.** É o padrão que o
   WhatsApp associa a robô, e é o risco que o projeto inteiro tenta evitar
   (é literalmente a razão de o `bot-supervisor` existir).
3. **O consumo real pode ser MAIOR que o medido.** Se a frota reinicia a cada
   poucas horas, ela passa boa parte do tempo na parte barata da curva. Os
   8,7 GB de ontem podem não ser o platô — podem ser um ponto no meio da subida.
   **Nunca vimos uma frota de verdade assentada.**

### 15.2 Isto passa na frente da memória

Não por ser mais interessante: porque **bloqueia** a memória e porque é risco de
sessão, que é o ativo do produto. Descobrir a causa é leitura, não mudança:

```bash
# 1. O supervisor caiu, ou alguem/algo o reiniciou?
tail -60 "$(ls -t ~/.pm2/logs/bot-supervisor-error-*.log | head -1)"

# 2. O que ele diz no boot (e se entrou em STANDBY, que seria outro problema)
tail -40 "$(ls -t ~/.pm2/logs/bot-supervisor-out-*.log | head -1)"

# 3. Houve deploy perto do horario?
cd ~/wabot && git log -3 --format='%h %ad %s' --date=format:'%d/%m %H:%M'

# 4. O sistema matou por memoria? (OOM killer)
sudo dmesg -T 2>/dev/null | grep -iE "killed process|out of memory" | tail -5
```

**As quatro respostas levam a ações diferentes:**

| O que aparecer | O que é |
|---|---|
| stack de erro no log de erro | o supervisor **crashou** — é bug, e o PM2 só o levantou de volta |
| boot limpo, sem erro, e deploy no horário | o auto-restart do deploy (`workers_running_stale_code`) disparou — é o comportamento desenhado, mas está disparando demais |
| boot limpo, sem erro, sem deploy | reinício **não explicado** — incidente próprio, e o mais preocupante |
| `killed process` no `dmesg` | o sistema matou por falta de memória — aí memória e reinício são o MESMO problema |

⚠️ **A última linha é a que muda tudo.** Se for OOM killer, a investigação de
memória e a de reinício convergem: a frota cresce, o sistema mata, a frota
renasce leve, e o ciclo recomeça — o que explicaria por que o consumo "volta ao
mesmo lugar" e por que nunca vemos o platô.

### 15.3 O que fazer com o experimento do arena até lá

**Segurar.** Aplicar `MALLOC_ARENA_MAX=2` agora custaria mais um reinício e
produziria um número que não dá para ler — exatamente o que aconteceu três vezes
hoje. Primeiro a frota precisa ficar de pé por algumas horas seguidas; só então
a medição significa alguma coisa.

O interruptor está pronto, desligado e não expira.

## 16. Não foi crash. E sobrou uma hipótese só — que une as duas investigações

O log de erro do supervisor tem **só `Bad MAC` do libsignal**, que o AGENTS.md já
documenta como ruído secundário. **Nenhuma stack de exceção, nenhum sinal de
processo morto pelo próprio código.** O log de saída mostra operação normal
(config, "Link detectado", `messages.upsert`) até 23:11.

### 16.1 A cadência de deploy explica DOIS reinícios, não o terceiro

Oito promoções para `main` hoje. Três tocam `WORKER_CODE_PATHS_RE` e reiniciam a
frota:

| horário | PR | reinicia? |
|---|---|---|
| 13:40 | #1711 | — |
| **14:01** | **#1714** | **sim (6 arquivos)** |
| **14:18** | **#1718** | **sim (4 arquivos)** |
| 14:51 | #1719 | — |
| 15:18 | #1720 | — |
| 15:32 | #1721 | — |
| 19:14 | #1722 | — |
| **19:46** | **#1730** | **sim (3 arquivos)** |

⚠️ **Cuidado com fuso ao comparar:** o `git log` do VPS mostra data de autor no
fuso local; a mesma commit aparece com 3 horas de diferença aqui. Foi isso que
fez parecer existir uma commit às 22:44 — ela é a de 19:44.

**Os reinícios de 14:18 e ~19:50 batem com deploy. O de ~22:44 NÃO bate com
nada.** Não houve promoção depois de 19:46.

### 16.2 A hipótese que sobrou

Com crash descartado e deploy descartado, resta o **OOM killer** — e ela é a
única que explica as duas investigações de uma vez:

```text
frota cresce → RSS se aproxima do limite → o sistema mata algo →
o supervisor renasce → a frota volta leve → o ciclo recomeça
```

Isso explicaria, sem forçar nada:

- por que o consumo **"volta ao mesmo lugar"** em vez de crescer sem parar;
- por que **nunca vemos o platô** — a frota é cortada antes de chegar nele;
- por que há reinício **sem deploy correspondente**.

E a ordem de grandeza fecha: o kernel conta **RSS, não PSS**. Com PSS somado em
8,7 GB, o RSS somado passa de 11 GB; mais api, dashboard, supervisor e staging
(~1 GB), o servidor de 15,6 GB fica com pouca folga num pico.

⚠️ **É hipótese, não conclusão** — o `dmesg` pediu senha e não foi rodado.
**É o único comando que falta**, e ele decide se isto é um problema ou dois:

```bash
sudo dmesg -T | grep -iE "killed process|out of memory|oom" | tail -10
# se pedir senha e voce nao quiser, tente sem sudo:
grep -iE "killed process|out of memory" /var/log/kern.log 2>/dev/null | tail -10
journalctl -k --since "today" 2>/dev/null | grep -iE "killed process|out of memory" | tail -10
```

| O que vier | O que significa |
|---|---|
| linhas de `Killed process ... (node)` | **é OOM.** Memória e reinício são o MESMO problema. A prioridade vira memória, e com urgência: o sistema está matando robôs de clientes. |
| nada | são dois problemas. O reinício de 22:44 continua sem explicação (incidente próprio) e a memória segue no ritmo normal. |

### 16.3 O que já dá para decidir sem esse comando

**A cadência de deploy é problema por si só.** Oito promoções para `main` num
dia, três reconectando as 46 sessões — isso é a §7, agora com nomes e horários.
Não precisa de código: **agrupar as promoções `develop → main`** numa janela por
dia. Deploy de dashboard, rota, documentação ou teste continua não reiniciando
nada; o que custa são os três da tabela.

E **o experimento do arena continua segurado** até a frota ficar de pé por
algumas horas seguidas — hoje ela não ficou.

## 17. OOM descartado. São dois problemas, não um — e sobrou uma hipótese checável

`dmesg`, `/var/log/kern.log` e `journalctl -k` **não devolveram nada**. Nenhum
`Killed process`, nenhum `out of memory`.

**Então:**

- **não foi crash** (log de erro só tem `Bad MAC`, ruído conhecido);
- **não foi deploy** (última promoção às 19:46; o reinício foi ~22:44);
- **não foi o sistema matando por memória.**

E isso **desfaz a hipótese unificadora da §16**: memória e reinício são **dois
problemas separados**. O consumo "voltar ao mesmo lugar" continua sem explicação
confirmada — mas não é o kernel cortando a frota.

### 17.1 A hipótese que sobra, e ela é barata de checar

`ecosystem.config.cjs:119` — o `bot-supervisor` tem
**`max_memory_restart: '400M'`**. O próprio PM2 reinicia o processo quando ele
passa disso. O supervisor foi medido em 113 MB, mas um pico passageiro acima de
400 MB dispararia o reinício **sem deixar rastro no log da aplicação** — porque
quem reinicia é o PM2, não o código.

Isso encaixa com tudo que foi observado: sem stack, sem OOM do kernel, sem
deploy, e mesmo assim o processo renasce.

**O PM2 registra isso no log DELE**, não no log do app:

```bash
grep -iE "bot-supervisor" ~/.pm2/pm2.log | tail -40
grep -iE "memory|restart|stopping|exceed" ~/.pm2/pm2.log | tail -30
```

| O que vier | O que é |
|---|---|
| `exceeded memory limit` / `max memory reached` para `bot-supervisor` | **é o teto de 400 MB.** Tem conserto simples e conhecido, e explica os reinícios sem deploy. |
| só linhas de `stopping`/`starting` sem motivo | alguém ou algo chamou `pm2 restart`. Vale olhar histórico de comandos. |
| nada sobre o supervisor | segue sem explicação — e aí vale instrumentar antes de adivinhar de novo. |

⚠️ **Se for o teto de 400 MB, NÃO subir o número antes de medir o supervisor por
algumas horas.** Subir teto é mudança memory-heavy (REGRA #1) e, se o supervisor
estiver de fato crescendo, o teto está fazendo o trabalho dele — o problema seria
o crescimento, não o teto.

### 17.2 Onde a investigação de memória parou

| Item | Estado |
|---|---|
| `MALLOC_ARENA_MAX` | interruptor pronto, **desligado**, em produção desde 14:18 |
| experimento | **segurado** — precisa de frota assentada por algumas horas, e hoje ela reiniciou três vezes |
| o que falta para destravar | descobrir por que o supervisor reinicia sem deploy (§17.1) |
| medidor | pronto, versionado, imprime a idade da frota e recusa comparação inválida |

Nada disso é urgente: **nada está quebrado**. A frota está no ar, as sessões
conectadas, e o servidor tem folga física (4,9 GB livres, swap parado).

## 18. Resolvido: 100% dos reinícios são deploy. O problema é a frequência.

O log do PM2 fecha a questão. **Todas** as linhas têm a mesma forma:

```text
Stopping app:bot-supervisor id:5
App [bot-supervisor:5] exited with code [0] via signal [SIGINT]
App [bot-supervisor:5] starting in -fork mode-
```

**`code [0]` via `SIGINT`** é encerramento limpo e deliberado — é o que
`pm2 restart` faz. Não é crash (seria código de saída diferente), não é o teto
de 400 MB (o PM2 anuncia isso com texto próprio), não é o sistema. E os ~15
segundos entre `Stopping` e `starting` são o `kill_timeout`: o drain
acontecendo como desenhado.

### 18.1 A correspondência é exata

| merge em `main` (UTC) | toca worker? | reinício do supervisor |
|---|---|---|
| 16:40 #1711 | não | — |
| **17:01 #1714** | **sim (6 arq)** | **17:03** ✓ |
| **17:19 #1718** | **sim (4 arq)** | **17:21** ✓ |
| 17:52 #1719 | não | — |
| 18:18 #1720 | não | — |
| 18:32 #1721 | não | — |
| 22:14 #1722 | não | — |
| **22:47 #1730** | **sim (3 arq)** | **22:49** ✓ |

Três merges que tocam `WORKER_CODE_PATHS_RE`, três reinícios, **~2 minutos
depois de cada um**. O staging confirma o par: ele reinicia 6-7 minutos antes de
cada um (16:54, 17:14, 22:41), que é a promoção `develop → staging` precedendo a
`develop → main`.

Sobra um reinício não pareado às 17:05, quatro minutos depois do de 17:03 —
provavelmente a segunda rede do deploy (`workers_running_stale_code`) ou duas
execuções do workflow em sequência. Detalhe, não mistério.

### 18.2 O erro de método, pela terceira vez no mesmo eixo

Usei `%ad` (data de **autor**) em vez de `%cd` (data de **commit**). Em merge
commit os dois são muito diferentes: o autor vem do commit original, o commit
date é quando o merge aconteceu. Foi isso que fez os horários não baterem e me
levou a inventar hipótese de OOM.

**Três erros hoje, todos de tempo:** deduzir o horário do reinício (2×) e ler
data de autor como data de merge (1×). Regra que fica, e ela é curta:

> **Data de merge é `%cd`, nunca `%ad`. Horário de reinício vem do PM2, nunca de
> dedução. E antes de qualquer hipótese, conferir o fuso dos dois lados.**

```bash
git log --first-parent --format="%cd %s" --date=format-local:"%H:%M" origin/main --since="hoje"
```

### 18.3 O que fazer, e é só isto

**Nada está quebrado.** O sistema fez exatamente o que foi desenhado para fazer.
O que existe é **cadência**: oito promoções para `main` num dia, três delas
reconectando as 46 sessões de clientes.

**A correção não é código — é processo:** agrupar as promoções `develop → main`
numa janela por dia. As que não tocam código de worker (cinco das oito hoje)
continuam podendo sair a qualquer hora, porque não reiniciam nada.

Isso é o item da §7, agora com evidência completa em vez de suspeita.

### 18.4 E destrava a memória

Com a causa conhecida, o experimento do `MALLOC_ARENA_MAX` fica simples: **num
dia sem promoção que toque código de worker, a frota fica de pé por horas** — e
aí a medição vale. Não precisa esperar nada acontecer; precisa só de um dia sem
deploy de worker.

O interruptor segue pronto, desligado, em produção desde 17:19 UTC.

## 19. Janela 1 aplicada: `MALLOC_ARENA_MAX=2` em produção (2026-09-18, 23:50)

**Aplicado sem merge** — o interruptor já estava em `main` desde 17:19 UTC.
Uma linha no `.env` e `pm2 restart bot-supervisor`.

### 19.1 Aplicou — confirmado por inspeção, não por PSS

```text
WA_WORKER_MALLOC_ARENA_MAX=2      <- nossa variavel, do .env
MALLOC_ARENA_MAX=2                <- traduzida por resolveWorkerSpawnEnv
```

E a prova que não depende de interpretação: **a frota foi de 29,4 para 1,0 arena
por robô.** Aos 11 minutos de vida — quando um robô sem a variável já estaria em
~29 (medido hoje às 17:28, com 7 minutos).

| | arenas por robô |
|---|---:|
| sem a variável | 29,2 – 29,4 |
| **com a variável** | **1,0** |

### 19.2 Sinal inicial: modesto, e é preciso dizer isso

⚠️ **A comparação direta `antes` × `agora` NÃO vale**: o "antes" é frota de 60
minutos e o "agora" de 11. Frota nova é sempre mais leve. Os 9.145 → 6.189 MiB
**não são economia.**

O que dá para comparar é contra a leitura de hoje às 17:28, que era frota de
**7 minutos sem a variável** — idade parecida, e ligeiramente a favor dela (o
"com variável" é 4 minutos mais velho, logo deveria estar mais pesado):

| por robô (MiB) | PSS | arena | anon | heap | arena+heap | arenas |
|---|---:|---:|---:|---:|---:|---:|
| 17:28 **sem** variável (+7 min) | 146,4 | 71,6 | 57,0 | 14,1 | 85,7 | 29,2 |
| 00:00 **com** variável (+11 min) | **134,5** | **32,3** | 57,2 | **41,4** | **73,7** | **1,0** |
| | **−8,1%** | −55% | ≈ | **+194%** | **−14,0%** | |

**A memória mudou de balde, e é exatamente o mecanismo esperado.** O que estava
espalhado em 29 arenas passou a se concentrar na arena principal (`heap`, que
subiu 194%) mais duas. A arena secundária caiu 55%; a soma `arena + heap` caiu
14%; o PSS total caiu 8,1%.

**Se os 8,1% se sustentarem na frota saturada** (194,6 MiB/robô), isso é ~16 MiB
por robô, **~0,7 GB na frota**.

⚠️ **0,7 GB não é o prêmio de 3,5 GB que a §2-A.1 estimava como teto teórico.**
Aquele número era "se a fragmentação fosse a zero", e nunca foi previsão. O
resultado real, se confirmar, é um décimo disso — útil, mas não transformador.

⚠️ **E ainda não está confirmado.** Restam dois confundidores: as idades não são
idênticas (7 × 11 min) e o tráfego das 17:28 é maior que o da meia-noite. Os
dois puxam em direções opostas, o que ajuda, mas não substitui a medição limpa.

### 19.3 O veredito sai às 23:49 de hoje

Frota saturada, mesmo horário do `antes`, mesma variável ligada:

```bash
bash /tmp/medir.sh
```

Comparar com `194,6 MiB/robô` e `111,8 MiB/robô em arena`. Se ficar perto de
179 MiB/robô, os 8,1% se confirmam. Se voltar aos 194, não houve ganho.

Medir também algumas vezes ao longo do dia, para ter a curva.

**Rollback**, se necessário:
```bash
sed -i '/^WA_WORKER_MALLOC_ARENA_MAX=/d' ~/wabot/.env
pm2 restart bot-supervisor --update-env && pm2 save
```

---

## 20. Janela 2: código pronto (log, Sharp, corte de threads) — 2026-09-18

As três alavancas restantes, no mesmo padrão de interruptor do repo: nome de env
próprio, **nasce desligado**, decisão em módulo puro com teste, rollback por
`.env` sem redeploy.

### 20.1 O log: `LOG_TRANSPORT_MODE=inline`

`pino({ transport })` não é um destino — desde o pino 7 ele sobe um
`thread-stream`, ou seja **uma worker thread**, que no Node é uma isolate
INTEIRA do V8. Ela não aparece em `heapUsed` e aparece inteira no RSS. Como
`src/logger.js` é importado por 17 módulos, essa thread existe em todo processo
do produto.

`src/core/loggerTransport.js` (puro) escolhe o mecanismo; `inline` usa
`pino.multistream`, que roda **no próprio processo**.

**Medido aqui, 4 repetições, processo mínimo só com o logger:**

| modo | threads | PSS |
|---|---:|---:|
| `worker` (histórico) | 12 | 75,3–77,0 MiB |
| `inline` | 11 | 57,1–58,3 MiB |

**≈ 18 MiB de PSS por processo**, e o número **não muda com
`MALLOC_ARENA_MAX=2`** (medido nas duas condições) — ou seja, é ganho **somado**
ao da janela 1, não sobreposto.

⚠️ Este é um processo mínimo, num container de 4 núcleos. Não é a medida do
robô de produção; é o piso do mecanismo. O que ele prova é que a thread existe e
custa.

**O que se perde:** a saída do PM2 (`~/.pm2/logs/*-out.log`) deixa de ser
colorida e passa a ser JSON — o MESMO formato do `bot.log`, que é o arquivo que
todos os RCAs deste produto leem. **Nenhuma linha de log deixa de ser escrita**
(guarda estrutural no teste exige os dois destinos no caminho `inline`).

### 20.2 Sharp: `SHARP_CACHE_MB` / `SHARP_CONCURRENCY`

`sharp.cache()` é 50 MB de cache de operação **por processo**, memória nativa,
invisível no heap. Cinco módulos importam `sharp` no topo e todos são alcançados
pelo `bot-worker.js`.

⚠️ **O ganho aqui NÃO está medido.** 50 MB é o padrão documentado da
biblioteca; a medição de 17/09 achou `libvips-cpp.so` com 2,1 MiB de PSS e
**zero threads de vips** nos 41 robôs (o pool é criado sob demanda). Quanto cada
robô de fato encheu do cache é desconhecido. **Não prometer 50 MB.**

⚠️ Aqui `0` é valor **válido** e desliga o cache — ao contrário de
`WA_WORKER_MALLOC_ARENA_MAX`, onde `0` significa "não setar" (para o glibc,
`MALLOC_ARENA_MAX=0` quer dizer "automático"). Quem diz "não mexa" no Sharp é a
**ausência** da env. A diferença está documentada nos dois arquivos.

### 20.3 Corte de threads — e por que agora rende pouco

`WA_WORKER_TOKIO_THREADS`, `WA_WORKER_UV_THREADPOOL_SIZE` e
`WA_WORKER_V8_POOL_SIZE` (já construídos e testados em 17/09) cortam os pools de
thread do worker: 16 threads do motor Rust do Prisma para um arquivo SQLite, 4
do libuv, 7 do V8.

⚠️ **Com a janela 1 já aplicada, o mecanismo principal desta alavanca já foi
capturado.** O valor dela era *menos threads → menos disputa → menos arenas*, e
as arenas **já caíram de 29,4 para 1,0 por robô** com `MALLOC_ARENA_MAX=2`. O
que sobra é o custo direto: pilha de cada thread e agendamento. É pequeno, e é
a alavanca de **maior risco** das três (mexe no motor do Prisma).

Por isso ela é a **primeira a ser revertida** se o total da janela 2 não bater
com a soma esperada.

### 20.4 Aplicar exige deploy — e o deploy reconecta a frota

Os três arquivos tocados (`src/logger.js`, `src/core/`, `src/bot-worker.js`)
casam com `WORKER_CODE_PATHS_RE`: o deploy **reinicia o `bot-supervisor`** e
**todas as ~46 sessões reconectam de uma vez**. Isso é decisão humana, anunciada
antes — não fazer às cegas.

Ordem, depois do merge em `main` e do autodeploy:

```bash
# staging primeiro, para conferir que o log continua saindo nos dois lugares
cd ~/wabot-staging && cat >> .env <<'ENV'
LOG_TRANSPORT_MODE=inline
SHARP_CACHE_MB=8
WA_WORKER_TOKIO_THREADS=2
WA_WORKER_UV_THREADPOOL_SIZE=2
ENV
pm2 delete api-staging && pm2 start ecosystem.config.cjs --only api-staging
pm2 restart bot-supervisor-staging --update-env && pm2 save

# conferir que NADA deixou de ser logado
tail -5 ~/wabot-staging-shared/logs/bot.log
pm2 logs api-staging --lines 20 --nostream
```

Só depois disso em produção, e com anúncio prévio (a frota reconecta).

**Atribuição:** medir `antes` com a frota saturada, aplicar as três, medir
`depois` com a frota saturada. Se o ganho ficar abaixo do esperado, tirar
primeiro as duas envs de thread (`WA_WORKER_TOKIO_THREADS`,
`WA_WORKER_UV_THREADPOOL_SIZE`), reiniciar o supervisor e medir de novo — é a de
maior risco e a de menor ganho esperado.

**Rollback de qualquer uma**: apagar a linha do `.env` + `pm2 delete`/`start`
(pegadinha #1) e, para os robôs, `pm2 restart bot-supervisor --update-env`.
Nenhuma delas exige reverter código.

---

## 21. Veredito da janela 1: **confirmado, ~1 GB** (2026-09-18, 14:49)

Frota de pé desde ~23:50 do dia anterior — **cerca de 15 horas**, muito além da
hora que a §12.2 mediu como tempo de saturação. Comparação válida.

| por robô (MiB) | PSS | arena | heap | arena+heap | arenas |
|---|---:|---:|---:|---:|---:|
| **antes** (47 robôs, saturada) | 194,6 | 111,8 | ~17 | ~129 | 29,4 |
| **agora** (48 robôs, saturada) | **173,8** | **42,7** | 57,2 | **99,9** | **1,1** |
| | **−10,7%** | **−62%** | +236% | **−23%** | |

**Economia medida: ~20,8 MiB por robô, ~1,0 GB na frota.** A arena secundária,
que era 57% de toda a memória, caiu para 25%.

**Melhor que o sinal inicial**, que apontava 8,1% e ~0,7 GB — e a §19.3 tinha
fixado 179 MiB/robô como o número que confirmaria. Deu 173,8.

⚠️ **Os dois confundidores desta leitura empurram o resultado para BAIXO, não
para cima**, o que faz dos 10,7% um piso e não um teto:

- a frota agora tem **48 robôs**, não 47 — um robô a mais dividindo a mesma base;
- a leitura é das **14:49**, e o `antes` era de meia-noite. Tráfego de tarde é
  maior que o de madrugada, então a frota de agora está trabalhando mais.

**O mecanismo é o esperado e está inteiro nos números:** o que estava espalhado
em 29 arenas passou a se concentrar na arena principal (o `heap` triplicou) mais
uma. A soma `arena + heap` caiu 23% — ou seja, não foi contabilidade, foi
memória que deixou de ser reservada.

### 21.1 O que isso muda na conta de capacidade

Com 48 robôs a 173,8 MiB, a frota ocupa **8,1 GB** de PSS contra os 9,1 GB de
ontem. Em um servidor de 15,6 GB, é um GB inteiro de volta à folga — a mesma
folga que a política (`evaluateCapacity`) reserva para pico de GC e scrape
pesado, e que estava sendo consumida.

⚠️ **Isso NÃO é autorização para subir o teto de vagas.** A política continua
calculando o limite seguro pela reserva, e quem manda na decisão de aumentar é o
**swap**: enquanto ele ficar parado, está confortável; subindo de um dia para o
outro, o assunto é mais RAM, não mais robô.

### 21.2 Conferir daqui em diante

Uma linha por dia, para ver se o ganho se mantém e se o swap continua parado:

```bash
free -m | awk 'NR==2{print "livre_mb="$7} NR==3{print "swap_usada_mb="$3}'
bash /tmp/medir.sh
```

Comparar sempre com **173,8 MiB/robô**, que é o novo piso conhecido.

---

## 22. Janela 2 aplicada e medida: **−47%** sobre a janela 1 (2026-09-18)

Aplicada em produção às 15:42, junto com o reinício do supervisor. As três
chaves chegaram aos robôs (confirmado no `/proc/<pid>/environ`, não por
dedução):

```
LOG_TRANSPORT_MODE=inline
SHARP_CACHE_MB=8
SHARP_CONCURRENCY=2
MALLOC_ARENA_MAX=2      <- a da janela 1
```

O **corte de threads ficou de fora**: a alavanca dele era "menos arenas", e a
janela 1 já entregou isso (29,4 → 1,0). Era a de maior risco pelo menor ganho.

### 22.1 Duas leituras, e a curva inverteu

| frota com | idade | por robô | arena | anon | heap |
|---|---|---:|---:|---:|---:|
| só janela 1 | 15 h | 173,8 | 42,7 | 70,3 | 57,2 |
| **+ janela 2** | **1 h 03** | **115,3** | 24,2 | 53,6 | 34,0 |
| **+ janela 2** | **2 h 31** | **92,8** | **16,5** | **47,8** | **24,9** |

**−46,6% contra a janela 1 sozinha; −52,3% contra o ponto de partida de
ontem (194,6).** Na frota de 46 robôs, **~3,6 GB** a menos que ontem à tarde e
**~4,6 GB** a menos que anteontem.

**A objeção da idade da frota MORREU na segunda leitura.** Ela era legítima —
115,3 saiu de uma frota de uma hora, contra um "antes" de quinze. Mas no regime
antigo a memória **subia** com a idade (146 → 193 MiB por robô entre 7 e 31
minutos, §12.2). Aqui ela **desceu**: 115,3 aos 63 min, 92,8 aos 151 min. Uma
frota que emagrece com o tempo não está "ainda enchendo".

### 22.2 Por que caiu nos TRÊS baldes de uma vez

`pino({ transport })` não sobe uma thread: sobe **uma isolate inteira do V8**
dentro do processo, com heap, pilhas e arenas próprios — e com o `pino-pretty`
carregado lá dentro. Removê-la tira os três de uma vez, e é o que explica o
`heap` cair 56% numa mudança que, no papel, era "só o log". O resto vem do
cache do libvips (de 50 MB por processo para 8).

⚠️ **A medição local de 18 MiB por processo era o PISO do mecanismo**, num
processo mínimo de 4 núcleos. O ganho real no robô é ~4× isso. Não usar aquele
número como estimativa de produção.

### 22.3 O que este número NÃO autoriza

⚠️ **Não converter isto em "cabem mais robôs".** Tudo aqui é **PSS**; o teto de
vagas e `evaluateCapacity` trabalham com **RSS** (329 MB/robô medidos em
11/09). São medidas diferentes e misturá-las é exatamente a classe de erro que
custou três correções nesta investigação. Para rever capacidade, medir RSS de
novo, pela fórmula da §"Teto de robôs por processo".

**O sinal que manda continua sendo o swap**, não a RAM livre:

```bash
free -m | awk 'NR==2{print "livre_mb="$7} NR==3{print "swap_usada_mb="$3}'
bash /tmp/medir.sh
```

Novo piso de comparação: **92,8 MiB/robô**.

### 22.4 O que custou

A frota reconectou **três vezes** em 18/09 — 06:25, 15:10 (deploy da PR #1739)
e 15:42 (o `pm2 restart bot-supervisor` que aplicou as chaves). Só a última foi
por causa desta mudança.

⚠️ E o desligamento do supervisor **não completou sozinho**: 16 segundos de
`failed to kill` e o PM2 matou a árvore (`process tree killed (49 pids)`) — os
robôs levaram encerramento abrupto, e mensagem em voo se perde assim. Isso é
defeito separado, não investigado aqui, e vale uma rodada própria.

### 22.5 Erros meus nesta rodada, para não repetir

- **Acusei `UV_THREADPOOL_SIZE=2`** de causar a falha do Mercado Livre em
  staging. O log dizia `status: 401, failureType: "expired"` em 130 ms —
  credencial vencida, não fila. Mecanismo plausível não é evidência.
- **Li a queda das 15:41 como ganho.** Era frota de 31 minutos (deploy das
  15:10). A mesma armadilha da §12.2, terceira vez.
- **Levantei alarme** de que algo reiniciava a frota sem deploy. Era o comando
  que eu mesmo tinha passado, executado por ela minutos antes — estava no
  `~/.bash_history`. Antes de acusar o sistema, conferir o histórico.
