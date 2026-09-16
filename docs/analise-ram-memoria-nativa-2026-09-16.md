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
2. **Reduzir threads** (novo, §3.6) — causalmente acima das arenas. **16 das
   29 são do motor do Prisma** (§2-A.4).
3. **Thread do transporte do log** (§3.2) — continua valendo, e agora por dois
   motivos: os 11,7 MiB da isolate **e** uma thread a menos alimentando arena.
4. **Sharp** (§3.3) — só o cache nativo de 50 MB; a parte de threads caiu na
   medição (§2-A.5).
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

### 2-A.6 A leitura que fecha a conta (somente leitura, custo zero)

Ela testa a hipótese central — **mais threads ⇒ mais arenas ⇒ mais memória** —
e diz se os workers pesados são os que têm o pool do vips ligado. Reusa o
`/tmp/mem.awk` já criado pelo comando da §3.0:

```bash
# ---------- cole daqui (reusa /tmp/mem.awk do comando anterior) ----------
ALVO="/home/deploy/wabot/src/bot-worker"
for p in $(pgrep -f "$ALVO"); do
  L=$(awk -v PID=$p -v TH=0 -f /tmp/mem.awk /proc/$p/smaps 2>/dev/null) || continue
  pss=$(echo "$L" | awk '{print $6}'); ar=$(echo "$L" | awk '{print $10}')
  arena=$(echo "$L" | tr ' ' '\n' | awk -F= '/^arena_glibc=/{print $2}')
  C=/proc/$p/task
  th=$(ls $C 2>/dev/null | wc -l)
  tk=$(cat $C/*/comm 2>/dev/null | grep -c tokio)
  vp=$(cat $C/*/comm 2>/dev/null | grep -ci vips)
  [ -n "$pss" ] && printf "%7s %-7s %4s %5s %5s %6s %8s\n" "$pss" "$p" "$th" "$tk" "$vp" "$ar" "$arena"
done | sort -rn | awk 'BEGIN{printf "%7s %-7s %4s %5s %5s %6s %8s\n","PSS","pid","thr","tokio","vips","arenas","MiB_arena"}
  {print; n++; t+=$3; k+=$4; v+=$5; a+=$6; m+=$7}
  END{printf "\n%d robos | %d threads (tokio %d = %.0f%%, vips %d) | %d arenas | %.0f MiB em arena\n", n,t,k,k*100/t,v,a,m}'
# ---------- ate aqui ----------
```

Leitura do resultado:

- **`thr`/`arenas` crescendo junto com `PSS`** → a hipótese se confirma e a §3.6
  vira a alavanca principal;
- **`vips` só nos pesados** → o pool do Sharp é ligado por tráfego, e §3.3 volta
  a valer pelas threads também;
- **`vips` zero em todos** → a parte de threads de §3.3 está morta e sobra só o
  cache de 50 MB;
- **`arenas` igual em todos, com `MiB_arena` muito diferente** → a poça é a
  mesma e o que varia é o quanto ficou preso nela: fragmentação pura, e o
  caminho é §3.1 antes de §3.6.

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

⚠️ Este PR **não reinicia o `bot-supervisor`**: nenhum dos arquivos que ele
adiciona (`docs/`, `scripts/`, `src/ops/memory/`, `test/`) casa com
`WORKER_CODE_PATHS_RE`, e a segunda rede (mtime dos arquivos do worker) também
não é acionada, porque o `git pull` só reescreve arquivo alterado. As sessões
seguem intactas.

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
2. ✅ **Nomes das threads lidos** (§2-A.4): 16 de 29 são do motor do Prisma.
   Falta a correlação da **§2-A.6** (custo zero) e o teste de um minuto do
   `TOKIO_WORKER_THREADS` em staging (§3.6).
3. **Rodar a medição da §3.5** (SQL somente leitura). Independe de tudo acima e
   pode entregar 218 MiB por robô que não precisava existir.
4. **Preparar UMA janela só**, com tudo que exige reinício do supervisor:
   `MALLOC_ARENA_MAX` (§3.1), corte de threads (§3.6), destino do log (§3.2),
   Sharp (§3.3) e o encerramento da POC (§6). **`ops_sqlite_busy` e o event loop
   são os dois sinais a vigiar depois** (§3.6). Validar em staging antes, e medir
   com o mesmo bloco da §3.0 **antes e depois** — o número a comparar é o PSS
   somado e a linha `arenas respondem por N% do PSS`.
5. ~~§3.4 (Prisma)~~ — encerrada pela medição.

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
