# Fila serial: defer não pode congelar + migrar config global → direcionada

- **Data:** 2026-06-22
- **Status:** plano (não implementado)
- **Origem:** incidente em produção — fila "Shoppe" da cliente
  `julianepumuceno16@gmail.com` apareceu "travada" com itens pendentes que não
  enviavam.
- **Escopo:** (A) correção estrutural de curto prazo (itens 1+2+3 + nomenclatura);
  (B) plano estratégico para **eliminar a configuração global de preservação** e
  torná-la **direcionada** por destino/fonte (grupo monitorado, fila, automação).

> Fluxo canônico (AGENTS.md): toda mudança nasce em branch a partir de
> `develop` → PR para `develop` (autodeploy staging, validar em
> `http://178.105.54.0:3006`) → só depois PR `develop`→`main`. TDD com
> `node:test`. Migrações passam por staging antes de prod. Não importar
> `sessionCore` direto — sempre via `manager.js`.

---

## 0. Resumo executivo

A fila de envio do worker é **serial por usuário**. Quando qualquer destino é
diferido por throttle longo (janela silenciosa, `burst_cap`, `daily_cap`,
`health_paused`), o `processSendJob` faz `await sleep(deferUntil)` **dentro** do
consumidor serial e **congela todos os envios do usuário** — inclusive os de
destinos liberados e de outras fontes. Foi o que travou a fila da cliente:
um **encaminhamento** para um grupo que estourou `burst_cap` segurou a fila
inteira por horas.

Some-se a isso uma **contradição de configuração**: a fila tem "horário de
funcionamento" próprio (`OfferQueue.operatingHours`, janela de *permissão*), mas
o worker reaplica a "janela silenciosa" global (`BotConfig`, janela de
*bloqueio*) — duas janelas com semântica **oposta**, em telas separadas. A
cliente preencheu a global (silêncio) como se fosse a de funcionamento e
silenciou a conta o dia inteiro.

Duas frentes:

- **A (curto prazo):** (1) defer nunca trava a fila serial; (2) fila com horário
  próprio ignora a global; (3) watchdog de `sending` preso; + **unificar a
  nomenclatura** em "horário de funcionamento".
- **B (estratégico):** acabar com o blob global e mover toda a preservação para
  **config direcionada** (por destino e por fonte), preservando a proteção
  anti-ban do encaminhamento e da pausa de saúde.

---

## 1. Diagnóstico técnico (confirmado em produção)

- Fila de envio em memória: `createMemorySendBackend` em
  `src/sendQueueBackend.js` — estritamente serial:
  `while (queue.length) { job = shift(); await onDequeued(job) }`.
- `processSendJob` (`src/bot-worker.js`, ~linhas 1126–1140) tem o loop:
  `while (!gate.allow) { await sleep(gate.deferUntil - now); gate = throttleCheckAndReserve(...) }`.
  O `await sleep` **bloqueia o consumidor serial** → nenhum job seguinte é
  desenfileirado enquanto o head dorme. O `withSendTimeout` (90/60/45s) cobre só
  o `sock.sendMessage`, **não** esse loop.
- `throttleCheckAndReserve`/`decide` (`src/core/channelThrottle.js`) aplica, por
  destino-post, na ordem: `health_paused` → `quiet_hours` → `daily_cap` →
  `min_interval` → `burst_cap`. Os defers longos (`quiet`, `daily`, `health`,
  `burst`) podem somar horas.
- A janela global vem de `BotConfig.channelQuietHoursJson` +
  `channelThrottleEnabled`/caps; o gate roda quando
  `shouldRunChannelScheduler(preservationActive, cfg)` é verdadeiro
  (`src/core/preservationFeatures.js`).
- **Evidência do incidente:** `decide()` rodado em prod devolveu
  `DEFER quiet_hours` (janela invertida `{startHour:7,endHour:22}` = silêncio o
  dia inteiro) e, depois de corrigida a config, um job em `sending` desde 19:28
  para um destino com `burst_cap` (7/h) — vindo de um **encaminhamento**
  (`src=...@g.us`), não da fila — segurou os 12 envios da fila atrás dele.

Conclusão: o throttle está **correto** (anti-ban). O bug é **arquitetural** — um
defer de **um** destino congela a fila **inteira** do usuário; e o override
por-fila não chega ao worker.

---

## 2. Plano A — correção estrutural de curto prazo (pronto p/ implementar)

### Item 1 — defer NUNCA pode travar a fila serial (principal)

- Em `processSendJob` (`src/bot-worker.js`): quando `throttleCheckAndReserve`
  retornar `!allow`:
  - **defer curto** (≤ ~90s, tipo `min_interval`): pode esperar inline (barato).
  - **defer longo** (`quiet_hours`/`burst_cap`/`daily_cap`/`health_paused`):
    reverter o `MessageLog` para `queued`, **re-enfileirar o job com
    `notBefore = gate.deferUntil`** e **retornar**, liberando o consumidor para
    os próximos jobs (de outros destinos/fontes).
- Adicionar suporte a `notBefore`/delay no `createMemorySendBackend`
  (`src/sendQueueBackend.js`): job com `notBefore` no futuro é agendado via
  `setTimeout` para reentrar na fila quando vencer — **sem busy-loop**. O backend
  BullMQ já suporta `delay` (usar `opts.delay`).
- Preservar: `withSendTimeout` no envio real; `SEND_MAX_ATTEMPTS`; o drain de
  shutdown (`markInterruptedSendLogs`) precisa cobrir também jobs
  agendados/re-enfileirados.
- **Testes (TDD):** (a) destino diferido não bloqueia envio para outro destino;
  (b) job re-enfileirado sai quando a janela libera; (c) sem busy-loop quando
  todos os jobs são do mesmo destino diferido; (d) shutdown trata jobs agendados.

### Item 2 — horário da fila sobrepõe a janela global (no worker)

- No dispatcher (`src/offerQueue/dispatcher.js`), na chamada `sendBroadcast(...)`:
  passar `ignoreGlobalQuietHours: queue.operatingHoursEnabled === true` (já passa
  `source:'offerQueue', queueId`).
- Propagar o flag: `sendBroadcast` options → IPC → `enqueueSendJob` (campo do
  job, ~`src/bot-worker.js:921`) → `processSendJob` → opts do
  `throttleCheckAndReserve` → `decide()`.
- Em `decide()` (`src/core/channelThrottle.js`): com o flag, **pular apenas o
  bloco `quiet_hours`** — manter `health_paused`/`daily_cap`/`min_interval`/
  `burst_cap`.
- Backward-compatible (sem flag = comportamento atual). Conferir o caminho
  remoto (`src/supervisor/protocol.js`, `client.js`): por ser campo novo dentro
  do `options` que já trafega, **não** deve exigir bump de `PROTOCOL_VERSION` —
  confirmar que o `options` passa íntegro.
- **Testes:** envio de fila com o flag ignora quiet, mas ainda respeita
  burst/daily/health.

### Item 3 — watchdog de `MessageLog` preso em `sending`

- Cron periódico espelhando `recoverStuckQueueItems`
  (`src/offerQueue/dispatcher.js`): `MessageLog` em `sending` há mais de N min →
  reclassificar (erro recuperável) ou re-enfileirar. Pode ser PR separado.

### Item 4 — unificar nomenclatura: "horário de funcionamento"

Hoje convivem dois termos opostos:

- **"Janela de funcionamento"** (fila): janela de *permissão* — envia dentro dela.
- **"Janela silenciosa"** (global): janela de *bloqueio* — pausa dentro dela.

**Decisão:** padronizar tudo em **"horário/janela de funcionamento"** (quando
ENVIA). Mais intuitivo (modelo de "horário de loja"), evita a inversão mental que
causou o incidente, e a fila já usa esse termo. O silêncio vira implícito ("fora
do horário, o bot fica em silêncio").

- UI: renomear `dashboard/components/preservacao/QuietHoursForm.js` →
  `OperatingHoursForm` (textos, presets, legendas).
- Dados: **migração** convertendo `channelQuietHoursJson` (bloqueio) para
  funcionamento = complemento `{ start: quiet.endHour, end: quiet.startHour, tz }`
  (ex.: quiet `{0,6}` → funcionamento `{6,0}`). `decide()` passa a tratar a janela
  como "FORA dela = pausa". Preserva o comportamento atual de cada cliente; passa
  por staging antes de prod.

**Arquivos-chave (Plano A):** `src/bot-worker.js`, `src/sendQueueBackend.js`,
`src/core/channelThrottle.js`, `src/offerQueue/dispatcher.js`,
`dashboard/components/preservacao/QuietHoursForm.js`, migração Prisma.

---

## 3. Plano B — eliminar o global, tudo direcionado

### 3.1 Objetivo

Acabar com a configuração de preservação **global** (`BotConfig.*` de
quiet/throttle) e tornar a cadência/janela/limites **direcionados**, cobrindo as
**três fontes de tráfego**:

1. **Encaminhamento de grupo monitorado → repost** (fluxo principal hoje sem
   config própria — só a global protege).
2. **Fila de ofertas** (`OfferQueue`) — já tem horário + caps próprios.
3. **Automação de ofertas** (`OfferAutomation`) — hoje parcial.

### 3.2 Princípio de design (decisão-chave a bater)

Há **dois eixos** de configuração, e eles servem a coisas diferentes:

- **Anti-ban (proteção da CONTA)** — intervalo mínimo, burst, teto diário, pausa
  de saúde (403), janela de funcionamento. O risco é **por destino** (não floodar
  um grupo/canal). Casa naturalmente no **DESTINO** (o `Group`/canal-post), e
  governa **todo** envio para ele, **independente da fonte**.
- **Cadência de DISPARO (preferência da FONTE)** — com que rapidez aquela fila/
  automação solta itens. Casa na **FONTE** (`OfferQueue`/`OfferAutomation`).

> **Recomendação:** a preservação anti-ban (o que hoje é global) deve migrar para
> **config por DESTINO** — porque é o destino que precisa ser protegido, e isso
> cobre o encaminhamento automaticamente (ele herda a config do grupo onde
> posta). A cadência por fonte fica como camada adicional opcional.
>
> **Decisão em aberto (precisa de sign-off):** se o produto preferir expor a
> config "por fonte" (ex.: "deste grupo monitorado, reposta no máximo X/h"),
> definir como as duas camadas se combinam (a mais restritiva vence). Resolver
> isto **antes** de modelar o schema.

### 3.3 Modelo de dados proposto (rascunho)

- Novo conjunto de campos de preservação **no `Group`** (destino-post): janela de
  funcionamento, `minIntervalSec`, `burstCap`, `burstWindowSec`, `dailyCap`,
  toggles. `ChannelThrottle`/`ChannelHealth` já são **por `groupId`** — muda só a
  **origem dos limites** (do `BotConfig` global → do próprio `Group`).
- Opcional (camada de fonte): campos de cadência em `OfferAutomation` (a fila já
  tem). Encaminhamento herda 100% do destino.
- `BotConfig.*` de preservação vira **template/default da conta** (usado para
  semear novos destinos), não mais a verdade aplicada no envio.

### 3.4 Migração (sem janela sem proteção)

1. **Fase 0:** entregar o Plano A (itens 1+2+3+4). Isso já tira a contradição e o
   congelamento — independente do modelo de config.
2. **Fase 1:** criar os campos por-destino e **semear cada `Group`-post com os
   valores globais atuais** do dono (comportamento idêntico no dia 1). `decide()`
   passa a ler os limites do `Group`; cai no global como fallback enquanto a
   migração não cobre 100%.
3. **Fase 2:** UI direcionada — editar preservação **por grupo/canal de destino**
   (e cadência por fila/automação). Validar em staging.
4. **Fase 3:** quando todo o tráfego estiver coberto por config direcionada e
   validado, **aposentar o global como fonte de verdade** (mantê-lo, no máximo,
   como template de conta).

Cada fase é deployável e reversível; **nunca** existe um momento sem proteção
anti-ban (decisivo em multi-tenant).

### 3.5 Riscos e restrições

- **Multi-tenant / ban irreversível:** remover proteção do encaminhamento sem
  substituto = risco de ban em massa. Por isso a migração é faseada e semeada —
  jamais "desligar a global" antes de a direcionada cobrir tudo.
- **Pausa de saúde (403)** é reativa e por-destino: **tem** que continuar
  existindo (no destino), não pode virar opção que o usuário desliga sem saber.
- **Encaminhamento não tem UI de fonte hoje:** a herança pelo destino resolve sem
  obrigar o usuário a configurar nada novo para o fluxo principal.
- **Volume de dados:** semear N destinos por usuário; cuidar de índices e do
  custo no boot/migração.

### 3.6 Decisões em aberto (resolver no início da sessão de design)

- Config anti-ban mora no **destino** (recomendado) ou também na **fonte**? Como
  combinam?
- O usuário edita preservação **por grupo** ou por **conjunto/preset** aplicado a
  vários grupos? (UX de escala — quem tem 50 grupos não quer configurar um a um.)
- Mantém um **default de conta** (ex-global) como template para novos destinos?
- Nomenclatura única "horário de funcionamento" aplicada também por-destino.

---

## 4. Ordem de execução sugerida

1. **PR 1 (urgente):** Item 1 (defer não trava a fila serial) — é o que conserta
   o congelamento de produção. TDD.
2. **PR 2:** Item 2 (override da fila no worker) + Item 4 (nomenclatura +
   migração) — remove a contradição.
3. **PR 3:** Item 3 (watchdog de `sending`).
4. **Projeto B:** sessão dedicada de design (resolver 3.6) → fases 1→3 da
   migração para config direcionada, cada fase em PR próprio via staging.

---

## 5. Notas do incidente (encerrado por config)

A fila da cliente foi destravada em produção via correção da config (janela
global de `{7,22}` invertida → `{22,8}`), restart do `api` e reabertura dos itens
presos (`OfferQueueItem` `sent`→`pending`). Isso é **curativo**; a causa
estrutural é o Plano A. Não reaproveitar o restart/reopen como solução — é a
manobra manual que estes planos existem para eliminar.
