---

description: "Task list template for feature implementation"
---

# Tasks: Banner de marca "CUPOM + loja" para cupom e vitrine

**Input**: Design documents from `/specs/008-coupon-brand-banner/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/couponBrandCardPolicy.md, quickstart.md

**Tests**: Explicitamente requeridos por FR-011/FR-012 e pelo contrato — incluídos.

**Organization**: Tasks agrupadas por user story (US1 cupom, US2 vitrine ML, US3 blindagem crítica de não-regressão), todas P1. A blindagem tripla é um único gate compartilhado pelas três — por isso a implementação nuclear vive na fase Foundational (compartilhada) e cada fase de user story adiciona os testes/validação que provam seu cenário específico nesse mesmo gate.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 (cupom), US2 (vitrine ML), US3 (não-regressão produto por short link)
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Single project (monólito wabot) — `src/`, `test/`, `AGENTS.md` na raiz do repo, conforme plan.md.

---

## Phase 1: Setup

**Não aplicável** — sem dependência nova (`sharp`/Baileys já usados por `storeBrandCard.js`), sem migration, sem novo processo PM2. Segue direto para Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: A blindagem tripla (FR-004) é um único ponto de decisão consumido pelas três user stories. Nenhuma delas pode ser testada/validada sem este gate implementado por completo.

**⚠️ CRITICAL**: Nenhuma fase de user story pode começar antes desta fase estar completa.

- [ ] T001 [P] Adicionar export `urlHasProductId(platform, url)` em `src/converters/linkKind.js`, reusando `AMAZON_ASIN_RE`/`MLB_ID_RE`/`PRODUCT_ID_DETECTORS` já existentes; `resolveLinkKind` permanece byte-a-byte inalterado (FR-010)
- [ ] T002 [P] Criar `src/converters/couponBrandCardPolicy.js` exportando `shouldUseCouponBrandCard({ enabled, platform, linkKind, couponTextSignal, resolvedUrl })` — módulo LEAF puro, sem I/O, sem import de `bot-worker.js`/`db.js`, retorna `false` para entradas ausentes/`undefined` e nunca lança; usa `isBrandCardPlatform` (de `storeBrandCard.js`) e `urlHasProductId` (T001) conforme a fórmula de `data-model.md` (depends on T001)
- [ ] T003 Em `src/bot-worker.js`, na função `buildManualLinkPreview` (linha ~1263-1362): substituir `const COUPON_BRAND_CARD_ENABLED = false` (linha ~1299) por leitura de env `process.env.COUPON_BRAND_CARD_ENABLED === 'true'`; adicionar parâmetro `couponTextSignal` à assinatura; substituir a guarda `COUPON_BRAND_CARD_ENABLED && primary?.linkKind === 'coupon'` (2 ocorrências: bloco do banner e argumento de `storePreviewTitle`) por uma única variável `useCouponBrandCard = shouldUseCouponBrandCard({ enabled, platform: primary?.platform, linkKind: primary?.linkKind, couponTextSignal, resolvedUrl: primary?.converted || primary?.url })`; manter `title: storePreviewTitle(...)` sempre presente (invariante #1186, FR-008); manter fallback silencioso quando `buildStoreBrandCardImage` retorna `null`/falha (FR-009) (depends on T002)
- [ ] T004 No call site de `buildManualLinkPreview` dentro de `startBotInner` (`src/bot-worker.js`, bloco `imageMode === 'preview'`, linha ~3227), calcular e passar `couponTextSignal = isCouponMsg || primary?.warning === 'ml_vitrine_fallback_used'` (reusa `isCouponMsg` já calculado via `isCouponAnnouncement` na linha ~2463, e o sinal de vitrine ML já emitido por `mercadolivre.js`/`mlVitrinePolicy.js` via `conversionResult.warning`, sem criar detector novo — Assumptions da spec) (depends on T003)

**Checkpoint**: Gate completo e com fail-safe (env OFF, loja não suportada, falha de geração, título sempre presente). US1/US2/US3 podem agora ser testadas/validadas independentemente sobre este mesmo gate.

---

## Phase 3: User Story 1 - Mensagem de cupom sai com banner de marca (Priority: P1) 🎯 MVP

**Goal**: Cupom de loja suportada (Amazon/Shopee/ML/Magalu), com texto confirmando cupom e URL sem ID de produto, sai com o banner "CUPOM + loja" em vez de foto errada/nenhuma foto.

**Independent Test**: Com `COUPON_BRAND_CARD_ENABLED=true` em staging, enviar mensagem de cupom real de cada loja suportada em grupo monitorado e confirmar no celular que o card sai com o banner.

### Tests for User Story 1

- [ ] T005 [P] [US1] Em `test/coupon-brand-card-policy.test.js` (novo arquivo), adicionar casos de `shouldUseCouponBrandCard` para cada loja suportada (amazon, shopee, mercadolivre, magazineluiza): `enabled=true`, `linkKind='coupon'`, `couponTextSignal=true`, `resolvedUrl` sem ASIN/MLB → retorna `true` (FR-001/FR-002/FR-007) (depends on T002)

### Implementation for User Story 1

- [ ] T006 [US1] Validação manual conforme `quickstart.md` seção 3 linha "US1 cupom": ligar `COUPON_BRAND_CARD_ENABLED=true` em staging (delete+start `api-staging`, pegadinha #1), enviar cupom real de cada loja suportada em grupo monitorado de staging, confirmar card com banner "CUPOM + loja" e `title` "Cupom <loja>" (FR-008) (depends on T004, T005)

**Checkpoint**: User Story 1 funcional e validada de ponta a ponta em staging.

---

## Phase 4: User Story 2 - Vitrine do Mercado Livre sai com banner (Priority: P1)

**Goal**: Link de vitrine ML (coleção/ofertas, sem produto único, `linkKind='coupon'`) sai com o mesmo banner "CUPOM + Mercado Livre", em vez de foto de produto aleatório raspada da vitrine.

**Independent Test**: Com a feature ligada, enviar link de vitrine ML real em grupo monitorado de staging e confirmar que o card sai com o banner, não com produto aleatório.

### Tests for User Story 2

- [ ] T007 [US2] Em `test/coupon-brand-card-policy.test.js`, adicionar caso: `platform='mercadolivre'`, `linkKind='coupon'`, `couponTextSignal=true` (via sinal `ml_vitrine_fallback_used`), `resolvedUrl` sem MLB → retorna `true`; e caso confirmando que o banner resultante é o MESMO (mesma chamada `buildStoreBrandCardImage('mercadolivre')`) usado no cenário de cupom — sem variação de visual entre cupom e vitrine (FR-002) (depends on T002, T005; mesmo arquivo de T005, não paralelizável)

### Implementation for User Story 2

- [ ] T008 [US2] Validação manual conforme `quickstart.md` seção 3 linha "US2 vitrine ML": enviar link de vitrine ML (coleção, sem produto único) em grupo monitorado de staging, confirmar banner "CUPOM + Mercado Livre" no lugar de produto aleatório da vitrine (depends on T004, T007)

**Checkpoint**: User Stories 1 e 2 funcionais e validadas, usando o mesmo gate.

---

## Phase 5: User Story 3 - Produto por short link continua saindo com FOTO (blindagem crítica) (Priority: P1)

**Goal**: Produto real (Amazon/ML) compartilhado por short link (`amzn.to`, `amzn.divulgador.link`, `meli.la`) — sem ASIN/MLB na URL, texto sem sinal de cupom — nunca recebe banner; continua saindo com a foto do produto. Não-regressão obrigatória de #1205/#1208.

**Independent Test**: Com a feature ligada, enviar produto Amazon e produto ML por short link (sem ASIN/MLB) e confirmar que ambos saem com foto do produto, nunca com banner.

### Tests for User Story 3

- [ ] T009 [P] [US3] Em `test/link-kind.test.js`, adicionar casos de `urlHasProductId`: URLs Amazon com `/dp/<ASIN>` e `/gp/product/<ASIN>` → `true`; URL ML com `MLB<id>` → `true`; short link sem ID (`amzn.to/...`, `meli.la/...`) → `false`; confirmar que `resolveLinkKind` permanece byte-a-byte inalterado (FR-010) (depends on T001)
- [ ] T010 [US3] Em `test/coupon-brand-card-policy.test.js`, adicionar os dois casos CRÍTICOS do contrato (FR-006/FR-012): (a) produto Amazon/ML por short link — `linkKind='coupon'` (por falta de ID na URL) mas `couponTextSignal=false` (texto não confirma cupom/vitrine) → `shouldUseCouponBrandCard` retorna `false`; (b) `linkKind='coupon'`, `couponTextSignal=true`, mas `resolvedUrl` CONTÉM ASIN ou MLB → retorna `false` (tratado como produto) (depends on T002, T007; mesmo arquivo, não paralelizável)
- [ ] T011 [US3] Estender `test/bot-worker-manual-link-preview-channel.test.js`: com `COUPON_BRAND_CARD_ENABLED=true`, simular produto Amazon e produto ML compartilhados por short link (sem ASIN/MLB, texto sem sinal de cupom) e confirmar que `buildManualLinkPreview` monta o card com a foto do produto (fetch de imagem via `fetchProductImage`), nunca com o banner de marca (depends on T003, T004)
- [ ] T012 [P] [US3] Rodar `node --test test/store-brand-card.test.js` e confirmar que o guard estrutural de `storePreviewTitle`/`title` continua verde e o arquivo não foi alterado (FR-011 — preservação, não remoção) (depends on T003)

### Implementation for User Story 3

- [ ] T013 [US3] Validação manual conforme `quickstart.md` seção 3 linha "US3 não-regressão": em staging com a feature ligada, enviar produto Amazon e produto ML por short link (sem ASIN/MLB na URL, texto sem "cupom") em grupo monitorado e confirmar no celular que ambos saem com foto do produto, nunca banner (depends on T009, T010, T011, T012)

**Checkpoint**: As três user stories (P1) funcionais e validadas sobre o mesmo gate; blindagem crítica contra a regressão #1205/#1208 confirmada por teste automatizado e manual.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentação, verificação de flag OFF/rollback e suíte completa.

- [ ] T014 [P] Documentar `COUPON_BRAND_CARD_ENABLED` no `AGENTS.md`: adicionar a linha ao bloco `.env` de staging como `COUPON_BRAND_CARD_ENABLED=true` (default em staging, FR-013) e uma nota no bloco `.env` de produção confirmando que permanece ausente/OFF até validação explícita
- [ ] T015 [P] Em `test/coupon-brand-card-policy.test.js`, adicionar caso explícito de FR-005/edge case "feature desligada": `enabled=false` (ou qualquer valor ≠ `'true'`) com as demais condições verdadeiras → retorna `false` sempre (depends on T002, T010; mesmo arquivo, não paralelizável com T010)
- [ ] T016 Rodar a suíte completa: `node --test test/coupon-brand-card-policy.test.js test/link-kind.test.js test/store-brand-card.test.js test/bot-worker-manual-link-preview-channel.test.js` e confirmar tudo verde (depends on T005, T007, T009, T010, T011, T012, T015)
- [ ] T017 Validação de rollback conforme `quickstart.md` seção 4 (SC-006): em staging, desligar `COUPON_BRAND_CARD_ENABLED` (remover ou `=false`), delete+start `api-staging`, confirmar que nenhuma mensagem (cupom/vitrine/produto) sai com banner — comportamento bit-a-bit igual ao histórico, reversão em menos de 1 minuto (depends on T006, T008, T013)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A — sem tarefas.
- **Foundational (Phase 2)**: T001 → T002 → T003 → T004, sequencial dentro da fase (T003/T004 tocam o mesmo arquivo `bot-worker.js`). **BLOQUEIA** todas as user stories.
- **User Stories (Phase 3-5)**: todas dependem de T004 (Foundational completo). Os testes automatizados de US1/US2/US3 compartilham o mesmo arquivo `test/coupon-brand-card-policy.test.js` (T005 → T007 → T010 → T015), então essa cadeia é sequencial mesmo entre fases de user story diferentes; as validações manuais (T006, T008, T013) e os testes em arquivos distintos (T009, T011, T012) podem avançar assim que seus pré-requisitos estiverem prontos.
- **Polish (Phase 6)**: depende de todas as user stories completas.

### User Story Dependencies

- **US1 (P1)**: depende só de Foundational (T001-T004). Primeira a ser validada (MVP).
- **US2 (P1)**: depende de Foundational + do arquivo de teste já iniciado por US1 (T005) — mesmo gate, mesmo arquivo de teste.
- **US3 (P1)**: depende de Foundational + testes anteriores no mesmo arquivo (T007) para o teste crítico de não-regressão (T010); é o requisito mais importante de não quebrar em produção, deve ser validado antes de promover a env para staging real.

### Parallel Opportunities

- T001 e T002 podem rodar em paralelo (arquivos diferentes: `linkKind.js` e novo `couponBrandCardPolicy.js`) — mas T002 só finaliza depois de T001 existir (import).
- T009 (`test/link-kind.test.js`) e T012 (rodar `test/store-brand-card.test.js`) podem rodar em paralelo com a cadeia de `coupon-brand-card-policy.test.js` (T005/T007/T010/T015), por serem arquivos diferentes.
- T014 (docs no AGENTS.md) é independente e pode rodar a qualquer momento após T004.

---

## Parallel Example: Foundational

```bash
# T001 e T002 podem começar juntos (T002 aguarda o export de T001 antes de importar):
Task: "Adicionar export urlHasProductId em src/converters/linkKind.js"
Task: "Criar src/converters/couponBrandCardPolicy.js com shouldUseCouponBrandCard"
```

## Parallel Example: User Story 3

```bash
# Arquivos de teste diferentes, sem dependência cruzada:
Task: "Adicionar casos urlHasProductId em test/link-kind.test.js"
Task: "Rodar test/store-brand-card.test.js e confirmar guard estrutural intacto"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 2: Foundational (T001-T004) — o gate inteiro nasce aqui.
2. Completar Phase 3: US1 (T005-T006).
3. **PARAR e VALIDAR**: confirmar em staging que cupom sai com banner.
4. US1 sozinha já entrega valor, mas **não** promover a env para produção até US3 (blindagem crítica) também estar validada — é o mesmo gate.

### Incremental Delivery

1. Foundational → gate pronto e com fail-safes.
2. US1 → banner de cupom funcionando → validar em staging.
3. US2 → banner de vitrine ML funcionando (mesmo gate, sem código novo além dos testes) → validar em staging.
4. US3 → prova formal (testes automatizados + manual) de que produto por short link nunca recebe banner → **obrigatório antes de considerar a feature pronta para produção**, dado o histórico de regressão #1205/#1208.
5. Polish → docs, rollback, suíte completa.

### Ordem sugerida (single-agent, sequencial)

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- As três user stories (todas P1) compartilham um único gate (`shouldUseCouponBrandCard`) implementado na fase Foundational — por isso a "independência" das fases é sobre TESTE/VALIDAÇÃO do cenário, não sobre código de produção duplicado.
- **Não promover para produção sem US3 (T009-T013) completa e verde** — é a blindagem contra a regressão #1205/#1208 documentada na spec.
- `resolveLinkKind` (`src/converters/linkKind.js`) e `storeBrandCard.js` NÃO são modificados além do novo export `urlHasProductId` (FR-010, FR-011).
- Rollback em produção = desligar `COUPON_BRAND_CARD_ENABLED` (sem redeploy, T017 valida o procedimento em staging).
