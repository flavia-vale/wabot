---

description: "Task list for feature: Fixar modo de imagem da oferta em 'Preview clicável do WhatsApp'"
---

# Tasks: Fixar modo de imagem da oferta em "Preview clicável do WhatsApp"

**Input**: Design documents from `/specs/001-image-mode-preview-default/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/image-mode-behavior.md, quickstart.md

**Branch**: `claude/speckit-flow-image-default-0bdady`

**Tests**: Incluídos — o repo tem suite `node:test` estabelecida e o plano lista suites específicas a ajustar/manter verdes.

**Organization**: Tasks agrupadas por user story (US1–US4 do spec.md), em ordem de prioridade (P1, P1, P1, P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1/US2/US3/US4 (mapeado ao spec.md)

## Path Conventions

Monorepo único: `src/` (backend/worker), `dashboard/` (Next.js), `prisma/` (schema + migrations), `test/` (node:test), raiz do repo.

---

## Phase 1: Setup

**Purpose**: Nenhuma inicialização de projeto necessária — infra já existe. Apenas confirmar baseline antes de tocar em código.

- [X] T001 Rodar a suite relevante como baseline (deve estar verde antes de qualquer mudança): `node --test test/group-entitlements.test.js test/bot-worker-manual-link-preview-channel.test.js test/image-scrapers.test.js test/groups-route.test.js 2>&1 | tail -40` (ajustar nome do arquivo de rota de grupos se divergir — confirmar com `ls test/ | grep -i group`)

**Checkpoint**: Baseline confirmado — pode prosseguir para o chokepoint (Foundational).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: O chokepoint em `resolveGroupEntitlements()` é o requisito bloqueante (FR-001/FR-009) — TODAS as user stories dependem dele para a "Independent Test" ficar honesta (sem ele, US1/US3/US4 não têm garantia de runtime).

**⚠️ CRITICAL**: Nenhuma user story deve ser considerada completa/testável sem esta fase pronta.

- [X] T002 Em `src/billing/groupEntitlements.js`, na função `toMonitorGroup()` (linha ~9), trocar `imageMode: group.imageMode ?? 'original'` por `imageMode: 'preview'` (sempre, ignorando o valor persistido) — atualizar/substituir o comentário existente (linhas ~13-18) para explicar que a escolha do cliente foi desativada (FR-001), que o valor efetivo é sempre `'preview'` (defesa em profundidade, FR-009), e referenciar `specs/001-image-mode-preview-default`
- [X] T003 [P] Ajustar `test/group-entitlements.test.js` para cobrir a nova invariante: para qualquer `group.imageMode` de entrada (`'fetch'`, `'original'`, `'none'`, `null`, valor legado desconhecido, `'preview'`), `toMonitorGroup()`/`resolveGroupEntitlements()` deve devolver `imageMode: 'preview'` no `cfg` resultante (INV-1 do data-model.md)

**Checkpoint**: `node --test test/group-entitlements.test.js` verde — o pipeline de envio já é honesto quanto a FR-001/FR-009 mesmo antes de qualquer outra mudança (defesa em profundidade already in place). As user stories abaixo podem prosseguir.

---

## Phase 3: User Story 1 - Oferta sempre sai como preview clicável (Priority: P1) 🎯 MVP

**Goal**: Toda oferta espelhada, independentemente do `imageMode` histórico do grupo, sai como card de preview clicável do WhatsApp.

**Independent Test**: Com um grupo monitorado que antes estava em `fetch`/`original`/`none`, disparar uma oferta e confirmar que ela sai como card de preview clicável (foto do produto + texto com título/preço, clique abre o link).

### Tests for User Story 1

- [X] T004 [P] [US1] Em `test/bot-worker-manual-link-preview-channel.test.js`, adicionar/ajustar casos cobrindo os 3 cenários de aceitação do spec: grupo antes em `fetch` → sai como preview; grupo antes em `none` → sai como preview; grupo já em `preview` → comportamento idêntico (sem regressão)

### Implementation for User Story 1

- [X] T005 [US1] Em `src/bot-worker.js`, no trecho `getImage` (linha ~2496: `if (!monitorGroup || ['none', 'preview'].includes(monitorGroup.imageMode)) return null`), adicionar comentário explicando que — como `resolveGroupEntitlements()` (T002) já força `imageMode: 'preview'` — este `return null` é o único ramo que roda em runtime; o restante da função (`fetch`/scrape de imagem oficial) fica dormente/preservado (FR-006), não removê-lo
- [X] T006 [US1] Em `src/bot-worker.js`, no trecho por volta da linha ~3013-3126 (`const imageMode = monitorGroup?.imageMode ?? 'original'`, `wantImage`, ramo `shouldRelayOriginalMediaForImageMode`, ramo `imageMode === 'original'`), adicionar comentário no topo do bloco explicando que `imageMode` chega sempre `'preview'` (via chokepoint T002) e que os ramos `fetch`/`original`/`none` ficam dormentes/preservados para reativação futura (FR-006) — não alterar a lógica condicional em si, só documentar
- [X] T007 [US1] Em `src/monitoredRelayPolicy.js`, na função `shouldRelayOriginalMediaForImageMode()` (linha ~4), adicionar comentário explicando que, com `imageMode` sempre `'preview'` a partir do chokepoint, esta função nunca retorna `true` em runtime (relay de mídia original fica dormente, FR-006) — preservar a lógica intacta
- [X] T008 [US1] Rodar `node --test test/bot-worker-manual-link-preview-channel.test.js test/group-entitlements.test.js` e confirmar verde (US1-AC1, US1-AC2, US1-AC3)

**Checkpoint**: User Story 1 completa e testável de forma independente — qualquer grupo, seja qual for o `imageMode` histórico, sai como preview clicável.

---

## Phase 4: User Story 2 - Migração graciosa dos clientes existentes (Priority: P1)

**Goal**: Todos os grupos existentes que não estão em `preview` são migrados de forma segura (idempotente, sem perda de dados) para `preview`.

**Independent Test**: Rodar a migração numa base de teste com grupos em todos os quatro modos e confirmar, via consulta ao banco, que todos passam a `imageMode = 'preview'` e nenhuma outra coluna foi alterada.

### Tests for User Story 2

- [X] T009 [P] [US2] Criar teste de migração (se o repo já tiver padrão de teste de migration Prisma, seguir o mesmo; caso contrário criar `test/migrations-group-image-mode-preview.test.js`) que: aplica a migration em um banco SQLite de teste populado com grupos em `'fetch'`, `'original'`, `'none'`, `null` e `'preview'`; confirma que todos ficam `'preview'`; roda a migration 2x e confirma idempotência (mesmo resultado, sem erro) — cobre AC-1 e AC-2 de US2

### Implementation for User Story 2

- [X] T010 [US2] Criar a migration Prisma em `prisma/migrations/20260710160000_group_image_mode_preview_default/migration.sql` com o SQL do data-model.md: comentário explicando o motivo (fixação em `preview`, referência a `specs/001-image-mode-preview-default`) seguido de `UPDATE "Group" SET "imageMode" = 'preview' WHERE "imageMode" IS NULL OR "imageMode" <> 'preview';` — seguir o precedente de `prisma/migrations/20260628120000_group_image_mode_choice/migration.sql`
- [X] T011 [US2] Em `prisma/schema.prisma` (linha ~94), trocar `imageMode String @default("none")` por `imageMode String @default("preview")` no model `Group`
- [X] T012 [US2] Rodar `npx prisma migrate dev` (ou `npx prisma validate` + `npx prisma migrate diff` conforme o fluxo local do repo) para confirmar que a migration criada em T010 bate com o schema alterado em T011 sem gerar migration adicional divergente
- [X] T013 [US2] Rodar o teste de T009 e confirmar idempotência local (`node --test test/migrations-group-image-mode-preview.test.js` ou equivalente)

**Checkpoint**: User Story 2 completa — migration versionada, idempotente, pronta para `prisma migrate deploy` no fluxo de deploy automático (staging→prod), sem tocar em outras colunas.

---

## Phase 5: User Story 3 - Seletor de imagem some do painel (Priority: P1)

**Goal**: O bloco "Imagem da oferta" deixa de aparecer na configuração de grupo em `/painel/grupos`.

**Independent Test**: Abrir a configuração de qualquer grupo no painel e confirmar que o bloco "Imagem da oferta" (seletor + textos auxiliares) não aparece mais; salvar outra config continua funcionando.

### Implementation for User Story 3

- [X] T014 [US3] Em `dashboard/app/painel/grupos/page.js`, remover o bloco `<CfgRow label="Imagem da oferta" ...> ... </CfgRow>` inteiro (linhas ~316-351: select `imageMode`, textos `info`/`hint`, avisos condicionais `cfg-inline-warn` de `preview` e `fetch`) — mover a prop `last` (que hoje marca o fim da `CfgSection`) para o `CfgRow` anterior (`primaryLinkTarget`, linha ~296-314) para preservar o estilo visual de "último item da seção"
- [X] T015 [US3] Conferir se algum outro trecho do mesmo arquivo referencia `g.imageMode` fora do bloco removido (ex.: preview/resumo do card do grupo) e, se houver, decidir manter (leitura, não editável) ou remover conforme o contexto — documentar a decisão no commit
- [X] T016 [US3] Validação manual local do painel (dev): abrir a tela de configuração de um grupo e confirmar visualmente que "Imagem da oferta" não aparece e que outras configs (destinos, palavras bloqueadas, `primaryLinkTarget`) continuam editáveis e salvando (US3-AC1, US3-AC2)

**Checkpoint**: User Story 3 completa — seletor não existe mais na UI; salvamento de outras configs intacto.

---

## Phase 6: User Story 4 - Novos grupos nascem em preview (Priority: P2)

**Goal**: Todo grupo monitorado novo nasce com `imageMode = 'preview'`, em qualquer caminho de criação (painel/API).

**Independent Test**: Criar um novo grupo monitorado via painel e via API e confirmar que `imageMode` nasce como `preview`.

### Tests for User Story 4

- [X] T017 [P] [US4] Ajustar/adicionar teste de rota de criação de grupo (arquivo de teste de `src/api/routes/groups.js` — localizar com `ls test/ | grep -i group` e usar o existente, ou criar `test/groups-route-image-mode.test.js`) cobrindo: criar grupo com `role='monitor'` sem `imageMode` explícito → `imageMode` persistido é `'preview'`; criar grupo com `role` diferente de `monitor` sem `imageMode` → também `'preview'` (US4-AC1, US4-AC2)

### Implementation for User Story 4

- [X] T018 [US4] Em `src/api/routes/groups.js` (linha ~105), trocar `imageMode: role === 'monitor' ? 'original' : 'none'` por `imageMode: 'preview'` no `data` do `create` de grupo
- [X] T019 [US4] Rodar o teste de T017 e confirmar verde; confirmar que o `@default("preview")` do schema (T011) cobre qualquer caminho de criação que não passe `imageMode` explicitamente (defesa em profundidade adicional a T018)

**Checkpoint**: User Story 4 completa — todo novo grupo nasce em `preview` por dois níveis (app + schema).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentação (FR-007), validação de não-regressão (FR-005/SC-004/SC-005) e roteiro fim-a-fim do quickstart.md.

- [X] T020 [P] Adicionar seção em `AGENTS.md` documentando a decisão: `imageMode` fixado em `'preview'` para todos os grupos (chokepoint em `src/billing/groupEntitlements.js`), motivo (padronizar comportamento, reduzir suporte), migration idempotente aplicada, e que o código de extração das outras fontes (scrapers Amazon/ML/Shopee, buffers, relay de mídia original) permanece no repositório **dormente/preservado** para reativação futura — seguir o estilo canônico das outras seções do arquivo (ver seções "D-3", "Image scrapers" como referência de formato)
- [X] T021 [P] Confirmar que `test/image-scrapers.test.js` continua verde sem nenhuma alteração (código dormente preservado, SC-005): `node --test test/image-scrapers.test.js`
- [X] T022 Rodar a suite completa afetada de uma vez para confirmar não-regressão: `node --test test/group-entitlements.test.js test/bot-worker-manual-link-preview-channel.test.js test/image-scrapers.test.js test/groups-route*.test.js test/migrations-group-image-mode-preview.test.js 2>&1 | tail -60` (ajustar nomes de arquivo conforme criados nas fases anteriores)
- [X] T023 Seguir o roteiro `specs/001-image-mode-preview-default/quickstart.md` passo 2 (idempotência da migração numa base de teste local) antes de abrir o PR para `develop`
- [ ] T024 Abrir PR da branch `claude/speckit-flow-image-default-0bdady` contra `develop` (nunca direto para `main`, conforme fluxo canônico do AGENTS.md) — após merge, validar em staging (`http://178.105.54.0:3006`) seguindo os passos 3-5 do quickstart.md (painel, novo grupo, envio real) antes de promover para `main`

**Checkpoint final**: Todas as user stories P1 (US1-US3) e P2 (US4) completas, documentação atualizada, testes verdes, pronto para revisão/staging.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — roda primeiro.
- **Foundational (Phase 2)**: Depende de Setup. **BLOQUEIA** todas as user stories — é o chokepoint que garante FR-001/FR-009 (defesa em profundidade) para qualquer teste subsequente ser honesto.
- **User Story 1 (Phase 3)**: Depende de Foundational. Não depende de US2/US3/US4.
- **User Story 2 (Phase 4)**: Depende de Foundational. Independente de US1/US3/US4 (migração de dados é ortogonal ao chokepoint em runtime, mas ambos devem existir para SC-001 ficar completo).
- **User Story 3 (Phase 5)**: Depende de Foundational. Independente de US1/US2/US4 (só UI).
- **User Story 4 (Phase 6)**: Depende de Foundational. Independente de US1/US2/US3, mas reaproveita o `@default("preview")` do schema alterado em T011 (US2) como defesa em profundidade adicional — pode rodar em paralelo, mas T019 (validação do fallback via schema) idealmente roda depois de T011.
- **Polish (Phase 7)**: Depende de todas as user stories desejadas estarem completas.

### User Story Dependencies

- **US1 (P1)**: Sem dependência de outras stories.
- **US2 (P1)**: Sem dependência de outras stories.
- **US3 (P1)**: Sem dependência de outras stories.
- **US4 (P2)**: Soft-dependency de US2 (T011 altera o `@default` do schema que T019 valida), mas a mudança de app-level (T018) é independente.

### Within Each User Story

- Testes antes da implementação (escritos primeiro, devem falhar antes da mudança).
- Chokepoint (Foundational) sempre executa antes de qualquer story.
- Checkpoint de cada story roda a suite de teste relevante antes de avançar.

### Parallel Opportunities

- T003 (teste de US foundational) pode rodar em paralelo com a escrita de T002 sendo revisada, mas fisicamente depende de T002 existir para o teste passar — marcado [P] por ser arquivo diferente, mas sequenciar T002→T003 na prática.
- Fases 3, 4, 5 e 6 (US1, US2, US3, US4) são independentes entre si e podem ser feitas em paralelo por pessoas/agentes diferentes após a Fase 2 (Foundational) estar completa.
- T020 e T021 (Polish, documentação e confirmação de scrapers) podem rodar em paralelo entre si.

---

## Parallel Example: Após Foundational (Phase 2) completa

```bash
# Podem rodar em paralelo (arquivos diferentes, sem dependência cruzada):
Task: "US1 — comentar ramos dormentes em src/bot-worker.js e src/monitoredRelayPolicy.js"
Task: "US2 — criar migration em prisma/migrations/20260710160000_group_image_mode_preview_default/"
Task: "US3 — remover bloco 'Imagem da oferta' em dashboard/app/painel/grupos/page.js"
Task: "US4 — trocar default de criação em src/api/routes/groups.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (baseline verde).
2. Completar Phase 2: Foundational (chokepoint — CRÍTICO, bloqueia tudo).
3. Completar Phase 3: User Story 1 (comportamento de runtime garantido).
4. **PARAR e VALIDAR**: rodar suite de US1, confirmar que qualquer `imageMode` histórico produz preview clicável.
5. Nesse ponto o requisito de negócio central (FR-001/FR-009) já está em produção-ready, mesmo sem migração de dados nem remoção de UI — a defesa em profundidade do chokepoint garante que a coluna residual nunca afeta o pipeline.

### Incremental Delivery

1. Setup + Foundational → fundação pronta (chokepoint no ar).
2. US1 → testar independentemente → é o coração da mudança (MVP).
3. US2 → migração de dados → testar idempotência → resolve o resíduo na coluna para SC-001.
4. US3 → remover UI → testar visualmente → resolve a face visível para o cliente (SC-003).
5. US4 → default de criação → testar → fecha o ciclo para novos grupos (SC-002).
6. Polish → documentação (FR-007) + validação fim-a-fim (quickstart.md) → PR para `develop` → staging → `main`.

### Parallel Team Strategy

Com múltiplos agentes/desenvolvedores, após Foundational (Phase 2):

- Agente A: US1 (bot-worker.js, monitoredRelayPolicy.js — comentários de dormência)
- Agente B: US2 (migration Prisma + schema)
- Agente C: US3 (painel Next.js)
- Agente D: US4 (rota de criação de grupo)

Todas convergem na Phase 7 (Polish) para documentação e validação conjunta.

---

## Notes

- [P] tasks = arquivos diferentes, sem dependência.
- [Story] label mapeia a task à user story correspondente do spec.md para rastreabilidade.
- O chokepoint (T002) é o requisito mais crítico do plano — sem ele, nenhuma "Independent Test" das user stories é verdadeiramente honesta quanto a FR-009 (defesa em profundidade).
- Não remover nenhum ramo de código de extração de imagem (scrapers, buffers, relay) — apenas comentar como dormente (FR-006, regra inviolável de `imageScrapers.js` no AGENTS.md).
- Migration é DML puro (`UPDATE`), convive com WAL — não precisa parar API para aplicar, mas o fluxo padrão de deploy (`deploy_safe_staging.sh`) já lida com isso.
- Seguir o fluxo canônico `feature → develop (staging) → main (prod)` do AGENTS.md — nunca abrir PR direto para `main`.
