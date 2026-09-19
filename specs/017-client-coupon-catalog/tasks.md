---

description: "Task list for feature 017-client-coupon-catalog"
---

# Tasks: Cupons de desconto da própria cliente

**Input**: Design documents from `/specs/017-client-coupon-catalog/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md — todos completos, nenhum reescrito aqui)

**Tests**: incluídos — a spec exige teste automatizado para a regra de escolha (FR-013), para o best-effort (FR-028b), para linguagem leiga (FR-026) e para as duas travas apontadas pela fase `plan` (preservação de `extractCouponLine` e convergência do token num único ponto de substituição).

**Organization**: tarefas agrupadas pelas 4 user stories do spec.md, na ordem de prioridade (US1 P1 → US2 P1 → US3 P2 → US4 P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: arquivos distintos, sem dependência entre si — paralelizável
- **[Story]**: US1/US2/US3/US4, conforme spec.md

## Convenção de caminhos

Projeto único: `src/`, `dashboard/`, `prisma/`, `test/` na raiz do repositório (`/home/user/wabot`).

---

## Phase 1: Setup

**Purpose**: preparar a branch de trabalho. Sem inicialização de projeto — é um monorepo existente, sem dependência nova (plan.md, Technical Context).

- [X] T001 Criar/confirmar a branch `017-client-coupon-catalog` a partir de `develop` (fluxo canônico do AGENTS.md) e `git status` limpo antes de começar a editar `prisma/schema.prisma`, `src/`, `dashboard/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema de banco e helper compartilhado que TODAS as user stories (US1 cadastro, US3 automação) precisam para existir.

**⚠️ CRITICAL**: nenhuma user story pode começar antes desta fase.

- [X] T002 Adicionar o model `ClientCoupon` e o campo `useCoupons` em `OfferAutomation` a `prisma/schema.prisma`, exatamente como descrito em `data-model.md` (campos, tipos, índices `@@index([userId, enabled])` e `@@index([userId, platform])`, `onDelete: Cascade` em `userId`). Mudança **apenas aditiva** (FR-027/FR-028) — nada removido nem renomeado do schema existente.
- [X] T003 Criar a migration `prisma/migrations/20260919120000_client_coupon/migration.sql` com o SQL exato de `data-model.md` (`CREATE TABLE "ClientCoupon"` + os dois índices + `ALTER TABLE "OfferAutomation" ADD COLUMN "useCoupons" BOOLEAN NOT NULL DEFAULT false`). Depende de T002 (schema e SQL precisam bater campo a campo).
- [X] T004 Rodar `npx prisma generate`, aplicar a migration num banco de desenvolvimento (`npx prisma migrate dev` ou equivalente) e rodar `node --test test/migrations-no-duplicate-column.test.js` para confirmar que `OfferAutomation.useCoupons` não colide com nenhuma coluna já adicionada em outra migration (pegadinha #10 do AGENTS.md — duas PRs paralelas tocando a mesma tabela). Depende de T002, T003.
- [X] T005 [P] Extrair `reloadWorkerConfig(userId)` de dentro de `src/api/routes/groups.js` (função hoje declarada ali, linha ~134) para um módulo novo `src/api/workerConfigReload.js`, importando `reloadConfig` de `src/manager.js` (nunca de `sessionCore.js` — barreira `routes-must-use-manager`). Atualizar `groups.js` para importar do novo módulo, **sem mudar nenhum comportamento** (mesmo `await`, mesmo retorno `{ ok, error }`, mesmo comentário do RCA 2026-08-26 sobre o `await` obrigatório). Este helper será reusado por `src/api/routes/coupons.js` (US1) e não precisa ser reescrito por `src/api/routes/offerAutomation.js` (US3, que só passa a persistir um campo novo).
- [X] T006 [P] Adicionar teste de regressão garantindo que `reloadWorkerConfig` (agora em `src/api/workerConfigReload.js`) sempre usa `await` em `reloadConfig` e devolve `{ ok: boolean, error: string|null }` mesmo quando `reloadConfig` lança — estender `test/groups-route-targets-mode.test.js` ou criar `test/api-worker-config-reload.test.js`. Depende de T005.

**Checkpoint**: schema pronto, helper de reload extraído e testado — as quatro user stories podem começar.

---

## Phase 3: User Story 1 - Cadastrar e manter os cupons da loja (Priority: P1) 🎯 MVP

**Goal**: tela nova no painel para cadastrar, editar, ligar/desligar e apagar cupons próprios, escopados por cliente.

**Independent Test**: cadastrar três cupons de lojas diferentes, desligar um, apagar outro e recarregar a tela — a lista reflete exatamente o que foi feito; o cupom com validade vencida aparece marcado como vencido.

### Tests for User Story 1

- [X] T007 [P] [US1] Criar `test/coupons-route.test.js` (padrão Fastify `inject` de `test/groups-route-targets-mode.test.js`) cobrindo: `GET /api/coupons` lista do mais novo para o mais antigo com `expired` calculado na resposta (nunca gravado); `POST` recusa sem `code`/`platform`/`discountType`/`discountValue`, com `percent` fora de 1–100 e `amount` ≤ 0, sempre com mensagem em português simples (tabela de `data-model.md`); código repetido devolve `201` com `{ duplicateWarning: true }`, nunca `409`; `PUT /:id` aceita todos os campos opcionais e `404` para cupom de outra cliente; `PATCH /:id/enabled` alterna `enabled` e chama o reload; `DELETE /:id` é idempotente (`{ deleted:false }` quando já não existe); toda rota é escopada por `req.user.sub` — cliente A nunca lista/edita/apaga cupom de cliente B (FR-007).
- [X] T008 [P] [US1] Criar `test/painel-cupons-linguagem.test.js`, no padrão de `test/painel-linguagem-leiga.test.js` (varredura de `readFileSync` sobre o código-fonte da tela nova), garantindo que nenhum jargão técnico (`platform`, `discountType`, `enabled`, `validUntil`, `token`, `id do cupom`, etc.) aparece em rótulo, dica, mensagem de recusa ou aviso da tela de cupons (FR-026).

### Implementation for User Story 1

- [X] T009 [US1] Criar `src/api/routes/coupons.js` com `GET`, `POST`, `PUT /:id`, `PATCH /:id/enabled`, `DELETE /:id`, exatamente conforme `contracts/coupons-api.md`: todas as rotas com `onRequest: [app.authenticate]` e operando só sobre `req.user.sub`; `expired` calculado na resposta via a mesma regra que decide validade (nunca persistido — reaproveita a comparação de `validUntil` com `now` que também vive em `src/core/clientCouponPolicy.js`, ver US2); mensagens de recusa em português simples; toda escrita chama `await reloadWorkerConfig(userId)` (de T005) e loga `couponReloaded`/`couponReloadError`, sem reprovar a requisição em caso de falha do reload. Depende de T004 (schema/migration aplicados), T005.
- [X] T010 [US1] Registrar `couponsRoutes` em `src/api/server.js` com `app.register(couponsRoutes, { prefix: '/api/coupons' })`, junto da lista de `app.register` existente (linhas ~508–528). Depende de T009.
- [X] T011 [US1] Criar `dashboard/app/painel/cupons/page.js`: formulário (código, loja — dropdown com as 6 lojas do FR-003, tipo de desconto, valor, nome interno opcional, validade opcional) e lista com toggle ligado/desligado, editar, apagar e selo "vencido" quando aplicável. Linguagem 100% leiga (consumida pelo teste de T008). Depende de T009, T010.
- [X] T012 [P] [US1] Adicionar item "Cupons" em `dashboard/app/painel/nav.js`, perto de "Ofertas automáticas" e "Filas" (D7 da pesquisa).
- [X] T013 [US1] Conectar as mensagens de recusa da API (T009, FR-006) e o aviso de duplicidade (`duplicateWarning`) à tela de T011, de forma que a cliente sempre veja a frase em português simples, nunca o nome do campo técnico. Depende de T011.

**Checkpoint**: US1 completa e testável de forma independente — cadastro funcionando de ponta a ponta, sem nenhum efeito ainda sobre o texto das ofertas.

---

## Phase 4: User Story 2 - A oferta sai com o melhor cupom, sozinha (Priority: P1)

**Goal**: variável `{cupom}` nos templates; regra pura escolhe o cupom de maior economia e calcula o preço com desconto; os três caminhos de envio resolvem o token no momento do envio.

**Independent Test**: com dois cupons ativos da mesma loja (10% e R$ 20) e uma oferta de R$ 300, a mensagem publicada traz o de 10% (R$ 30 de economia); na mesma oferta a R$ 100, traz o de R$ 20.

### Tests for User Story 2

- [X] T014 [P] [US2] Criar `test/client-coupon-policy.test.js` cobrindo TODOS os casos obrigatórios listados em `contracts/coupon-policy.md`: comparação percentual × fixo nos dois sentidos (R$ 300 e R$ 100); empate resolvido pelo `createdAt` mais recente; cupom vencido ignorado; cupom desligado ignorado; loja diferente ignorada; loja desconhecida → `null`; preço ausente cai na ordem fixa (maior `percent` → maior `amount` → mais recente); teto do valor em reais (FR-009); `finalPriceCents` nulo quando o desconto é ≥ preço (FR-018c); arredondamento de centavo (ex.: 33% de R$ 19,99); `formatBrl` com duas casas e vírgula decimal; token `{cupom}` repetido substituído em todas as posições; token sem cupom aplicável não deixa linha vazia/emoji solto/asterisco órfão; entrada malformada (`coupons` que não é array, cupom sem `discountType`, valor não numérico) nunca lança, só devolve `null`/ignora o item. **Guarda estrutural do módulo** (mesmo espírito de `test/bot-worker-retry-cache-wiring.test.js`, por leitura de source): `src/core/clientCouponPolicy.js` não contém `import` de `db`/Prisma/`fetch`/Redis/Baileys nem de qualquer caminho `dashboard/`; nenhuma função exportada é `async`; o texto-fonte não chama `Date.now()` (o instante entra só por parâmetro `now`) — sem isso o caso "cupom que vence entre o cadastro e o envio" não é determinístico.
- [X] T015 [P] [US2] Estender `test/mirror-template.test.js`: `applyMirrorTemplate` passa a **preservar** `{cupom}` intacto no texto/legenda final (não substitui mais nada ali) e devolve, junto do resultado, `couponContext: { platform, priceCents }` — `platform` vindo do conversor já resolvido e `priceCents` do preço já raspado para `{preço}`, **sem** nenhuma chamada de rede/scrape extra (o teste deve falhar se o orçamento `MIRROR_TEMPLATE_SCRAPE_BUDGET_MS` for tocado por causa do cupom).

### Implementation for User Story 2

- [X] T016 [P] [US2] Criar `src/core/clientCouponPolicy.js` implementando `chooseCoupon({ coupons, platform, priceCents, now })`, `renderCouponText({ coupon, priceCents, finalPriceCents })`, `applyCouponToken(text, couponText)`, `parseOfferPriceToCents(text)` e `formatBrl(cents)`, exatamente conforme `contracts/coupon-policy.md` (inclusive a obrigatoriedade da expressão **"com o cupom"** em `renderCouponText` sempre que há preço com desconto — FR-018e). Faz T014 passar.
- [X] T017 [P] [US2] **Trava #1 (achado D5 do plano) — remover a VARIÁVEL, preservar a FUNÇÃO**: em `src/core/mirrorTemplate.js`, parar de alimentar `couponLine`/`{linhaDeCupom}` a partir de `applyMirrorTemplate`, mas **NÃO apagar** `extractCouponLine` — ela continua existindo como helper interno, chamada por `extractTextPrice` (que alimenta `{preçoDoTexto}`, FR-021). Alterar `applyMirrorTemplate` para preservar `{cupom}` intacto no corpo do texto e devolver `couponContext: { platform, priceCents }` calculado a partir de dados já resolvidos nesta mesma função (sem leitura nova de rede/loja — FR-028c). Faz T015 passar.
- [X] T018 [P] [US2] Adicionar `{ token: '{cupom}', label: 'Cupom de desconto', example: '🎟️ Use o cupom BEMVINDO10 — de R$ 300,00 por R$ 270,00 com o cupom' }` a `OFFER_TEMPLATE_VARIABLE_GROUPS` em `dashboard/lib/mobileOfferComposer.js` (FR-015/FR-016), coerente com `{produto}`/`{preço}`/`{loja}` já existentes.
- [X] T019 [US2] Em `src/bot-worker.js`: (a) `loadConfig()` passa a trazer os cupons ligados da cliente (`db.clientCoupon.findMany({ where: { userId, enabled: true } })`) dentro do objeto de config já retornado — uma consulta a mais por carga de config, **zero** consulta por envio (FR-028a); (b) o job enfileirado no caminho `converted` (espelhamento) carrega `couponContext` (só `platform`/`priceCents`, escalares — nunca função nem Buffer, mesma restrição do `payloadRecipe` documentada no AGENTS.md); (c) em `processSendJob`, logo **depois** de resolver `payload` e **antes** de `sendPreparedPayload`, chamar `chooseCoupon`/`renderCouponText`/`applyCouponToken` (de T016) com os cupons vindos de `getConfig()` e substituir `{cupom}` no texto/legenda do payload — tudo dentro de um `try/catch` que **nunca** deixa a exceção escapar (FR-028b: qualquer falha ao obter/escolher/formatar o cupom = oferta publicada sem cupom, e a fila segue). Depende de T016, T017.
- [X] T020 [US2] No ramo `broadcast` do worker (fila de ofertas, `~src/bot-worker.js:4998`), montar `couponContext` a partir do próprio `msg.text` antes do `enqueueSendJob` — loja identificada pelo link do texto (mesmo detector já usado pelo composer), preço tratado como desconhecido (cai na ordem fixa do FR-011 dentro de `chooseCoupon`). A substituição em si acontece no MESMO ponto de `processSendJob` implementado em T019 — nenhum caminho novo de substituição. Depende de T019.
- [X] T021 [P] [US2] Criar `test/client-coupon-envio.test.js` cobrindo: (a) momento do envio — cupom desligado **depois** de o job ser enfileirado mas **antes** do envio efetivo não sai na mensagem (FR-014), com `CONFIG_CACHE_TTL_MS` expirando o cache sozinho quando a invalidação ativa falhar; (b) best-effort absoluto — forçar `chooseCoupon`/`renderCouponText`/`applyCouponToken` a lançar e confirmar que o envio **não é perdido** e a mensagem sai sem cupom (SC-010/FR-028b); (c) zero consulta ao banco atribuível ao cupom dentro de `processSendJob` (SC-009) — só a consulta já existente em `getConfig()`.
- [X] T022 [P] [US2] Estender `test/mobile-offer-composer.test.js`: `{cupom}` aparece na lista de variáveis disponíveis com rótulo e exemplo em português (FR-016); mensagem sem cupom aplicável não deixa linha vazia, espaço duplo, emoji solto, asterisco ou pontuação órfã (FR-017/SC-003), mesmo cuidado já aplicado às demais variáveis não resolvidas.

**Checkpoint**: US2 completa e testável de forma independente — espelhamento e fila de ofertas já resolvem o cupom no momento do envio, mesmo sem a automação (US3) e mesmo com `{linhaDeCupom}` ainda presente em templates antigos (US4 cuida disso).

---

## Phase 5: User Story 3 - Ligar o cupom nas ofertas automáticas (Priority: P2)

**Goal**: opt-in explícito por automação (`useCoupons`), sem mudar o comportamento de automações já existentes.

**Independent Test**: duas automações idênticas, opção marcada em uma só — só as ofertas da automação marcada saem com cupom.

### Tests for User Story 3

- [X] T023 [P] [US3] Estender `test/offer-automation.test.js`: automação criada antes da entrega (`useCoupons` ausente → default `false` do banco) continua enviando exatamente o mesmo texto de antes, sem cupom (SC-005); automação com `useCoupons: true` e cupom ativo da loja da oferta → texto sai com cupom; automação marcada mas sem cupom ativo daquela loja → sai normal, sem sobra de formatação; falha ao carregar os cupons no início da execução **não aborta** o laço de `toSend` (reaproveita o padrão de try/catch por item já existente no arquivo, RCA "Fila entupida...").

### Implementation for User Story 3

- [X] T024 [US3] Em `src/offerAutomation/dispatcher.js`, `runAutomation` passa a carregar os cupons ligados da cliente **uma única vez por execução**, antes do laço `for (const offer of toSend)`, e **somente quando `automation.useCoupons === true`** (FR-028d — nunca uma consulta por oferta do lote). Dentro do laço, para cada oferta, chamar `chooseCoupon`/`renderCouponText`/`applyCouponToken` (de T016) usando o preço numérico já resolvido (`offer.priceMin`/`offer.price`) e aplicar ao texto antes de `sendBroadcastFn`. Falha ao carregar os cupons → lista vazia → ofertas saem sem cupom, laço intacto. Depende de T016 (Phase 4), T004 (coluna `useCoupons` existe).
- [X] T025 [P] [US3] Em `src/api/routes/offerAutomation.js`, aceitar o campo booleano `useCoupons` no `POST` (ausente = `false`) e no `PUT` (ausente = **não muda** o valor atual), conforme `contracts/coupons-api.md`. Nenhum outro campo ou formato de resposta muda.
- [X] T026 [US3] Em `dashboard/app/painel/ofertas-automaticas/`, adicionar a caixa de seleção "Usar meus cupons cadastrados nesta automação", desmarcada por padrão, ligada ao campo `useCoupons` de T025. Depende de T025.

**Checkpoint**: US3 completa — automações antigas seguem idênticas; a opção nova é aditiva e explícita.

---

## Phase 6: User Story 4 - Sair do `{linhaDeCupom}` sem quebrar template salvo (Priority: P2)

**Goal**: `{linhaDeCupom}` some da lista de variáveis, da tela e da mensagem publicada, sem quebrar nenhum template já salvo e sem afetar `{preçoDoTexto}`.

**Independent Test**: pegar um template salvo contendo `{linhaDeCupom}`, aplicar a atualização, abrir a tela de templates e publicar uma oferta com ele — nem a tela nem a mensagem podem conter `{linhaDeCupom}` ou uma lacuna estranha; `{preçoDoTexto}` continua funcionando.

### Tests for User Story 4

- [X] T027 [P] [US4] **Trava #1, parte de verificação** — estender `test/mirror-template.test.js` (ou `test/client-coupon-policy.test.js`, o que fizer mais sentido junto do código alterado em T017) com um teste que: (a) roda `extractTextPrice` sobre um texto real com bloco "De R$ X / Por R$ Y" seguido de uma linha de cupom escrita pelo grupo de origem, no MESMO formato de antes da mudança, e confirma que o preço editorial continua sendo capturado corretamente; (b) explicitamente **falha** se `extractCouponLine` deixar de existir/ser exportada, ou se a captura de `{preçoDoTexto}` degradar quando a variável/linha de cupom for removida do fluxo de composição (a remoção em T017/T030 é da VARIÁVEL, nunca da FUNÇÃO).
- [X] T028 [P] [US4] Adicionar caso em `test/template-variable-migration.test.js` (mesmo arquivo que já testa `canonicalizeTemplateBody`/`canonicalizeTemplateStoreJson` para os aliases `{{greeting}}`/`{{trailer}}`) provando que um `body`/`store` salvo contendo `{linhaDeCupom}` sai limpo (variável e linha órfã removidas, sem lacuna) depois de `canonicalizeTemplateBody`/`canonicalizeTemplateStoreJson` — cobrindo as duas superfícies que consomem essa função (tela de templates e worker).

### Implementation for User Story 4

- [X] T029 [US4] Em `src/core/templateVariables.js`, `canonicalizeTemplateBody` passa a remover `{linhaDeCupom}` de templates salvos (a linha inteira, quando ela ocupa a linha sozinha, sem deixar lacuna), reaproveitando `canonicalizeTemplateStore`/`composeTemplates` — que já servem a tela de templates **e** o worker a partir de um único ponto (D5 da pesquisa: um lugar resolve as duas superfícies do FR-020, sem reescrever nada no banco). Faz T028 passar. Depende de T004 (nenhuma dependência de schema real, mas mantém a ordem lógica pós-Foundational).
- [ ] T030 [US4] Em `dashboard/lib/mobileOfferComposer.js`: remover `{linhaDeCupom}` de `OFFER_TEMPLATE_VARIABLE_GROUPS` (FR-019); em `applyTemplateVariables`, remover o parâmetro `couponLine` da assinatura, remover a linha do token **sempre** (não apenas quando vazio, como hoje) e substituir `{linhaDeCupom}` por `''` incondicionalmente.
- [ ] T031 [P] [US4] Confirmar que `UNRESOLVED_OFFER_PLACEHOLDER_RE` em `src/core/mirrorTemplate.js` continua varrendo `linhaDeCupom` como placeholder não resolvido (cinto e suspensório para quem digitar `{linhaDeCupom}` à mão num template novo, cenário 4 do US4) — ajustar a regex só se algo em T017/T030 tiver quebrado essa cobertura, sem remover a entrada da lista.

**Checkpoint**: US4 completa — `{linhaDeCupom}` sai do produto por inteiro, sem quebrar nenhum template salvo nem `{preçoDoTexto}`.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: a guarda estrutural da invariante central do plano (token nunca chega ao WhatsApp, três caminhos convergem no mesmo ponto) e a validação final de qualidade/memória — depende de US2 e US3 estarem implementadas (é o que ela verifica).

- [ ] T032 **Trava #2 (invariante central do plano) — guarda estrutural de convergência do token**. Criar `test/coupon-token-single-substitution-wiring.test.js`, no mesmo espírito de `test/bot-worker-retry-cache-wiring.test.js` (lê `src/bot-worker.js` e `src/offerAutomation/dispatcher.js` via `readFileSync`, sem importar — os dois rodam como processo/módulo próprios e não expõem a lógica interna para import direto). O teste falha se qualquer uma destas invariantes quebrar:
  - os três caminhos de envio (o trecho `converted`/mirror dentro de `processSendJob`, o trecho `broadcast`/fila de ofertas dentro de `processSendJob`, e o laço de `runAutomation` no dispatcher) chamam a **mesma** função `applyCouponToken` importada de `src/core/clientCouponPolicy.js` — nenhum caminho reimplementa substituição de token por conta própria;
  - dentro de `processSendJob`, o índice de texto da chamada de substituição do token é **menor** que o índice de `sendPreparedPayload({ sock: sockForAttempt` (a substituição acontece ANTES do envio, nunca depois);
  - **nenhuma** chamada a `applyCouponToken`/`renderCouponText` aparece no source **antes** de `enqueueSendJob(` — ou seja, nenhum job é enfileirado já com o token `{cupom}` substituído; o token viaja intacto até o dequeue.
  Depende de T019, T020 (US2) e T024 (US3) estarem implementados — é o que este teste valida.
- [ ] T033 [P] Rodar a suíte local completa de `specs/017-client-coupon-catalog/quickstart.md` §1 (todos os `node --test` listados + `npm test` + `npm run arch:check`) e confirmar tudo verde, incluindo que `src/core/clientCouponPolicy.js` **não** entra na allowlist de exceções `no-src-to-dashboard` do `.dependency-cruiser.cjs` (a regra nova não pode importar `dashboard/`).
- [ ] T034 [P] Confirmar a nota de verificação da spec: `buildMirrorDedupKeys` (`src/core/mirrorDedupKey.js`) continua calculando a chave de repetição sobre links/texto **sem** o cupom aplicado — adicionar ou localizar a asserção equivalente nos testes de dedup existentes (`test/mirror-dedup-key*.test.js` ou correlato) e falhar se a chave passar a depender do texto pós-substituição.
- [ ] T035 [P] Confirmar, por inspeção do diff final, que nenhum processo PM2 novo, `setInterval` novo ou dependência de `package.json` foi introduzido (FR-027/SC-008) — registrar a conclusão junto da checklist "Antes de promover para produção" de `specs/017-client-coupon-catalog/quickstart.md` §3.
- [ ] T036 Executar manualmente, em staging (`http://178.105.54.0:3006`), os cenários 1 a 8 de `specs/017-client-coupon-catalog/quickstart.md` §2 (cadastro, melhor cupom, sem cupom aplicável, momento do envio, automação, rede de segurança do TTL, saída do `{linhaDeCupom}`, fila não trava) **antes** de abrir a PR `develop → main` — inclui a nota de operação obrigatória (reinício do `bot-supervisor` para o espelhamento/fila pegarem o código novo em modo `remote`, anunciado antes).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — BLOQUEIA todas as user stories.
- **US1 (Phase 3, P1)**: depende só do Foundational.
- **US2 (Phase 4, P1)**: depende só do Foundational. Não depende de US1 em código (a regra pura e o wiring de envio funcionam mesmo com zero cupom cadastrado — a lista vem vazia e `chooseCoupon` devolve `null`), mas só é **observável de ponta a ponta** com US1 pronta (precisa de onde cadastrar o cupom para testar).
- **US3 (Phase 5, P2)**: depende do Foundational (coluna `useCoupons`) e da regra pura de US2 (T016). Independente de US1 em código.
- **US4 (Phase 6, P2)**: depende só do Foundational; independente de US1/US2/US3 em código (mexe em `mirrorTemplate.js`/`templateVariables.js`/`mobileOfferComposer.js`, arquivos que US2 também toca — ver nota abaixo).
- **Polish (Phase 7)**: depende de US2 (T019/T020) e US3 (T024) — é o que a guarda estrutural (T032) verifica.

⚠️ **Nota de conflito de arquivo (não de dependência lógica)**: US2 (T017, T018) e US4 (T030, T031) editam os mesmos arquivos (`src/core/mirrorTemplate.js`, `dashboard/lib/mobileOfferComposer.js`). Fazer as duas stories em paralelo por pessoas diferentes exige coordenar quem mexe em cada arquivo primeiro — sequencialmente (US2 antes de US4, como estão numeradas) evita retrabalho de merge.

### User Story Dependencies

- **US1 (P1)**: nenhuma dependência de outra story.
- **US2 (P1)**: nenhuma dependência de código de outra story; testabilidade fim-a-fim se beneficia de US1 existir.
- **US3 (P2)**: depende da regra pura de US2 (`src/core/clientCouponPolicy.js`, T016).
- **US4 (P2)**: nenhuma dependência de código de outra story, mas toca os mesmos arquivos de US2 (ver nota de conflito acima).

### Parallel Opportunities

- Dentro do Foundational: T005/T006 em paralelo com T002/T003/T004 (arquivos distintos, sem dependência).
- Dentro de US1: T007 e T008 em paralelo (arquivos de teste distintos); T012 em paralelo com T011/T013.
- Dentro de US2: T014 e T015 em paralelo; T016, T017 e T018 em paralelo entre si (arquivos distintos, sem import cruzado); T021 e T022 em paralelo.
- Dentro de US3: T023 sozinho; T025 em paralelo com T024 (rota vs. dispatcher, sem dependência mútua).
- Dentro de US4: T027 e T028 em paralelo; T031 em paralelo com T029/T030 (é só uma confirmação/ajuste pontual de regex).
- **Depois do Foundational**, US1, US2 e US4 podem começar em paralelo por pessoas diferentes (respeitando a nota de conflito de arquivo entre US2 e US4); US3 só depois de T016 (US2) existir.

---

## Parallel Example: Foundational + User Story 2

```bash
# Foundational, em paralelo:
Task: "Adicionar ClientCoupon + useCoupons a prisma/schema.prisma (T002)"
Task: "Extrair reloadWorkerConfig para src/api/workerConfigReload.js (T005)"

# User Story 2, testes em paralelo:
Task: "Criar test/client-coupon-policy.test.js com todos os casos + guarda estrutural do módulo (T014)"
Task: "Estender test/mirror-template.test.js para {cupom} preservado + couponContext (T015)"

# User Story 2, implementação em paralelo (arquivos distintos):
Task: "Criar src/core/clientCouponPolicy.js (T016)"
Task: "Alterar src/core/mirrorTemplate.js: remove variável, preserva extractCouponLine (T017)"
Task: "Adicionar {cupom} a OFFER_TEMPLATE_VARIABLE_GROUPS em dashboard/lib/mobileOfferComposer.js (T018)"
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Completar Phase 1 (Setup) e Phase 2 (Foundational).
2. Completar Phase 3 (US1) — tela de cupons funcionando, sem nenhum efeito ainda sobre ofertas.
3. **PARAR e VALIDAR**: cadastrar/editar/ligar/desligar/apagar cupons; conferir vencimento na tela.
4. Se aceitável como entrega isolada, seguir para US2 (o motor de fato).

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 → cadastro funcionando → validar isoladamente (não publica nada ainda).
3. US2 → `{cupom}` funcionando no espelhamento e na fila de ofertas → validar com staging (cenários 2–4 e 6–8 do quickstart).
4. US3 → opt-in nas automações → validar (cenário 5 do quickstart).
5. US4 → `{linhaDeCupom}` sai do produto sem quebrar nada salvo → validar (cenário 7 do quickstart).
6. Polish (Phase 7) → guarda estrutural de convergência do token + checklist de produção (quickstart §3) → PR `develop → main`.

### Notas operacionais obrigatórias (repetidas do spec/plan, não esquecer ao entregar)

- Em modo `remote`, o deploy da API **não** recarrega os bot-workers: a tela de cupons (US1) e a opção da automação (US3) valem assim que a API sobe, mas o efeito no **espelhamento** e na **fila de ofertas** (US2) só passa a valer depois de `pm2 restart bot-supervisor --update-env` — decisão humana, anunciada antes, nunca às cegas.
- Nenhuma task desta lista introduz processo PM2 novo, `setInterval` novo ou dependência nova — confirmado explicitamente em T035.

---

## Notes

- [P] = arquivos diferentes, sem dependência.
- [Story] mapeia a task à user story correspondente para rastreabilidade.
- As duas travas exigidas pela fase `plan` estão marcadas explicitamente: **Trava #1** (T017, T027, T029/T030 — remove a variável `{linhaDeCupom}`, preserva `extractCouponLine`) e **Trava #2** (T032 — guarda estrutural: o token nunca chega ao WhatsApp, os três caminhos convergem no mesmo `applyCouponToken`).
- Commitar depois de cada task ou grupo lógico.
- Parar em qualquer checkpoint para validar a story isoladamente antes de seguir.
