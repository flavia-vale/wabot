# Phase 0 — Pesquisa e decisões

**Feature**: 017-client-coupon-catalog | **Data**: 2026-09-19

Todas as decisões abaixo vieram de leitura do código atual (arquivo e linha
citados), não de suposição. Nenhum `NEEDS CLARIFICATION` restou.

---

## D1 — FR-028a (cache, zero consulta por envio) × FR-014 (vale o momento do envio)

**O conflito real.** FR-028a proíbe consulta ao banco por envio; FR-014 exige que
a validade e o ligado/desligado sejam os do momento do envio. Em produção no modo
`remote` isso piora: a tela de cupons roda no processo da **API** e o envio roda
dentro do **bot-worker** — processos diferentes, memórias diferentes. Salvar um
cupom no painel não alcança o worker por si só.

**Decisão: reaproveitar o cache de configuração que o worker já tem
(`getConfig`/`loadConfig`, `src/bot-worker.js:838` e `:780`), e o comando
`reloadConfig` que já existe, em vez de inventar cache ou canal novo.**

Três camadas, nessa ordem:

1. **Carga**: `loadConfig()` passa a trazer `coupons` (uma consulta
   `clientCoupon.findMany({ where: { userId, enabled: true } })`, junto das que
   já faz para credenciais/grupos/botConfig). Custo: uma consulta por carga de
   config, não por envio. **Zero consulta ao banco no caminho de envio** —
   `processSendJob` já chama `await getConfig()` hoje (`src/bot-worker.js:2308`
   e `:2382`), então ler os cupons dali não acrescenta nem uma consulta.
2. **Invalidação ativa**: toda rota de cupom (criar, editar, ligar, desligar,
   apagar) chama `reloadWorkerConfig(userId)` **com `await`**, exatamente como
   `src/api/routes/groups.js:119` faz hoje. No modo `remote` isso vira comando
   BullMQ → supervisor → IPC `reloadConfig` → worker zera `configCache`
   (`src/bot-worker.js:4835`). O `await` é obrigatório: sem ele a Promise vai
   crua para o logger e vira `configReloaded: {}` — o RCA 2026-08-26 do
   `AGENTS.md` é exatamente sobre isso.
3. **Rede de segurança quando a notificação se perde**: `CONFIG_CACHE_TTL_MS`
   (`src/bot-worker.js:661`, default **60s**) já expira o cache sozinho. Se o
   Redis piscar, o supervisor estiver fora do ar ou o comando se perder, o
   cupom desligado para de sair **em no máximo 60 segundos**, sem ninguém fazer
   nada. Não há caminho em que um cupom desligado fique valendo para sempre.

**A validade NÃO depende do cache.** O cache guarda `validUntil` cru; quem
compara com o relógio é a regra pura, **a cada envio**. Cupom que vence entre o
carregamento e o envio deixa de sair no mesmo instante em que vence, mesmo com
cache quente. Só o **ligado/desligado** tem a janela de até 60s — e é aceitável
porque a única consequência é um cupom a mais saindo por um minuto, nunca um
preço errado (o preço final é calculado a partir do cupom que de fato saiu).

**Alternativas recusadas:**

| Alternativa | Por que não |
|---|---|
| Consultar o banco em `processSendJob` | Viola FR-028a/SC-009. A fila de envio é serial (`concurrency: 1`) — é o ponto exato do RCA "Fila entupida por UM destino derrubando a vazão de todos". |
| Cache próprio de cupons no worker, com TTL próprio | Duplica um mecanismo que já existe e cria um segundo caminho de invalidação para manter. Nada que o cupom precise falta em `getConfig`. |
| Canal pub/sub novo (Redis) só para cupom | Processo/infra a mais para um dado que já viaja no comando existente. Contraria a política de memória do `AGENTS.md`. |
| Bumpar `PROTOCOL_VERSION` do supervisor | Desnecessário: `RELOAD_CONFIG` já existe e é aditivo. Bump exigiria deploy casado de API e supervisor. |

⚠️ **Consequência operacional obrigatória na entrega** (já antecipada pela spec):
em modo `remote` o deploy da API **não** recarrega os bot-workers. Até alguém
reiniciar o `bot-supervisor`, o cadastro funciona e o espelhamento/fila **ainda
sai sem cupom**. Isso é o esperado, não defeito.

---

## D2 — Onde mora a regra pura (FR-013, FR-018g)

**Decisão: `src/core/clientCouponPolicy.js`**, puro, com teste próprio em
`test/client-coupon-policy.test.js` (`node:test`).

Motivo: `src/core/` é onde moram as políticas puras consumidas **pelo worker**
(`imageModePolicy.js`, `queueExpiry.js`, `destinationRouting.js`,
`previewImageFallbackPolicy.js`). `src/domain/` é a camada de negócio consumida
pela API. Esta regra é consumida pelos **dois lados** (worker e dispatcher da
automação), e o lado crítico é o worker — então `core`.

**Nome**: `clientCouponPolicy.js`, não `couponPolicy.js` — já existe
`src/converters/couponPolicy.js`, que é outra coisa (a flag
`COUPON_LINK_CONVERT`). Dois arquivos com o mesmo nome em pastas diferentes é
convite a import errado.

**Barreira de arquitetura**: `.dependency-cruiser.cjs` proíbe `src/**` importar
`dashboard/lib/**` (só `mirrorTemplate.js` e `offerAutomation/dispatcher.js`
estão isentos, como dívida de baseline). A regra nova **não pode** importar
nada de `dashboard/` — e não precisa: ela recebe números e devolve texto.

**Superfície**:

- `chooseCoupon({ coupons, platform, priceCents, now })` →
  `{ coupon, savingsCents, finalPriceCents } | null`
- `renderCouponText({ coupon, priceCents, finalPriceCents })` → string
- `applyCouponToken(text, couponText)` → substitui/limpa o token
- `parseOfferPriceToCents(text)` → centavos ou `null`
- `formatBrl(cents)` → `"R$ 300,00"`

**Sobre `parseOfferPriceToCents`**: existe `parsePriceToCents` em
`src/domain/painel/pricePerOffer.js`, mas ela lê **o nosso próprio preço de
plano** já formatado por nós. Aqui o texto vem de **scrape de loja**, com modos
de falha diferentes (texto vazio, "a partir de", faixa de preço). Fazer `core`
importar `domain` para economizar seis linhas acoplaria as duas camadas pelo
motivo errado. Duplicação aceita e registrada, cada uma com teste próprio.

---

## D3 — Onde o cupom é resolvido nos três caminhos

A regra que organiza tudo: **o token de cupom sobrevive à montagem do texto e é
substituído no último momento possível**. É isso que faz FR-014 valer para item
que fica horas esperando na fila (`deferSendJob`).

### Invariante única (vale para os três caminhos)

> O token de cupom **nunca** chega ao WhatsApp. Ou vira texto de cupom, ou é
> apagado sem deixar linha vazia, emoji solto ou asterisco órfão. Os três
> caminhos terminam no mesmo `applyCouponToken`.

### (a) Espelhamento de grupos monitorados

- `applyMirrorTemplate` (`src/core/mirrorTemplate.js:187`) roda na **chegada** da
  mensagem (`src/bot-worker.js:3867`), não no envio. Ela passa a **preservar** o
  token (não substituir) e a devolver, junto, um `couponContext`
  `{ platform, priceCents }` — `platform` é o que o conversor já resolveu e
  `priceCents` sai do preço **já raspado** para `{preço}`. **Nenhuma leitura
  nova de rede ou de loja** (FR-028c): o orçamento de 6s
  (`MIRROR_TEMPLATE_SCRAPE_BUDGET_MS`) não é tocado.
- O job enfileirado carrega `couponContext` (campos escalares, serializáveis —
  não quebram o roteamento BullMQ/memória descrito no `AGENTS.md`).
- `processSendJob` (`src/bot-worker.js:2240`), logo depois de resolver o
  `payload` e **antes** de `sendPreparedPayload`, chama a regra pura com os
  cupons de `getConfig()` e substitui o token no texto/legenda.
- **Dedup preservada**: `buildMirrorDedupKeys` roda na chegada, sobre links e
  sobre o texto **sem** cupom. A nota de verificação da spec fica mais forte,
  não mais fraca — o texto com cupom só existe depois da chave.

### (b) Fila de ofertas

- `OfferQueueItem.text` é gravado já composto. Se o template da cliente tinha o
  token, ele viaja no texto até `sendBroadcast`
  (`src/offerQueue/dispatcher.js:132`) e daí ao ramo `broadcast` do worker
  (`src/bot-worker.js:~4998`, `payload: { text: msg.text }`).
- O ramo `broadcast` monta o `couponContext` a partir do próprio texto: loja pelo
  link (mesmo detector que o composer já usa), **preço desconhecido** — cai na
  ordem fixa e previsível do FR-011. Substituição acontece no mesmo ponto de
  `processSendJob`.
- FR-025 respeitado: o painel "Criar oferta" não ganha seletor nem
  pré-visualização de cupom. A presença do token no texto **é** o sinal de
  FR-024 ("usando template e o template contém a variável").

### (c) Ofertas automáticas

- Resolvido **no dispatcher** (`src/offerAutomation/dispatcher.js`), não no
  worker: é lá que o preço numérico da oferta existe de verdade
  (`offer.priceMin`/`offer.price`), o envio é imediato, e o FR-028d ("uma
  leitura por lote") pede carga única por execução.
- `runAutomation` carrega os cupons **uma vez**, antes do laço de `toSend`, e só
  quando `automation.useCoupons === true`. O laço só chama a regra pura.
- Falha na carga → lista vazia → ofertas saem sem cupom, laço intacto (FR-028b;
  é o mesmo RCA do try/catch por item que já vive nesse arquivo).

---

## D4 — Tabela nova e migration aditiva (FR-027, FR-028)

**Decisão**: modelo `ClientCoupon` + uma coluna nova em `OfferAutomation`
(`useCoupons`), numa migration só, `20260919120000_client_coupon`.

- `CREATE TABLE "ClientCoupon"` — tabela nova e vazia, nada existente muda.
- `ALTER TABLE "OfferAutomation" ADD COLUMN "useCoupons" BOOLEAN NOT NULL DEFAULT false`
  — **o `DEFAULT false` é o que garante FR-023/SC-005**: automação que já existe
  nasce desmarcada e continua enviando o mesmo texto de antes.
- Nada é removido nem renomeado (FR-028). `{linhaDeCupom}` sai do **código**, não
  do banco: nenhum template salvo é reescrito (a spec permite explicitamente).
- Guarda existente: `test/migrations-no-duplicate-column.test.js` reprova se
  `OfferAutomation.useCoupons` for adicionada duas vezes — risco real quando
  duas PRs paralelas tocam a mesma feature (pegadinha #10 do `AGENTS.md`).
- **DDL exige lock exclusivo do SQLite** (pegadinha #8): o deploy já para os
  apps PM2 que seguram Prisma antes do `migrate deploy`. Nada de especial a
  fazer, só não rodar a migration à mão com a API no ar.

---

## D5 — Saída do `{linhaDeCupom}` sem quebrar template salvo (FR-019 a FR-021)

**Achado que muda o plano**: `extractCouponLine`
(`src/core/mirrorTemplate.js:57`) **não é usada só pela variável** — ela também
é o **delimitador** de `extractTextPrice` (`:85`), que alimenta
`{preçoDoTexto}`. FR-021 exige que `{preçoDoTexto}` continue funcionando.

**Decisão: remove-se a VARIÁVEL, preserva-se a FUNÇÃO.**
`extractCouponLine` deixa de ser oferecida como variável e deixa de alimentar
`couponLine`, mas continua existindo como helper interno de `extractTextPrice`.
Apagá-la degradaria em silêncio a captura do "De/Por" editorial.

**Onde a limpeza acontece — um lugar só**: `canonicalizeTemplateBody`
(`src/core/templateVariables.js`) já existe exatamente para migrar variável
velha, e é chamada por `canonicalizeTemplateStore` → `normalizeStore` →
`composeTemplates` — ou seja, **pela tela de templates E pelo worker**, das duas
pontas. Acrescentar ali a remoção de `{linhaDeCupom}` (com a linha órfã junto)
resolve FR-020 nas duas superfícies de uma vez, sem tocar no banco: a tela nunca
mostra o texto cru, a mensagem nunca sai com ele, e quando a cliente salvar
qualquer edição o corpo já persiste limpo.

Camadas de defesa que ficam (cinto e suspensório, para o template digitado à
mão depois — US4 cenário 4):

- `UNRESOLVED_OFFER_PLACEHOLDER_RE` (`mirrorTemplate.js:16`) mantém
  `linhaDeCupom` na lista de placeholders varridos no fim.
- `applyTemplateVariables` (`dashboard/lib/mobileOfferComposer.js:146`) passa a
  remover a linha do token **sempre** (hoje só remove quando `couponLine` é
  vazio) e a substituir por `''` incondicionalmente — o parâmetro `couponLine`
  some da assinatura.

---

## D6 — A variável nova (FR-015 a FR-018, FR-018a a FR-018g)

**Token**: `{cupom}`. Coerente com `{produto}`, `{preço}`, `{loja}` — português,
minúsculo, sem camelCase (o `{linhaDeCupom}` que sai era a exceção).

**Rótulo e exemplo** em `OFFER_TEMPLATE_VARIABLE_GROUPS`
(`dashboard/lib/mobileOfferComposer.js:24`):
`{ token: '{cupom}', label: 'Cupom de desconto', example: '🎟️ Use o cupom BEMVINDO10 — de R$ 300,00 por R$ 270,00 com o cupom' }`

**Texto publicado** (decidido aqui para ter teste próprio):

| Situação | Sai |
|---|---|
| preço confiável, desconto cabe | `🎟️ Use o cupom BEMVINDO10 — de R$ 300,00 por R$ 270,00 com o cupom` |
| preço não lido (FR-018d) | `🎟️ Use o cupom BEMVINDO10 (10% de desconto)` |
| cupom em reais ≥ preço (FR-018c) | `🎟️ Use o cupom TOP50 (R$ 50,00 de desconto)` |
| nenhum cupom aplicável | nada, sem sobra de formatação (FR-017) |

**"com o cupom" é obrigatório e não pode ser editado para fora** (premissa de
risco de negócio da spec): é o que transforma promessa de preço em condição
declarada. Teste falha se a expressão sumir.

**Arredondamento** (FR-018f): tudo em **centavos inteiros** dentro da regra;
percentual usa `Math.round(priceCents * pct / 100)`; formatação final com
`toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`, o mesmo padrão
de `priceStr` em `src/offerAutomation/dispatcher.js:37`. Duas casas, vírgula
decimal.

---

## D7 — Rotas e tela

**Rotas**: `src/api/routes/coupons.js`, registrado em `src/api/server.js` com
prefixo `/api/coupons` (o arquivo já tem a lista de `app.register`, linhas
508-528). Contrato em `contracts/coupons-api.md`.

**Helper compartilhado**: `reloadWorkerConfig` está hoje **dentro** de
`groups.js:134`, com o comentário do RCA do `await`. Sobe para
`src/api/workerConfigReload.js` e é importada pelos dois arquivos — assim a
armadilha do `await` fica documentada num lugar só e a rota nova não pode
esquecê-la. `groups.js` passa a importar, sem mudança de comportamento.
A barreira `routes-must-use-manager` continua valendo: o helper importa
`reloadConfig` de `src/manager.js`, nunca de `sessionCore.js`.

**Tela**: `dashboard/app/painel/cupons/page.js`, item novo em
`dashboard/app/painel/nav.js` perto de "Ofertas automáticas" e "Filas".
Linguagem leiga obrigatória (FR-026), com teste no padrão de
`test/painel-linguagem-leiga.test.js`.

**Campo da automação**: caixa de seleção em
`dashboard/app/painel/ofertas-automaticas/`, rotulada
"Usar meus cupons cadastrados nesta automação", desmarcada por padrão.

---

## D8 — Custo de memória (FR-027, SC-008)

Nenhum processo PM2 novo, nenhum `setInterval` novo, nenhuma dependência nova.
O acréscimo é uma lista de dezenas de linhas por conta dentro do objeto de
config que o worker **já** mantém em memória — ordem de **poucos KB por robô**,
contra os ~329 MB medidos por robô em 2026-09-11. Abaixo do ruído de medição.
Registrado aqui de propósito para não colidir com a REGRA #1 da política de
memória do `AGENTS.md`.
