# Tasks: Arquitetura multicanal de entrega (WhatsApp, Telegram e Story do Instagram)

**Input**: Design documents from `/specs/017-multicanal-telegram-instagram/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/` (`delivery-network-adapter.md`, `delivery-outbox.md`, `telegram-surface.md`), `quickstart.md`

**Tests**: a spec e o plano exigem regressão automatizada explícita (FR-038) e o plano já lista 8 testes puros, 8 guardas estruturais, 1 ponta a ponta com rede fictícia e alguns testes com banco — cada um vira uma tarefa própria abaixo, escrita **antes** da implementação que ela cobre.

**Organization**: as tarefas seguem as **6 fatias** do `plan.md` (cada uma entregável isoladamente em produção), com o rótulo de história de usuário (`US1`–`US10`) marcado em cada tarefa não-estrutural. Uma mesma fatia pode conter tarefas de mais de uma história — é assim que o próprio plano organiza a entrega (ex.: a Fatia 3 fecha US2 e US4 ao mesmo tempo). **Todo código de worker desta feature está na Fase 2 (Foundational) e na Fase 3 (Fatia 1) — nenhuma fatia depois dela toca `src/core/` (fora de `src/core/delivery/`), `src/billing/`, `src/bot-worker.js` ou `prisma/schema.prisma`.**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: história de usuário (`US1`–`US10`); ausente em Setup, Foundational e na seção separada de convergência
- Cada tarefa cita o(s) caminho(s) de arquivo exatos

---

## ⚠️ Achado que precisa de confirmação antes de qualquer trabalho de fundação

O levantamento desta tarefa encontrou algo que `spec.md`/`plan.md` não sabiam quando foram fechados: **o Story do Instagram já tem entrega funcional mesclada em `main`** (`src/instagram/` — OAuth, `storyDeliveryService.js`, `publishing/processor.js`, `mirroring/capture.js`, `storage/storyAssetService.js` —, commits `40f6764`/`8254bf6`, PRs #1644/#1648, e componente `dashboard/components/InstagramStoriesPanel.js`), por um caminho **paralelo**, fora de qualquer contrato de adaptador de rede de entrega. A premissa da spec ("Instagram entra só como rede declarada, sem entrega funcional nesta rodada") **não reflete mais o estado do repositório**. Isso não é motivo para redecidir sozinho o escopo aqui — é motivo para a dona do produto decidir, com o dado em mãos, antes que a Fundação comece a desenhar `CAPABILITIES.instagram`/`available:false` em cima de uma suposição que já não é verdadeira.

- [ ] T001 Confirmar com a dona do produto o realinhamento entre esta feature e a implementação já mesclada de Instagram Stories: (a) o Instagram continua "declarado e indisponível" nesta rodada apesar de já existir entrega funcional por fora, ou a rede `instagram` do registro (`src/core/delivery/networks.js`, a nascer na Fase 2) deve **apontar** para o adaptador que já existe em `src/instagram/` em vez de nascer `available:false`; (b) `FEATURE_CODES.INSTAGRAM_STORIES` já gate no plano Premium (`src/billing/plans.js`) — o multicanal reaproveita a MESMA reserva de plano (`PLAN_IDS.PREMIUM`) para `FEATURE_CODES.MULTI_NETWORK`, então os dois recursos podem acabar sendo vendidos juntos; registrar a decisão em `specs/017-multicanal-telegram-instagram/plan.md` (seção "Questões em aberto") antes de prosseguir. **Não bloqueia** as tarefas abaixo, que seguem assumindo a leitura literal da spec (Instagram declarado, `available:false`) até que a resposta chegue.

---

## Phase 1: Setup

**Purpose**: preparar a estrutura de diretórios e a documentação de variáveis de ambiente, sem nenhum código funcional ainda.

- [ ] T002 Criar a estrutura de diretórios nova por `plan.md` § Project Structure: `src/core/delivery/`, `src/delivery/whatsapp/`, `src/delivery/telegram/`, `src/deliveryOutbox/`, `dashboard/app/painel/aplicativos/` — cada uma com o primeiro arquivo real que as tarefas da Fase 2 vão preencher (sem stub vazio deixado para trás).
- [ ] T003 [P] Documentar `DELIVERY_NETWORKS_ENABLED` (default `whatsapp`), `TELEGRAM_BOT_TOKEN` (ausente por padrão, segredo de infraestrutura — nunca em credencial de cliente), `DELIVERY_FAIR_SHARE_PER_USER` e `DELIVERY_OUTBOX_SWEEP_INTERVAL_MS` em `.env.example`, com comentário explicando que são lidas **fora do worker** e que aplicar qualquer uma exige `pm2 delete` + `start` da API (pegadinha #1), nunca `pm2 restart bot-supervisor`.

**Checkpoint**: diretórios e variáveis documentados; nenhum comportamento novo existe ainda.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o núcleo neutro, o chokepoint do envio de WhatsApp extraído sem alterar o corpo, o schema aditivo e os dois filtros de configuração — tudo que TODAS as fatias seguintes dependem. **Esta fase concentra código de worker junto com a Fatia 1** (ver nota de organização acima); nenhuma fatia posterior toca nele de novo.

**⚠️ CRITICAL**: nenhuma história de usuário pode ser fechada antes desta fase.

- [ ] T004 [P] Escrever `test/delivery-networks.test.js`: `resolveDeliveryNetwork` devolve `whatsapp` para valor ausente e para valor desconhecido (nunca erro, nunca "desconhecido" — FR-013/SC-003); os valores de `DELIVERY_NETWORK` não colidem com `Group.kind` (`group`, `channel` — FR-002); `isDeliveryNetworkEnabled('telegram', {})` é `false` no default e `true` só quando `DELIVERY_NETWORKS_ENABLED` inclui `telegram`.
- [ ] T005 Implementar `src/core/delivery/networks.js`: constante `DELIVERY_NETWORK` (`whatsapp`, `telegram`, `instagram`), `resolveDeliveryNetwork(value)`, `registerDeliveryNetwork(adapter)`/`getDeliveryNetwork(id)` (registro por injeção — é o que permite a rede fictícia da Fatia 1 existir só em teste sem alterar este arquivo), `CAPABILITIES` inicial só com `whatsapp` (as demais entram nas fatias que as implementam) e `isDeliveryNetworkEnabled(id, env)` lendo `DELIVERY_NETWORKS_ENABLED` — fazendo T004 passar.
- [ ] T006 [P] Escrever `test/migrations-delivery-network-aditiva.test.js`: falha se a migration nova (ou qualquer migration futura desta feature) contiver `DROP`, `RENAME` ou qualquer reescrita de `Group.waJid`/`OfferAutomation.destGroupJid`/`OfferQueueItem.targetJids`/`ScheduledMessage.targetJids`/`MessageLog.destGroup`.
- [ ] T007 Adicionar ao `prisma/schema.prisma`, por `data-model.md` §2–3: `Group.deliveryNetwork String?` (nulável, comentário explicando que nulo = WhatsApp e nunca é lido cru), `MessageLog.deliveryNetwork String?` e `MessageLog.deliveryReductions String?` (ambas nuláveis), e os dois modelos novos `DeliveryOutbox` e `DeliveryInboxSeen` com os índices e a unicidade (`@@unique([deliveryNetwork, sourceId, messageId])`) descritos ali.
- [ ] T008 Gerar a migration aditiva (3 colunas nuláveis + 2 tabelas novas, zero `DROP`/`RENAME`) em `prisma/migrations/<ts>_delivery_network_additive/migration.sql`, satisfazendo T006. Lembrar da pegadinha #8 (DDL exige `pm2 stop` dos processos que seguram o SQLite antes do `migrate deploy` — os scripts de deploy já automatizam isso).
- [ ] T009 [P] Implementar `src/core/delivery/neutralOffer.js` (puro): a oferta neutra `{ texto, linkConvertido, imagem: {url, bytes?}, produto: {titulo, preco}, botao?, marca? }` e `degradeFor(oferta, capabilities)` → `{ oferta, reducoes: [códigos] }`, nunca degradação silenciosa.
- [ ] T010 [P] Implementar `src/core/delivery/deliveryFailure.js` (puro): scaffold da taxonomia de falha por rede, reaproveitando as categorias de `src/errorTaxonomy.js` (não duplicar a classificação — estender por composição), pronto para ganhar motivos específicos do Telegram na Fatia 3.
- [ ] T011 [P] Escrever `test/delivery-whatsapp-send-inalterado.test.js` (estrutural, no padrão de `test/bot-worker-retry-cache-wiring.test.js`): lê `src/delivery/whatsapp/send.js` e confere que as quatro rotas de envio (`relayMessage`, `primary`, `fallbacks`, `sendMessage` default), o `messageId` estável derivado do `logId`, o `stripChannelUnsafeFields` para destino canal e o `withSendTimeout` por tentativa continuam presentes e na mesma ordem do `sendPreparedPayload` de hoje.
- [ ] T012 Extrair `sendPreparedPayload` de `src/bot-worker.js` para `src/delivery/whatsapp/send.js` **com o corpo byte a byte inalterado**; `bot-worker.js` passa a importar e chamar essa função com os mesmos argumentos. O botão "Ver canal", `channelForward`, `waitDestinationRateLimit`, o atraso de digitação e `lastSendByDest` continuam exatamente onde estão em `bot-worker.js` — fazendo T011 passar.
- [ ] T013 [P] Implementar `src/delivery/whatsapp/adapter.js`: `capabilities` do WhatsApp (aceita texto, imagem, botão, card clicável, vídeo, marca d'água; múltiplos destinos; lê origem), `describeDestination`, `isOwnDestination` (formato `@g.us`/`@newsletter`), `readiness` (sempre pronto quando a sessão está conectada), `listDestinations`/`listSources` (grupos existentes) e `send` delegando para `src/delivery/whatsapp/send.js` — a primeira implementação real do contrato em `contracts/delivery-network-adapter.md`.
- [ ] T014 [P] Escrever `test/delivery-worker-sem-http.test.js` (estrutural): `src/bot-worker.js` e todo arquivo em `src/delivery/whatsapp/` não importam nenhum cliente HTTP do Telegram nem contêm `fetch(` apontando para `api.telegram.org` — trava R5/FR-021 na forma.
- [ ] T015 [P] Escrever `test/delivery-protocolo-intocado.test.js` (estrutural): `src/supervisor/protocol.js` não ganhou comando novo desde o commit-base da feature e `PROTOCOL_VERSION` continua `1` — trava R2/FR-036.
- [ ] T016 [P] Escrever `test/delivery-rollout-fora-do-worker.test.js` (estrutural): nenhum arquivo em `src/bot-worker.js`, `src/core/` (fora de `src/core/delivery/`), `src/supervisor/` ou `src/manager.js` faz `process.env.DELIVERY_NETWORKS_ENABLED` — garante que ligar/desligar o Telegram nunca exige reiniciar o supervisor (FR-037).
- [ ] T017 [P] Escrever `test/delivery-vocabulario.test.js` (estrutural, recursivo — cobre arquivos futuros sem precisar ser reescrito): varre `src/` e `dashboard/` atrás de `channel`/"canal" e `platform`/"plataforma" referindo-se a aplicativo de entrega (fora dos usos já existentes e legítimos de Canal do WhatsApp/loja, que o teste deve conhecer como allowlist), e atrás de "rede de entrega", "adaptador", "driver", "transporte", "Bot API", "Graph API", "webhook", "token", "chat_id" em qualquer string que a cliente possa ler (FR-001/FR-003/SC-008).
- [ ] T018 Em `src/billing/plans.js`: adicionar `FEATURE_CODES.MULTI_NETWORK = 'multi_network'` (nunca `channels` — FR-046), estender `getPlanEntitlements` com `canUseMultiNetwork: hasPremiumAccess` — **reaproveitando exatamente a mesma reserva de plano que `canUseInstagramStories` já usa** (`PLAN_IDS.PREMIUM`, já existente no código; não é uma fronteira nova sendo inventada aqui, é a mesma que o Instagram Stories já usa) —, exportar `canUseMultiNetwork(userOrPlan, options)` no mesmo formato de `canUseInstagramStories`, e adicionar o ramo `FEATURE_CODES.MULTI_NETWORK` em `buildFeatureGateError` com texto no mesmo estilo do de Instagram Stories ("O multicanal (WhatsApp + Telegram) estará disponível em um novo plano acima do Pro.", `code: 'FEATURE_REQUIRES_PREMIUM'`, `requiredPlan: PLAN_IDS.PREMIUM`) — **sem preço na mensagem** (preço é decisão comercial, tratada na seção separada da Fase 5).
- [ ] T019 [P] Escrever `test/multi-network-plan-gate.test.js` (puro): `FEATURE_CODES.MULTI_NETWORK` existe e é distinto de `channels`; `canUseMultiNetwork` é `false` para `trial`/`basic`/`pro` (inclusive trial ativo — ao contrário de Canal/preservação/automações, o multicanal **não** é herdado pelo trial nem pelo Pro, mesmo padrão de `canUseInstagramStories`) e `true` só para `premium`; `buildFeatureGateError(FEATURE_CODES.MULTI_NETWORK)` nunca devolve "seu plano não permite" — fazendo T018 passar.
- [ ] T020 Em `src/billing/groupEntitlements.js`: adicionar `deliveryNetwork: resolveDeliveryNetwork(group.deliveryNetwork)` em `toMonitorGroup` e `toPostDetail`, e dois filtros novos em `buildEntitledGroupConfig` (mesmo lugar e forma do filtro de canais que já existe): (1) rede não habilitada por `isDeliveryNetworkEnabled` exclui o destino/origem da config; (2) conta sem `canUseMultiNetwork` idem — segunda camada de FR-047. Com o interruptor no default, nenhum destino não-WhatsApp chega a existir para o worker.
- [ ] T021 Implementar `src/deliveryOutbox/enqueue.js`: função de escrita compartilhada (usada pelo hand-off do worker em T022 e, nas fatias seguintes, pelos dispatchers de fila/oferta automática) que insere uma linha `pending` em `DeliveryOutbox` com a oferta neutra serializada (`offerJson`), `enqueuedAt`, `deliveryNetwork` e `destinationId`.
- [ ] T022 Em `src/bot-worker.js`: no ponto em que o destino vira job de envio, adicionar **um único ramo** de hand-off — se `deliveryNetwork` do destino não for `whatsapp`, chamar `enqueue()` de T021 e seguir para o próximo destino sem tocar em rede; caso contrário, seguir o caminho de hoje inalterado. Este ramo é **inalcançável em produção** enquanto `DELIVERY_NETWORKS_ENABLED` estiver no default (T020), e é a **única** mudança funcional de worker desta feature além da extração de T012.
- [ ] T023 No caminho de envio de WhatsApp existente (`src/delivery/whatsapp/send.js` / ponto de escrita do `MessageLog` em `bot-worker.js`), persistir `deliveryNetwork: 'whatsapp'` e `deliveryReductions: null` em toda linha nova — sem backfill, `null` já lê como WhatsApp em qualquer linha anterior (FR-027/SC-003).

**Checkpoint**: o WhatsApp passa pelo caminho novo produzindo exatamente o mesmo resultado de hoje (extração byte a byte, guardas estruturais verdes), o schema é aditivo, e nenhum destino não-WhatsApp é alcançável ainda.

---

## Phase 3: Fatia 1 (conclusão) — US1 "quem usa só WhatsApp não percebe nada" + US7 "um aplicativo novo entra sem reescrita"

**Goal**: fechar a prova de não-regressão (US1) e a prova de que uma rede nova não exige reescrita (US7) — as duas condições que autorizam a Fatia 1 a ir a produção.

**Independent Test — US1**: comparar antes×depois numa conta só de WhatsApp (destinos, oferta em grupo, oferta em Canal com botão, histórico, bloqueios) — zero diferença observável. **Independent Test — US7**: a rede fictícia (destino único, imagem obrigatória, sem botão, não lê origem) roda de ponta a ponta sem importar nada de `src/delivery/whatsapp/` nem de `src/delivery/telegram/`.

### US1 — prova de não-regressão

- [ ] T024 [P] [US1] Escrever `test/group-entitlements-delivery-network-regression.test.js`: para um grupo sem `deliveryNetwork` gravado, `toMonitorGroup`/`toPostDetail` devolvem `deliveryNetwork: 'whatsapp'` e o restante da config é **byte a byte** o que era antes desta feature (comparar contra um snapshot da config atual) — FR-013, US1 cenário 2.
- [ ] T025 [US1] Confirmar verde o conjunto de guardas de não-regressão (T004, T006, T011, T014–T017, T019, T024) e a suíte completa: `npm test`, `npm run arch:check`, `npm run quality:gate`, por `quickstart.md` §1.1.
- [ ] T026 [US1] Executar o gate manual nº 1 da spec em homologação (antes×depois numa conta só WhatsApp: lista de destinos e origens, oferta publicada num grupo, oferta publicada num Canal do WhatsApp com botão "Ver canal", histórico, um bloqueio por repetição/palavra bloqueada/idade na fila, sessões) e registrar o resultado em `specs/017-multicanal-telegram-instagram/checklists/`. ⚠️ **Esta é a única fatia que reconecta todas as sessões de WhatsApp** (deploy toca `src/bot-worker.js`/`src/core/`/schema) — anunciar e agendar antes com a dona do produto.

### US7 — um aplicativo novo entra sem reescrita

- [ ] T027 [P] [US7] Escrever `test/delivery-capabilities.test.js`: decisões saem só da declaração — uma rede com `requiresImage: true` recusa oferta sem foto pelo `degradeFor`, uma rede com `acceptsButton: false` nunca recebe o botão, uma rede com `canReadSource: false` não é oferecida como origem na tela (FR-007/FR-008; US7 cenários 2 e 3).
- [ ] T028 [P] [US7] Escrever `test/delivery-sem-if-por-rede.test.js` (estrutural): nenhum arquivo em `src/core/` (fora de `src/core/delivery/networks.js`), `src/billing/`, `src/offerAutomation/`, `src/offerQueue/`, `src/scheduledMessage*` ou o histórico compara literalmente com `'telegram'`/`'whatsapp'`/`'instagram'`/`'fake'` — prova FR-031.
- [ ] T029 [US7] Criar a rede fictícia de teste em `test/helpers/fakeDeliveryNetwork.js`, registrada só via `registerDeliveryNetwork` **em código de teste, nunca de produção**: `singleDestination: true`, `requiresImage: true`, `acceptsButton: false`, `canReadSource: false` — as quatro divergências que o Instagram vai trazer (FR-032).
- [ ] T030 [US7] Escrever `test/delivery-rede-ficticia-e2e.test.js`: registra a rede fictícia de T029 e roda origem → roteamento → conversão → texto → fila → ritmo → repetição → histórico de ponta a ponta contra ela; assertiva estrutural própria no mesmo arquivo garantindo que o teste **não importa** nada de `src/delivery/whatsapp/` nem de `src/delivery/telegram/` (SC-009).

**Checkpoint**: Fatia 1 pronta para produção — WhatsApp idêntico ao de hoje, prova de extensibilidade rodando em teste.

---

## Phase 4: Fatia 2 — US5 "a cliente entende o que aconteceu, em qualquer aplicativo" (parcial) + US6 "cada aplicativo tem seu ritmo e sua aparência" (parcial)

**Goal**: o histórico passa a dizer por qual aplicativo a oferta saiu (hoje sempre "WhatsApp"), e o Instagram aparece declarado e **não selecionável** — sem nenhum Telegram no ar ainda. Prova FR-026, FR-027 e FR-034 com o interruptor ainda no default.

**Independent Test**: abrir o histórico de uma conta e ver a coluna/etiqueta "WhatsApp" em toda linha, inclusive nas anteriores à feature; abrir a lista de aplicativos e ver o Instagram como "em breve", sem poder ser escolhido.

- [ ] T031 [P] [US5] Escrever `test/delivery-failure-taxonomy.test.js` (puro): cada motivo de falha (a nascer por rede nas fatias seguintes) cai dentro da taxonomia existente (`categorizeErrorMsg`), com tradução leiga própria — nenhum cai em `error:other`/genérico (FR-028/SC-007).
- [ ] T032 [US5] Estender `dashboard/lib/painel/logsCopy.js` e `dashboard/app/painel/envios/SendHistory.js`: cada linha do histórico exibe o aplicativo (`deliveryNetwork` resolvido; `null`/desconhecido exibe "WhatsApp", nunca "desconhecido" — FR-027).
- [ ] T033 [P] [US5] Escrever `test/painel-historico-aplicativo.test.js`: renderiza `SendHistory` com uma linha de `MessageLog` sem `deliveryNetwork` (linha antiga) e confere que aparece como "WhatsApp"; com `deliveryNetwork: 'telegram'` aparece como "Telegram" — fazendo T032 verificável.
- [ ] T034 [US6] Implementar `GET /api/delivery-networks` em `src/api/routes/deliveryNetworks.js`: lista os aplicativos com `available`/`displayName`/capacidades resumidas; Instagram sempre `available: false` (FR-034) — direito de plano decide o que aparece **habilitado**, nunca o que aparece **listado** (a cliente sempre vê que o recurso existe, por US9).
- [ ] T035 [P] [US6] Escrever `test/delivery-telegram-surface.test.js`: `GET /api/delivery-networks` nunca inclui Instagram como selecionável, e nenhuma resposta contém os termos travados em `contracts/telegram-surface.md` §"Vocabulário travado".

**Checkpoint**: histórico honesto sobre linhas antigas; Instagram declarado sem prometer o que não existe; zero Telegram no ar.

---

## Phase 5 — SEÇÃO SEPARADA: comercialização do plano Premium (US9, candidata a virar entrega própria)

⚠️ **Esta seção é organizada para poder ser extraída para uma entrega independente sem reescrever nenhuma tarefa do multicanal.** As fatias 1–6 do multicanal **não dependem** de nenhuma tarefa daqui: o direito técnico (`canUseMultiNetwork`, T018/T020) já usa a reserva de plano Premium que **já existe no código** (`PLAN_IDS.PREMIUM`, hoje usada só por `canUseInstagramStories`); com nenhuma conta tendo `plan='premium'` de verdade ainda, o multicanal fica **inalcançável em produção por construção**, exatamente como o interruptor `DELIVERY_NETWORKS_ENABLED` já garante. **A recomendação registrada é que o Premium vire trabalho próprio** (misturar cobrança nova com aplicativo de entrega novo dobra o risco de uma validação só) — a decisão final de empacotamento é da dona do produto.

**Preço confirmado pela dona do produto**: Premium = **R$ 99/mês** (Pro é R$ 69/mês). Ainda em aberto: se o Premium sai já bundlado com o Instagram Stories (que já usa a mesma reserva de plano) ou se os dois recursos ganham degraus de preço distintos — **não decidir isso aqui**.

- [ ] T036 ⛔ [US9] **BLOQUEADA por decisão comercial pendente**: implementar o checkout/assinatura recorrente do plano Premium (R$ 99/mês) via Mercado Pago, seguindo o mesmo desenho de `src/domain/payments/subscriptionPolicy.js` e `POST /payments/create-subscription` já usados pelo Pro (R$ 69/mês) — precisa antes: confirmação se o Premium é vendido isolado ou como upgrade obrigatório a partir do Pro, e se há período de transição para quem já é Pro.
- [ ] T037 ⛔ [US9] **BLOQUEADA por decisão comercial pendente**: adicionar o CTA de upgrade para Premium em `dashboard/app/painel/plano/page.js`, mostrando o preço (R$ 99/mês) e listando os recursos que ele libera (multicanal + Stories do Instagram) — depende de T036 existir para o botão ter para onde apontar.
- [ ] T038 ⛔ [US9] **BLOQUEADA por decisão comercial pendente**: até T036/T037 existirem, o texto de recusa por plano (`buildFeatureGateError`, já implementado em T018) precisa de um **caminho alternativo temporário** — link de contato de suporte (`SUPPORT_WHATSAPP`/`SUPPORT_EMAIL` de `dashboard/lib/marketing-content.js`) pedindo o upgrade manual, em vez de um botão de compra — confirmar com a dona do produto se esse caminho provisório é aceitável para o lançamento do multicanal ANTES do checkout de Premium existir, ou se o multicanal deve esperar T036/T037.
- [ ] T039 ⛔ [US9] **BLOQUEADA por decisão comercial pendente**: dar visibilidade ao plano Premium no admin (`/admin/clientes`, tag "Pagante", `GET /finance/overview`) distinguindo Premium de Pro na receita e no histórico por cliente — mesma regra de "tag sai de pagamento aprovado, nunca do campo `plan`" já documentada em `AGENTS.md`.
- [ ] T040 ⛔ [US9] **BLOQUEADA por decisão comercial pendente**: atualizar a página pública de preços (`dashboard/app/precos/`) com o degrau Premium (R$ 99/mês) e o que ele libera, com linguagem leiga e sem prometer Telegram/Instagram antes de estarem no ar para quem assina.
- [ ] T041 [US9] Atualizar `specs/017-multicanal-telegram-instagram/spec.md` (seção "Assumptions" e D2) e `plan.md` (Q1, Constitution Check) substituindo a suposição "Pro ou teste grátis ativo" pela fronteira real (plano Premium, reserva já existente em `PLAN_IDS.PREMIUM`) — documentação, não bloqueia nenhuma fatia técnica.

**Checkpoint**: nenhuma tarefa desta seção bloqueia as fatias 2–6 abaixo. O multicanal já nasce sem ninguém com direito real — a válvula de teste em homologação é a mesma usada para Instagram Stories: liberação manual de acesso pelo admin (`plan='premium'` numa conta de teste), sem precisar do checkout.

---

## Phase 6: Fatia 3 — US2 "ligar o Telegram" + US4 "filas e ofertas automáticas entregam sem configuração nova" + US6 (parcial) + US9 (camada técnica) + US10 (módulos puros)

**Goal**: Telegram como **destino** funcional pelas filas e ofertas automáticas — caixa de saída, drenador, rodízio entre clientes, orçamento global, adaptador do Telegram, tela "Aplicativos" (US2), estados de prontidão, motivos próprios no histórico, recusa em duas camadas (US9 técnico) e degradação declarada (US6). O espelhamento de origem monitorada (US3) só liga na Fatia 4 — aqui os destinos são alimentados pelos dispatchers de fila/oferta automática, que já rodam fora do worker.

**Independent Test — US2**: numa conta com `plan='premium'` de teste, adicionar o robô a um grupo real e ver o destino aparecer; repetir sem o robô e sem permissão, e conferir que os dois casos são explicados sem jargão. **Independent Test — US4**: apontar uma fila e uma oferta automática existentes para um destino de Telegram e conferir que os envios saem, respeitam o ritmo e aparecem no histórico.

⚠️ **Grupo de tarefas dependente de credencial ainda não fornecida (Q2)**: a dona do produto vai criar o robô de homologação depois — **separado do robô de produção**, porque dois ambientes lendo o mesmo robô por `getUpdates` recebem `409 Conflict` e um deles para de ler (`research.md` R0.1). Toda tarefa abaixo marcada com ⛔🔑 só pode ser validada ao vivo quando `TELEGRAM_BOT_TOKEN` de homologação existir; até lá, ela é implementada e testada com HTTP injetado/mockado, nunca contra a API real.

### US2 — ligar o Telegram

- [ ] T042 [P] [US2] Escrever `test/delivery-segredo-do-robo.test.js` (estrutural): `TELEGRAM_BOT_TOKEN` não aparece em nenhuma rota, resposta HTTP, log, e-mail, tela ou tabela de credencial de loja — trava FR-016/FR-017.
- [ ] T043 [US2] Implementar `src/delivery/telegram/api.js`: cliente HTTP com `fetch` nativo (sem lib nova) para `getMe`, `getChatAdministrators`/`getChatMember` (checar permissão de publicar), `getUpdates` (long poll), `sendMessage`/`sendPhoto` — com `fetchImpl` injetável para teste, e `TELEGRAM_BOT_TOKEN` lido de uma env, nunca de parâmetro vindo da cliente.
- [ ] T044 [US2] Adicionar `telegram` ao `CAPABILITIES` de `src/core/delivery/networks.js` (aceita texto/imagem/vídeo/marca d'água; não aceita botão "Ver canal" nem card clicável; múltiplos destinos; lê origem; limites de ritmo próprios) e implementar `src/delivery/telegram/adapter.js`: `describeDestination`, `isOwnDestination` (prefixo `tg:`), `readiness(userId)` → `{ pronto, motivo, comoResolver }` distinguindo "robô não adicionado" / "sem permissão de publicar" / "pronto" (FR-018), `listDestinations(userId)` e `send(ofertaNeutra, destino, ctx)` nunca lançando para o chamador (contrato de `contracts/delivery-network-adapter.md`).
- [ ] T045 [US2] Registrar `GET /api/delivery-networks/telegram/status`, `GET /api/delivery-networks/telegram/destinations` (lista vazia é estado normal com explicação, nunca erro — US2 cenário 2) e `POST /api/delivery-networks/telegram/disable` (destinos param, WhatsApp intacto, nada é apagado — FR-019) em `src/api/routes/deliveryNetworks.js`, todas atrás de `canUseMultiNetwork` com o texto de T018/T038.
- [ ] T046 [US2] Nas rotas de grupo existentes (`POST`/`PUT /groups`), aceitar `deliveryNetwork` na criação (com prefixo `tg:<chatId>` para não-WhatsApp — R10/FR-013) e **recusar a troca de aplicativo** de um destino já criado (US3 cenário 5).
- [ ] T047 [US2] Criar `dashboard/app/painel/aplicativos/`: passo a passo em linguagem leiga para adicionar **"o robô do Espelha Grupos"** ao grupo/canal e torná-lo administrador com permissão de publicar — sem QR, sem código, sem nada para copiar (FR-017/US2 cenário 7). Vocabulário: sempre "o robô do Espelha Grupos" e "seu grupo", nunca "BOTinho" sozinho (guia de marca) nem termos técnicos.
- [ ] T048 ⛔🔑 [US2] Validar ao vivo, quando o robô de homologação existir: adicionar o robô a um grupo real e a um canal real e conferir a listagem nos três estados (não adicionado / sem permissão / pronto) — gate manual nº 2 da spec, `quickstart.md` §3.

### US4 — filas e ofertas automáticas entregam no Telegram

- [ ] T049 [US4] Implementar `src/deliveryOutbox/sweep.js` (`startDeliveryOutboxSweep()`): `setInterval` + `unref()` dentro do processo `api`, single-flight, seguindo a ordem canônica de `contracts/delivery-outbox.md` (selecionar pendentes com `notBeforeAt` vencido → repartir com justiça → descartar por idade via `shouldDropExpiredQueueJob` → revalidar destino/plano/rede → degradar → enviar pelo adaptador → gravar `MessageLog` → podar `done`/`dropped` antigos). **Não inicia** se a rede não estiver habilitada ou se `TELEGRAM_BOT_TOKEN` estiver ausente.
- [ ] T050 Integrar `startDeliveryOutboxSweep()` ao boot da API, junto dos demais `setInterval`+`unref()` já existentes, em `src/api/server.js`.
- [ ] T051 [US4] Nos dispatchers `src/offerAutomation/dispatcher.js` e `src/offerQueue/dispatcher.js` (e no disparo de `ScheduledMessage`), quando o destino não for WhatsApp, chamar `enqueue()` de T021 em vez do caminho de envio de WhatsApp — sem tocar no caminho que já existe para destinos de WhatsApp (que continua usando `sendBroadcast` como hoje).
- [ ] T052 [P] [US4] Escrever `test/delivery-outbox-sweep.test.js` (com banco): uma linha `pending` sobrevive intacta enquanto o robô está fora do ar (nenhuma tentativa em massa, nenhum `status` virando "entregue" sem entrega — FR-040); falha de um item não aborta o lote nem apaga o progresso já gravado das linhas anteriores (FR-024); linhas `done`/`dropped` são podadas por idade.
- [ ] T053 ⛔🔑 [US4] Validar ao vivo, quando o robô de homologação existir: apontar uma fila e uma oferta automática existentes para um destino de Telegram e conferir entrega, ritmo e histórico — gate manual nº 5 da spec.

### US6 (parcial) — degradação declarada e ritmo próprio do Telegram, sem opção que ele não suporta

- [ ] T054 [P] [US6] Escrever `test/delivery-neutral-offer-degrade-telegram.test.js`: uma oferta com botão "Ver canal" indo para um destino de Telegram sai **sem** o botão e `MessageLog.deliveryReductions` registra o código da redução (FR-009/SC-012) — integra `degradeFor` (T009) ao caminho real de T049.
- [ ] T055 [US6] Em `dashboard/app/painel/grupos/`, esconder as opções exclusivas do WhatsApp (botão "Ver canal") quando `group.deliveryNetwork !== 'whatsapp'`, decidido pela **capacidade** da rede (`caps.acceptsButton`), nunca por `if (rede === 'telegram')` (FR-008/US6 cenário 1).
- [ ] T056 ⛔ [US6] **BLOQUEADA por decisão pendente (Q5)**: definir quais campos de ritmo/preservação a cliente vê ao configurar um destino de Telegram. Até a decisão chegar, `dashboard/app/painel/grupos/` **não expõe nenhum controle de ritmo específico do Telegram** — a rede aplica seus próprios limites internamente (FR-021/FR-022), e a tela mostra só o aplicativo e o botão de desligar.
- [ ] T057 [US6] Adicionar `ops_delivery_degraded` à allowlist de `src/analytics.js` e ao mapa de `src/observability/operationalSignals.js`, emitido por T049 a cada linha entregue com `deliveryReductions` não nulo.

### US9 (camada técnica, não comercial) — recusa em duas camadas e preservação no rebaixamento

- [ ] T058 [US9] Nas rotas de T045/T046, recusar cadastro de destino/origem de Telegram para conta sem `canUseMultiNetwork` com `buildFeatureGateError(FEATURE_CODES.MULTI_NETWORK)` (texto de T018 + caminho de contato de T038) — primeira camada (tela) de FR-047.
- [ ] T059 [P] [US9] Escrever `test/multi-network-plan-downgrade.test.js` (com banco): uma conta com destino/origem de Telegram ativos rebaixada para `pro` deixa de publicar/ler (filtro de T020, segunda camada de FR-047) **sem nenhuma linha de `Group` apagada ou reescrita**; ao voltar para `premium`, os destinos e origens voltam a funcionar sem a cliente reconfigurar nada (SC-015).
- [ ] T060 [US9] Em `dashboard/app/painel/aplicativos/` e no histórico, avisar a cliente quando o Telegram parar por rebaixamento de plano ("seu plano mudou, o Telegram foi pausado, nada foi apagado" + caminho de T038), respeitando as travas de aviso já existentes (conta parada, teto semanal, janela anti-repetição).

### US10 (módulos puros) — preparando a Fatia 6

- [ ] T061 [P] [US10] Escrever `test/delivery-fair-share.test.js` (puro): uma conta em volume alto não consome a fatia das outras contas (rodízio com teto por conta por tick); estourado o orçamento global, a linha recebe `notBeforeAt` no futuro e continua `pending` — nunca descarte nem "entregue" (FR-039/FR-040/SC-013); sem medição confiável do orçamento, a decisão é deixar sair no ritmo conservador, nunca travar a conta inteira.
- [ ] T062 [US10] Implementar `src/core/delivery/fairShare.js` (puro): recebe as linhas prontas da caixa de saída e o estado dos orçamentos, devolve o que sai neste tick e o que espera, por T061. Integrado ao drenador de T049.
- [ ] T063 [P] [US10] Escrever `test/delivery-network-health.test.js` (puro): sem medição confiável, o estado é `sem_medicao`, nunca vermelho; os quatro estados (`funcionando`/`limitado`/`bloqueado`/`indisponivel`) e seus motivos saem em linguagem leiga (FR-041).
- [ ] T064 [US10] Implementar `src/core/delivery/networkHealth.js` (puro): recebe as últimas respostas do robô (sucesso, limitado, recusado, indisponível) e devolve `{ estado, motivo, desde }`, por T063. Alimentado pelas respostas de T043/T049; consumido pelo painel de operação na Fatia 6.
- [ ] T065 [US10] Configurar `DELIVERY_FAIR_SHARE_PER_USER` e os limites internos de ritmo do Telegram em `src/core/delivery/networks.js` com as estimativas públicas da documentação do Telegram (~30 mensagens/s globais, ~20/min por grupo) — **não é medição própria** e precisa ser calibrada em homologação (Q6, não bloqueia a entrega).

**Checkpoint**: Telegram funciona como destino via filas e ofertas automáticas, com direito de plano técnico completo; espelhamento de origem monitorada ainda não liga (Fatia 4).

---

## Phase 7: Fatia 4 — US3 "escolher o aplicativo por destino e receber o espelhamento lá"

**Goal**: ligar o ramo que a Fatia 1 (T022) já deixou pronto e inalcançável no worker — basta o destino de Telegram passar a existir na config (interruptor habilitado + conta com `canUseMultiNetwork`) para o hand-off começar a valer via `reloadConfig`. **Nenhum código novo de worker; nenhum reinício de supervisor.**

**Independent Test**: ligar uma origem a um destino de WhatsApp e um de Telegram, publicar uma oferta na origem, e conferir que ela chega nos dois com a comissão da cliente, o mesmo texto base e um registro por destino.

- [ ] T066 [P] [US3] Escrever `test/delivery-cross-network-mirroring.test.js`: uma origem monitorada de WhatsApp ligada a um destino de WhatsApp **e** um de Telegram — a oferta chega nos dois, com o link de afiliada da cliente em ambos, conversão/modelo de texto/palavras bloqueadas/lojas permitidas aplicados **uma vez só** (US3 cenários 1 e 2); lista explícita de origens vazia continua significando "nenhum destino", independente do aplicativo (US3 cenário 3); um destino de Telegram e um de WhatsApp com o mesmo identificador numérico/textual coexistem sem conflito (US3 cenário 4, prova de R10/D-A10).
- [ ] T067 [P] [US3] Escrever `test/delivery-dedup-por-rede.test.js`: um bloqueio por repetição num destino de WhatsApp não impede a entrega no destino de Telegram da mesma origem, e vice-versa — a chave de `buildMirrorDedupKeys` namespaceada por rede torna isso estrutural (FR-023/R4, US3 cenário 6).
- [ ] T068 [US3] Habilitar em homologação `DELIVERY_NETWORKS_ENABLED=whatsapp,telegram` e uma conta de teste com `plan='premium'` (liberação manual pelo admin, sem depender do checkout da Fase 5), `pm2 delete` + `start` da API — **nunca** `pm2 restart bot-supervisor` — por `quickstart.md` §3.
- [ ] T069 ⛔🔑 [US3] Validar ao vivo, quando o robô de homologação existir: gate manual nº 3 da spec (oferta real chegando nos dois destinos, no celular).

**Checkpoint**: espelhamento cruzado WhatsApp → Telegram funcionando; falta só o sentido Telegram → WhatsApp (Fatia 5).

---

## Phase 8: Fatia 5 — US8 "monitorar um grupo de Telegram como origem"

**Goal**: o Telegram também como origem monitorada, com a blindagem de entrada exigida explicitamente (não herdada por suposição) e o fan-out cruzado — destino de WhatsApp pelo `sendBroadcast` já existente, destino de Telegram pela caixa de saída.

**Independent Test**: adicionar o robô a um grupo de Telegram real, cadastrá-lo como origem, publicar uma oferta lá e conferir que ela chega convertida no destino de WhatsApp escolhido, uma vez só.

- [ ] T070 [P] [US8] Escrever `test/delivery-incoming-envelope.test.js` (puro): um update velho ou reentregue é descartado com motivo e idade registrados, sem chamar `shouldProcessIncomingMessage` de um jeito diferente do que o WhatsApp já chama; um update ao vivo passa normalmente (FR-056).
- [ ] T071 [US8] Implementar `src/core/delivery/incomingEnvelope.js` (puro): normaliza o update cru do Telegram em `{ networkId, sourceId, messageId, timestampMs, isReplay }` e chama **`shouldProcessIncomingMessage`** de `src/core/incomingFreshness.js` **sem alterar uma linha dele** — fazendo T070 passar.
- [ ] T072 [P] [US8] Escrever `test/delivery-inbox-seen.test.js` (com banco): duas gravações concorrentes de `DeliveryInboxSeen` para a mesma `(deliveryNetwork, sourceId, messageId)` — a segunda colide na unicidade e a mensagem não é processada duas vezes, mesmo simulando dois processos (FR-055/SC-016); a gravação acontece **antes** do fan-out.
- [ ] T073 [US8] Implementar `src/delivery/telegram/reader.js`: leitor único por `getUpdates` (long poll), `createMessageQueue({ orderKey: sourceId })` (o mesmo mecanismo do worker, inclusive a correção de 2026-08-28 — o elo da corrente é o fim do job **na fila**, não o fim da função) para ordem por origem e isolamento de mensagem travada (FR-057/FR-058), gravação em `DeliveryInboxSeen` antes do fan-out (T072), roteamento por `resolveMonitorDestinations` e conversão de link/texto reaproveitados sem alteração, e fan-out: destino de WhatsApp via `sendBroadcast(userId, texto, jids, { imageUrl, imageRefererUrl, source })` (mesmo caminho que `offerAutomation`/`offerQueue` já usam — **nenhuma mudança em `src/supervisor/protocol.js`**), destino de Telegram via `enqueue()` de T021.
- [ ] T074 [US8] Integrar `startTelegramInboxSweep()` ao boot da API (mesmo padrão de T050), só iniciando com a rede habilitada e o segredo do robô presente.
- [ ] T075 [P] [US8] Escrever `test/delivery-origin-isolation.test.js`: uma origem de Telegram com problema (robô removido/sem permissão) não afeta o funcionamento das demais origens, de qualquer rede (FR-059, US8 cenário 7); uma mensagem que trava no processamento de uma origem não impede as seguintes da mesma origem (FR-058, US8 cenário 6).
- [ ] T076 [US8] Registrar `GET /api/delivery-networks/telegram/sources` em `src/api/routes/deliveryNetworks.js` (só quando `capabilities.canReadSource`), e nas rotas de grupo de origem aceitar `deliveryNetwork: 'telegram'` com o mesmo prefixo `tg:` de T046.
- [ ] T077 [US8] Estender `dashboard/app/painel/grupos/` (ou a tela equivalente de cadastro de origem) para listar origens de Telegram lado a lado com as de WhatsApp, usando **exatamente as mesmas telas e regras** de palavras bloqueadas, lojas permitidas, modelo de texto e destinos ligados (FR-052, US8 cenário 8) — nenhuma tela nova para isso.
- [ ] T078 [US8] Estender `src/core/delivery/deliveryFailure.js` (de T010) com os motivos próprios de origem: robô removido do grupo de origem, sem permissão de leitura, grupo apagado — reconhecidos e explicados sem confundir com a indisponibilidade global do robô (FR-053, R17).
- [ ] T079 ⛔🔑 [US8] Validar ao vivo, quando o robô de homologação existir: gate manual nº 4 da spec — cadastrar origem real, publicar oferta, forçar entrega repetida e mensagem antiga, conferir dedup e descarte registrado.

**Checkpoint**: cruzamento nos dois sentidos completo (Fatia 4 + Fatia 5); blindagem de entrada do Telegram provada, não suposta.

---

## Phase 9: Fatia 6 — US10 "a operação enxerga quando o robô do produto para para todo mundo"

**Goal**: estado do robô único visível sem entrar no servidor, aviso interno, e contingência declarada e testável.

**Independent Test**: simular o robô bloqueado/limitado e conferir que o painel de operação mostra o estado, que um aviso interno é gerado, e que o WhatsApp de todas as contas segue intacto.

- [ ] T080 [US10] Adicionar ao painel `/admin` (`dashboard/app/admin/page.js` + um componente novo) um bloco com o estado do robô único (`funcionando`/`limitado`/`bloqueado`/`indisponivel`/`sem_medicao`, de `networkHealth.js` de T064) e um "?" explicando, no padrão dos demais cartões do admin.
- [ ] T081 [US10] Adicionar `admin_robo_aplicativo_parado` ao catálogo de e-mails (`src/email/registry.js`, grupo `interno`) e disparar por `sendAdminAlert` quando `networkHealth` mudar para `limitado`/`bloqueado`/`indisponivel`, com cooldown por assunto (mesmo padrão dos avisos de cobrança).
- [ ] T082 [P] [US10] Escrever `test/ops-delivery-network-health-alert.test.js`: o aviso interno dispara na transição para estado ruim, respeita o cooldown, e nenhuma conta de WhatsApp é afetada (FR-042); estado indisponível não descarta ofertas em silêncio — elas continuam `pending` em `DeliveryOutbox` (US10 cenário 3).
- [ ] T083 [US10] Adicionar `ops_delivery_network_down` e `ops_delivery_network_throttled` à allowlist de `src/analytics.js` e ao mapa de `src/observability/operationalSignals.js`, emitidos por `networkHealth.js`/`fairShare.js` a cada mudança de estado.
- [ ] T084 [P] [US10] Escrever `test/delivery-fair-share-multi-account.test.js` (extensão de T061 com múltiplas contas simuladas): uma conta em volume alto disputando o orçamento global com outras em volume normal — as normais continuam entregando dentro do ritmo esperado (SC-013).
- [ ] T085 [US10] Documentar em `AGENTS.md` (nova seção canônica desta feature) a contingência de troca do robô único: criar o robô novo, trocar `TELEGRAM_BOT_TOKEN`, `pm2 delete` + `start` da API — nenhuma configuração de cliente é tocada, o único passo manual é a cliente adicionar o robô novo aos grupos (FR-043).
- [ ] T086 ⛔🔑 [US10] Validar ao vivo, quando o robô de homologação existir: gates manuais nº 6 e nº 8 da spec (provocar cada falha de Telegram e conferir motivo próprio + aviso; simular disputa de ritmo entre contas reais).

**Checkpoint**: as dez histórias de usuário estão fechadas; falta só a validação de 24h e o gate manual completo antes de produção.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: documentação canônica, regressão final e a validação de 24h que a sinalização de memória do plano prometeu.

- [ ] T087 [P] Adicionar a `AGENTS.md` a seção canônica desta feature: vocabulário (`deliveryNetwork`/"aplicativo"), as 6 fatias e por que todo código de worker está só na Fatia 1, `DELIVERY_NETWORKS_ENABLED` e a pegadinha de aplicá-la (`pm2 delete`+`start`, nunca `restart bot-supervisor`), a reserva de plano Premium compartilhada com Instagram Stories, e o achado de T001 sobre a sobreposição com `src/instagram/`.
- [ ] T088 Rodar `npm test`, `npm run arch:check`, `npm run quality:gate` e, no `dashboard/`, `npm ci --prefix dashboard && npm run lint && npm run build`, corrigindo qualquer regressão nos arquivos desta feature antes de abrir a PR final para `develop`.
- [ ] T089 Executar o roteiro completo de `quickstart.md` (seções 1 a 6) em homologação, registrando em `specs/017-multicanal-telegram-instagram/checklists/` quais dos 9 itens do "Gate manual obrigatório" da spec foram cumpridos e quais seguem `⛔🔑` pendentes do robô de homologação (Q2).
- [ ] T090 ⏸️ DEFERIDA (validação manual pós-deploy da Fatia 1, não executável nesta sessão): observar por 24h em produção, conforme `quickstart.md` §7 — crescimento do processo `api` dentro do estimado (**< 30 MB, já aprovado pela dona do produto**), sem aumento de quedas de sessão de WhatsApp, swap parado (`si`/`so` = 0), nenhum aviso duplicado. **BLOQUEADA nesta sessão**: exige o deploy real da Fatia 1 em produção e uma janela contínua de 24h.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências; T001 (achado) não bloqueia nada, mas deve ser respondido antes que T005/T044 fixem `CAPABILITIES.instagram` como definitivo.
- **Foundational (Fase 2)**: depende de Setup; bloqueia TODAS as fatias. Concentra, com a Fase 3, todo o código de worker da feature.
- **Fatia 1 / US1+US7 (Fase 3)**: depende da Fundação; é o único deploy que reconecta sessões de WhatsApp.
- **Fatia 2 / US5+US6 parcial (Fase 4)**: depende da Fundação (T020, T023); independente da Fase 5.
- **Seção Premium / US9 (Fase 5)**: depende de T018 (a reserva de plano já existir); **não bloqueia** nenhuma fatia técnica — pode ser extraída para outra entrega a qualquer momento.
- **Fatia 3 / US2+US4+US6 parcial+US9 técnico+US10 puros (Fase 6)**: depende da Fundação e de T034 (Fatia 2); **não depende** da Fase 5 (usa liberação manual de plano em homologação).
- **Fatia 4 / US3 (Fase 7)**: depende da Fatia 3 (adaptador de Telegram, direito técnico) e do ramo de hand-off já existente desde a Fundação (T022).
- **Fatia 5 / US8 (Fase 8)**: depende da Fatia 3 (adaptador, caixa de saída) e da Fatia 4 (roteamento cruzado já validado num sentido).
- **Fatia 6 / US10 (Fase 9)**: depende de T062/T064 (Fatia 3) e é enriquecida pela Fatia 5 (estado do robô cobre leitura também).
- **Polish (Fase 10)**: depende de todas as fatias que forem entregues nesta rodada.

### User Story Dependency Graph

```text
Setup → Foundational (código de worker concentrado aqui + Fatia 1)
                │
                ├─→ US1 + US7 (Fatia 1) ── único reinício do supervisor
                │
                ├─→ US5 + US6(parcial) (Fatia 2)
                │        │
                ├─→ ┄┄┄┄┄┴─→ US2 + US4 + US6(parcial) + US9(técnico) + US10(puro) (Fatia 3)
                │                    │
                │                    ├─→ US3 (Fatia 4)
                │                    │        │
                │                    │        └─→ US8 (Fatia 5)
                │                    │                 │
                │                    └─────────────────┴─→ US10 completo (Fatia 6)
                │
                └─→ US9 comercial — Seção Premium (Fase 5, paralela, extraível)

Todas as fatias → Polish
```

### Within Each Phase

1. Escrever o(s) teste(s) da tarefa e confirmar que falham pelo motivo esperado antes de implementar.
2. Módulos puros (`src/core/delivery/`) antes dos adaptadores de I/O (`src/delivery/`).
3. Adaptadores antes das rotas; rotas antes das telas.
4. Nenhuma tarefa de fatia posterior reabre `src/bot-worker.js`, `src/core/` (fora de `delivery/`), `src/billing/` ou `prisma/schema.prisma`.

---

## Parallel Opportunities

### Foundational

```text
T004 + T006 + T009 + T010 + T011 + T014 + T015 + T016 + T017 + T019   # testes/módulos puros em arquivos distintos
```

### Fatia 1

```text
T024 (regressão) + T027 + T028 + T029                                 # US1 e US7 em arquivos diferentes
```

### Fatia 2

```text
T031 + T033 + T035
```

### Fatia 3

```text
T042 + T052 + T054 + T059 + T061 + T063                                # testes independentes entre US2/US4/US6/US9/US10
```

### Fatia 4 e Fatia 5

```text
T066 + T067                                                            # US3
T070 + T072 + T075                                                     # US8
```

### Fatia 6

```text
T082 + T084
```

---

## Implementation Strategy

### MVP First (não-regressão é o próprio MVP desta feature)

1. Completar Setup + Foundational.
2. Completar Fatia 1 (US1 + US7) e validar o gate manual nº 1.
3. **PARAR e avaliar**: com o interruptor no default, o produto está byte a byte como antes — este é o ponto seguro para ir a produção mesmo que nenhuma fatia seguinte avance no curto prazo.

### Incremental Delivery

1. Fatia 1 → produção (prova de não-regressão).
2. Fatia 2 → produção (histórico honesto, Instagram declarado).
3. Fatia 3 → homologação com liberação manual de `plan='premium'` numa conta de teste; Telegram como destino via filas/automações.
4. Fatia 4 → cruzamento WhatsApp→Telegram.
5. Fatia 5 → Telegram como origem, cruzamento completo.
6. Fatia 6 → operação enxerga o robô único.
7. Seção Premium (comercial) corre em paralelo, sem bloquear nenhuma das seis acima, e pode virar uma entrega própria.

### Guardrails de implementação (não regredir)

- Nenhum processo PM2 novo; as duas passadas (`sweep.js`, `reader.js`) vivem dentro do processo `api`.
- Nenhuma dependência nova em `package.json` (Telegram é `fetch` nativo).
- `src/supervisor/protocol.js` nunca é tocado; `PROTOCOL_VERSION` continua `1`.
- Nenhuma migration `DROP`/`RENAME`; nenhum backfill obrigatório.
- Todo código de worker desta feature está nas Fases 2 e 3 — nenhuma fatia depois disso reabre esses arquivos.
- `DELIVERY_NETWORKS_ENABLED` e o direito de plano `multi_network` nunca são lidos por código de worker.
- Vocabulário: `deliveryNetwork` interno, "aplicativo" com a cliente; nunca `channel`/"canal" nem `platform`/"plataforma" para isso.
- A seção Premium (Fase 5) nunca bloqueia as fatias técnicas — elas já nascem inalcançáveis em produção pelo interruptor e pelo direito de plano.

---

## Task Completeness Validation

- **US1**: verificável de forma independente comparando uma conta só-WhatsApp antes×depois; nenhuma ação da cliente exigida.
- **US2**: verificável com uma conta de teste elegível adicionando/removendo o robô de um grupo real (pendente do robô de homologação, Q2).
- **US3**: verificável ligando uma origem a destinos de WhatsApp e Telegram e conferindo entrega dupla com um registro por destino.
- **US4**: verificável apontando fila/oferta automática existente para um destino de Telegram.
- **US5**: verificável olhando o histórico de uma conta com linhas antigas e novas.
- **US6**: verificável abrindo a configuração de um destino de Telegram e vendo as opções do WhatsApp ausentes.
- **US7**: verificável com a rede fictícia rodando de ponta a ponta sem tocar em WhatsApp/Telegram.
- **US8**: verificável cadastrando uma origem de Telegram real e publicando uma oferta (pendente do robô de homologação, Q2).
- **US9**: verificável tentando cadastrar Telegram numa conta sem plano Premium e rebaixando uma conta que já tinha Telegram ativo — tudo isso **sem depender do checkout comercial** (Fase 5).
- **US10**: verificável simulando o robô bloqueado/limitado e conferindo o painel de operação e o aviso interno.
- Todas as tarefas usam checkbox, ID sequencial, rótulo de história quando aplicável (ausente só em Setup/Foundational/Fase 5) e caminho de arquivo explícito.
