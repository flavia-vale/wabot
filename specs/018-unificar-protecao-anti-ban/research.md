# Research — 018 Anti-banimento (fase plan, 2026-09-23, revisado após a 2ª rodada da spec)

Tudo abaixo foi conferido no código da branch `018-unificar-protecao-anti-ban`
(a partir de `develop`). Cada item fecha um "ponto em aberto" da spec ou uma
incógnita do Technical Context.

**O que mudou nesta revisão** (spec, decisões A–E): variação de imagem saiu dos
campos fixos (R3); campos fixos passaram a ser **três**, todos por
destino/modelo (R2/R3); "Atraso entre canais" virou **"Intervalo entre
destinos"**, editável e com comportamento corrigido (R10, R11); destino com
limites desligados recomeça do **padrão do sistema** (R3, Achado C′); perda de
plano não reseta nada (R8); cutover = anunciar e deixar o supervisor reiniciar
(R7); a vazão do intervalo entre destinos virou **gate humano** (R4, Parte B).

---

## R1 — A tela de Conexão WhatsApp tem controle de anti-banimento? (FR-006a)

**Decision**: **nada a mexer.** `dashboard/app/painel/whatsapp/page.js` não tem
nenhum controle de proteção. A única ocorrência de vocabulário do tema
(`rajada`, ~linha 674) é um **comentário JSX** — não é texto visível.

**Rationale**: busca por `preserv|anti-ban|limite|horário|rajada|stagger|atraso|intervalo`
só devolveu esse comentário. FR-003 já põe o item "Anti-banimento" logo abaixo
de "Conexão WhatsApp" no menu.

**Alternatives considered**: cartão "Proteja seu número" na tela de Conexão —
rejeitado (RCA 2026-09-02: a tela diz só o que o robô faz com o WhatsApp dela).

---

## R2 — Onde aplicar "vale o mais conservador" (FR-011/FR-013)

**Decision**: **chokepoint único de LEITURA**, módulo puro
`src/core/antiBanFloor.js`, consumido **somente** dentro de
`resolveDestinationPreservation` (`src/core/preservationConfig.js`) — o único
ponto que monta a config efetiva de destino (`bot-worker.js` ~2502, dentro de
`processSendJob`). Cobre os três campos fixos em qualquer nível (override do
grupo, modelo atribuído, modelo padrão, padrão do sistema).

O `getConfig()` do worker **não** passa pelo piso: nenhum campo de conta é fixo
(decisões A e B da spec). O desenho anterior (piso de 20 s em
`channelStaggerJitterMs`) foi **descartado**.

**Sem migration DML.** Valores gravados ficam como estão (dormentes quando menos
conservadores ou quando o destino estava com limites desligados). As rotas
continuam aceitando e gravando o campo antigo (FR-013); o efeito é decidido na
leitura. GET passa a devolver também o valor **efetivo**.

**Rationale**: mesmo desenho de `Group.imageMode`/`toMonitorGroup` e de
`Group.listType`/`searchListType.js`; vale "para sempre", inclusive requisição
antiga e dado legado; reversível por env `ANTI_BAN_FLOOR=off` (só o valor exato
`off` desliga; inválido cai em ligado).

**Alternatives considered**:
- *DML + clamp nas rotas*: não mexeria em código do robô (sem restart), mas
  apaga customização, depende de todo caminho de escrita e não é reversível.
  A decisão E da spec aceitou o restart, então a alternativa fica só registrada.
- *Regra no front*: rejeitada — o robô não passa pela tela.

---

## R3 — Os três campos fixos: padrão real e efeitos

| Campo (spec) | Coluna | Onde vive | Padrão real | Quem lê |
|---|---|---|---|---|
| Tamanho da rajada | `burstCap` | `Group` (nulável) e `PreservationPreset` (default 6) | 6 | worker via resolver |
| Janela da rajada | `burstWindowSec` | idem (default 600) | 600 s | worker via resolver |
| Limites do destino | `throttleEnabled` | idem (default true) | ligado | worker via resolver |

**Fora do piso (spec, decisões A e B)**:

- **Variação de imagem** (`BotConfig.imageMutationActive`, default **false**;
  API expõe como `imageMutationEnabled`) — **sem nenhuma mudança** nesta
  feature: continua editável, mesmo padrão, mesmo gate. (O Achado A da 1ª
  rodada — o campo lido nasce desligado — foi o que motivou a decisão A.)
- **Intervalo entre destinos** (`BotConfig.channelStaggerJitterMs`) — editável,
  sem piso; ver R10/R11.

**Achado B — preset "Leve" fica mais lento (aprovado, decisão C da spec).**
`burstCap 10 / burstWindowSec 3600` → campo a campo `6 / 3600` = 6 por hora.
A tela renomeia/redescreve o botão pronto para não prometer o ritmo antigo.

**Achado C′ — limites desligados recomeçam do padrão do sistema (decisão da dona
do produto, repassada a esta fase).** Com `throttleEnabled=false`, `decideDestination`
(`src/core/channelThrottle.js`) ignora intervalo mínimo, limite diário e rajada.
Os valores gravados nesses destinos podem estar desatualizados (foram gravados e
desligados). **Decision**: quando o `throttleEnabled` **efetivo** resolvido for
`false`, o piso devolve:

| Campo | Valor efetivo |
|---|---|
| `throttleEnabled` | `true` |
| `minIntervalSec` | `HARD_DEFAULT_PRESERVATION.minIntervalSec` (30) |
| `dailyCap` | `HARD_DEFAULT_PRESERVATION.dailyCap` (`null` = sem limite diário) |
| `burstCap` | 6 |
| `burstWindowSec` | 600 |
| `operatingHoursEnabled/Json`, `queueMaxAgeMin` | **inalterados** (não são governados pelo liga/desliga) |

Isto é **diferente** da regra geral "vale o mais conservador" (que continua
valendo para rajada e janela quando os limites **estavam ligados**). "Padrão do
sistema" = `HARD_DEFAULT_PRESERVATION`, **não** o modelo padrão da conta: o
modelo padrão da conta pode ele mesmo estar desligado ou com valores antigos,
e "recomeçar do padrão" pede uma referência que não dependa do que a conta
gravou. Como a resolução é campo a campo, o `throttleEnabled=false` efetivo
significa que o nível que forneceu o liga/desliga estava desligado; aplicar a
exceção depois da resolução cobre override de grupo e modelo.

⚠️ Contradiz a redação atual do Edge Case da spec ("passam a valer … o que esse
destino já tinha gravado") — sinalizado no plan.md para correção da spec.

**Alternatives considered**: usar os valores gravados (redação atual da spec) —
rejeitado pela dona ("zerar e recomeçar do padrão"); usar o modelo padrão da
conta — rejeitado pelo motivo acima.

**Faixas nas rotas** (compatibilidade, inalteradas): `burstCap 1..1000`,
`burstWindowSec 60..86400`, `channelStaggerJitterMs 0..600000`.

---

## R4 — Medir o impacto antes do deploy (`scripts/diag-antiban-valores.mjs`)

Read-only, no padrão dos `scripts/diag-*.mjs`. **Importa** as regras do produto
(`antiBanFloor.js`, `resolveDestinationPreservation`, `destinationSpacing.js`,
`shouldDropExpiredQueueJob`) — nunca reimplementa. Toda consulta que falhar é
**impressa**, nunca vira "zero" (lição do `diag-assinatura-recusada.mjs`).
`--detalhes` lista contas por e-mail (nunca telefone). Datas via Prisma (o
`sentAt` cru no SQLite é número em ms — armadilha documentada no AGENTS.md).

### Parte A — quem muda com o piso

- por campo fixo (3): linhas/contas **menos conservadoras** (mudam),
  **mais conservadoras** (mantêm + etiqueta R6), **iguais**, **herdando**;
  separado por "tem acesso ao plano" × "não tem";
- por destino: efetivo **antes** (resolver sem piso) × **depois** (com piso) —
  prova de SC-004/SC-005: nenhum "depois" menos conservador que o "antes";
- destinos com limites **desligados**: quantos, e os valores gravados que serão
  **ignorados** em favor do padrão do sistema (Achado C′);
- destinos em "Leve" / rajada mais lenta que o fixo (Achado B).

### Parte B — vazão do "Intervalo entre destinos" (GATE HUMANO)

**Obrigatória.** É o número que a dona do produto pediu para ver antes de fixar
o padrão final. Esta sessão não tem acesso ao banco; **quem roda é ela, no VPS,
em staging e produção**. Saída colada na PR `develop → main`.

1. **Destinos por conta** (grupos + canais + `status@broadcast` quando
   `postToStatus`), juntos: p50, p90, máximo; top 10 contas.
2. **Atraso projetado da última saída** de uma oferta para todos os destinos da
   conta: `(N − 1) × intervalo`, com (a) o valor gravado da conta e (b) o padrão
   provisório de 20 s. Também com o N **observado** por oferta nos últimos 7
   dias (destinos distintos por mensagem de origem no `MessageLog`), não só o N
   cadastrado.
3. **Vazão**: teórica = `3600 / intervalo` envios/hora para destinos diferentes;
   observada = pico de envios `success` por hora da conta em 7 dias. Listar
   contas em que observado > teórico (acumulariam fila).
4. **Descarte por idade**: comparar (2) e o acúmulo de (3) com o **menor
   `queueMaxAgeMin` efetivo** dos destinos da conta (padrão 300 min).
   Classificar: `ok` (< 50%), `atenção` (≥ 50%), `descartaria` (≥ 100%).
5. Resumo final em linguagem simples: "com 20 s, a conta com mais destinos (N)
   leva X min para terminar uma oferta; Y contas ficam em atenção; Z
   descartariam ofertas".

**Critério de decisão (da dona, não automático)**: se houver contas em
"atenção"/"descartaria", escolher entre padrão menor, rever o teto de descarte
dessas contas/padrão, ou aceitar. **Nada disso é implementado nesta feature.**
O valor de 20 s é **provisório** até ela decidir.

---

## R5 — Fonte única do direito de acesso (FR-015/FR-015a)

**Decision**: a tela importa `canUseAdvancedPreservation` de
`src/billing/plans.js` (módulo puro; o dashboard já importa módulos puros de
`src/`). `canAccessAdvancedPreservation` (`dashboard/lib/plan.js`, esquece
Premium) é **removida**; `hasProLikeAccess` passa a delegar a
`getPlanEntitlements`. Teste compara tela × backend nos 5 perfis.

**Achado lateral**: `preservation.js` recusa com **402**, `config.js`/`groups.js`
com **403**, mesmo corpo. Não unificar o código HTTP; só a mensagem muda para
"O Anti-banimento é um recurso do plano PRO.".

---

## R6 — Destino com ritmo mais cuidadoso que o padrão (UX, FR-011)

**Decision**: `describeDestinationFloor` devolve, por destino e por modelo,
`ritmoMaisCuidadoso: boolean` = algum dos três campos gravados é
**estritamente** mais conservador que o fixo **e** os limites estavam ligados.
Destino que estava com limites desligados **nunca** recebe a etiqueta (ele
recomeça do padrão — Achado C′). A tela mostra, só leitura:

> 🐢 **Ritmo mais cuidadoso** — este grupo usa um ritmo mais devagar que o
> padrão, escolhido antes. Ele continua valendo.

Botão "Voltar ao ritmo padrão" limpa os overrides (`null`) pela rota existente.
**Não existe mais etiqueta de conta** (nenhum campo de conta tem piso).

**Alternatives considered**: mostrar os números antigos em cinza (reintroduz
jargão); esconder (tela e robô pareceriam discordar).

---

## R7 — Reconexão e RAM

**RAM**: zero. Nenhum processo, cache ou dependência nova; o estado do
espaçamento são dois números em memória por worker.

**Reconexão — SINALIZAR**: mudam `src/core/preservationConfig.js`,
`src/core/channelThrottle.js`, os novos `src/core/antiBanFloor.js` e
`src/core/destinationSpacing.js`, e `processSendJob`/enqueue em
`src/bot-worker.js` — todos em `WORKER_CODE_PATHS_RE`. O deploy de `main`
**reinicia o `bot-supervisor` e reconecta todas as sessões**. Decisão E da spec:
**anunciar às clientes antes e deixar reiniciar**. Sugestão para tasks: aviso
no painel/e-mail com 24 h de antecedência e deploy em horário de menor
movimento (madrugada de dia útil), com a dona acompanhando.

---

## R8 — Perder o plano (FR-019)

**Como é hoje**: ritmo por destino e `channelStaggerJitterMs` **não** são gated
por plano no worker; defesas de conta (variação de imagem, vigia de seguidas,
observador, variação de texto) só agem com `preservationActive`; rotas recusam
sem plano; nada é apagado.

**Decision (spec decisão D)**: manter. Sem plano, a tela bloqueia; o robô segue
lendo os valores gravados — ritmo por destino **com piso** e **intervalo entre
destinos gravado** (agora com o significado novo). Nenhum reset, nenhum gate
novo no robô. Ao reassinar, reencontra tudo.

---

## R9 — Estrutura da tela e rotas antigas

**Decision**: rota `/painel/anti-banimento` com três partes por `?parte=` e
`?destino=<groupId>`; as quatro rotas antigas viram `redirect()`. Menu: sai o
grupo "Preservação avançada"; entra 1 item "Anti-banimento" (`pro: true`) no
grupo "Configuração", após "Conexão WhatsApp". Celular: lista com busca, sem
largura fixa.

**Superfícies de texto a renomear**: `src/billing/plans.js`, `nav.js`,
`espelhamento/page.js`, `UpsellShell.js`, `dashboard/lib/painel/logsCopy.js`,
`landing/Pricing.jsx`, `Hero.jsx`, `marketing-content.js`,
`planEntitlements.js`, e **`deferReasonMessage` do `bot-worker.js`** (cita
"Preservação por destino" e "Máximo de envios na janela" — texto que chega ao
painel pelo `MessageLog.errorMsg`). Páginas públicas de SEO só trocam o nome do
recurso no corpo; título, H1 e URL não mudam; nenhuma frase promete que não bane.

---

## R10 — "Intervalo entre destinos": nome, coluna, faixa, semântica

**Decision**:

- **Coluna mantida**: `BotConfig.channelStaggerJitterMs` (Int, ms, default
  20000). **Sem rename de coluna.** Rename no SQLite é recriação de tabela (DDL
  com lock exclusivo — pegadinha #8, janela de parada da API) para ganho só
  cosmético; a spec pede preservar o dado e aceitar o campo pelo nome atual. O
  nome novo vive na tela e no texto; o código ganha um comentário e um alias de
  leitura interno (`destinationIntervalMs` no módulo puro) para ninguém ler
  "stagger/jitter" como significado atual.
- **API**: continua `channelStaggerJitterMs` em PUT/GET (0..600000). Nenhum
  segundo nome aceito na escrita (dois nomes para o mesmo campo é como uma tela
  e um script passam a discordar).
- **Semântica nova**: espera **fixa** (não mais sorteio 0..X) entre dois envios
  consecutivos da conta para destinos **diferentes**, qualquer tipo (grupo,
  canal, `status@broadcast`) e qualquer origem (espelhamento, filas, ofertas
  automáticas, enviar agora, agendados). Envio consecutivo para o **mesmo**
  destino é isento (quem controla é `minIntervalSec`).
- **Faixa na tela**: 0 a 600 segundos, inteiro. **0 é aceito** e significa "sem
  espaçamento extra" (os limites por destino continuam valendo).
- **Padrão**: 20 s — **provisório** até o gate humano (R4 Parte B). Sem
  migration nesta feature.
- **Plano**: não é gated no worker (como hoje) — vale com ou sem plano; editar
  exige plano (tela e rota).
- **Pendência (1) do RCA 2026-07-28** ("vale mesmo com a proteção desligada")
  deixa de ser pendência: o intervalo passa a ser parte declarada da proteção.

**Alternatives considered**: manter sorteio 0..X (rejeitado — a spec pede
intervalo, e sorteio não garante SC-005c); aplicar só a canais (rejeitado —
FR-023); `ALTER TABLE RENAME COLUMN` (rejeitado acima).

---

## R11 — Reaproveitar `deferSendJob`/`notBefore` para o intervalo entre destinos

**Como é hoje** (conferido):

- enqueue do espelhamento (`bot-worker.js` ~4611) sorteia
  `staggerMs = random(0..channelStaggerJitterMs)` só para `destIndex > 0` e
  destino canal, e grava em `job.delayMs`;
- `processSendJob` (~2583) soma `job.delayMs` ao freio de pressão e ao descanso
  e faz `await sleep(totalDelayMs)` **dentro do consumidor serial** — é o
  defeito do RCA;
- o gate do destino (`throttleCheckAndReserve` → `decideDestination`) já sabe
  adiar sem travar: espera > `THROTTLE_INLINE_WAIT_MAX_MS` (5 s) →
  `deferSendJob(job, gate)`, que volta o `MessageLog` para `queued` e
  re-enfileira com `notBefore = gate.deferUntil`; o backend memória guarda o job
  em `scheduled` (fora da fila) e o BullMQ usa `delay` nativo;
  `job.enqueuedAt` é preservado (o descarte por idade continua valendo).

**Decision**:

1. **Chokepoint puro novo `src/core/destinationSpacing.js`** (contrato em
   `contracts/destination-spacing.md`):
   - `decideDestinationSpacing({ now, destJid, intervalMs, state })` →
     `{ allow, deferUntil, reason: 'destination_spacing' }`, onde `state =
     { lastSendAt, lastDestJid, nextFreeSlotAt }`;
   - `combineGateDecisions(destDecision, spacingDecision)` → a decisão com a
     **maior** espera (`deferUntil` maior); `allow` só se as duas liberam. É aqui
     que mora a regra de FR-025 ("vale a maior, não soma, não substitui").
   - `reserveSpacingSlot(state, { now, destJid, deferUntil, intervalMs })` →
     novo estado (cursor da próxima vaga).
2. **`channelThrottle.js`** ganha a decisão **sem reserva** (peek) — `checkAndReserve`
   passa a aceitar a decisão de espaçamento e só reserva o slot do destino se a
   decisão **combinada** liberar. Sem isso, o destino reservaria a vaga
   (contaria na rajada/limite diário) e o job seria adiado pelo espaçamento —
   vaga queimada.
3. **`processSendJob`**: o gate combinado roda para **todo** destino (inclusive
   sem `Group`, como `status@broadcast`, onde só o espaçamento decide). Se a
   decisão combinada não libera por espaçamento, **sempre** `deferSendJob`
   (mesmo espera curta — FR-024 proíbe esperar dentro da fila); o caminho de
   espera inline curta continua existindo **só** para o `min_interval` do
   próprio destino, como hoje. Ordem canônica preservada: preservação →
   revalidação de vínculo → descarte por idade → freio de pressão/descanso →
   **gate combinado (destino + espaçamento)** → tentativas de envio.
4. **Estado em memória do worker** (um worker por conta, consumidor serial):
   `lastSendAt`, `lastDestJid` e `nextFreeSlotAt`, atualizados no momento em que
   o gate combinado libera (mesmo instante da reserva do destino). Zera no
   restart do worker — no primeiro envio após restart não há espaçamento
   (aceitável: o restart já é um evento raro e a proteção por destino continua;
   persistir custaria escrita a cada envio).
5. **Cursor de próxima vaga** (contra churn N²): quando o espaçamento adia um
   job, ele recebe `deferUntil = max(nextFreeSlotAt, lastSendAt + intervalo,
   deferUntil do destino)` e o cursor avança `deferUntil + intervalo`. Sem
   cursor, N jobs adiados para o mesmo instante seriam re-adiados em cascata
   (N(N−1)/2 updates de `MessageLog` por oferta). Vaga reservada por job que
   depois for descartado/adiado pelo destino só deixa um buraco (mais lento,
   nunca mais rápido).
6. **Remoção**: o sorteio `staggerMs` sai do enqueue (`delayMs: 0`), e
   `processSendJob` deixa de dormir `job.delayMs` (jobs antigos persistidos no
   BullMQ com `delayMs` são tratados pelo gate novo, sem `sleep`).
7. **Motivo no painel**: `deferReasonMessage('destination_spacing')` em
   linguagem leiga ("Esperando o intervalo entre destinos que você definiu no
   Anti-banimento"). Log `info` com nome próprio para medir em produção.
8. **Escape hatch**: `DESTINATION_SPACING=off` (só o valor exato) faz
   `decideDestinationSpacing` sempre liberar — **não** volta o `sleep` antigo.

**Interpretação de SC-005b**: como o espaçamento é da conta inteira, durante o
intervalo nenhum envio para **outro** destino sai (é o objetivo). O que a
correção garante é que o **consumidor não fica congelado**: jobs para o mesmo
destino (sujeitos ao `minIntervalSec`), descartes por idade/vínculo, e jobs
cujo adiamento já venceu continuam sendo processados. O teste de SC-005b mede
"nenhum `sleep` do espaçamento no consumidor" e "log de adiamento com horário",
não "outros destinos saindo durante o intervalo".

**Alternatives considered**:
- manter `sleep` curto inline para espera ≤ 5 s (rejeitado: FR-024 é absoluto);
- persistir `lastSendAt` da conta no banco (rejeitado: uma escrita a mais por
  envio para cobrir só o primeiro envio pós-restart);
- adiar sem cursor (rejeitado: churn N²);
- somar as esperas (rejeitado: FR-025).
