---

description: "Task list template for feature implementation"
---

# Tasks: Fallback de vitrine do Mercado Livre quando o SSID está vencido

**Input**: Design documents from `/specs/007-ml-vitrine-fallback-expired/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (todos presentes)

**Tests**: Incluídos — a spec pede cobertura explícita (SC-004) e a suite `test/ml-vitrine-fallback.test.js` já existe e será estendida.

**Organization**: Tasks agrupadas por user story (US1/US2/US3, todas P1 na spec, na ordem em que aparecem em spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1 | US2 | US3
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Projeto web existente (backend `src/` + `dashboard/`). Sem estrutura nova de diretórios — só edições pontuais nos arquivos já nomeados pelo plan.md.

---

## Phase 1: Setup

**Purpose**: Confirmar baseline antes de qualquer mudança.

- [X] T001 Rodar a suite existente como baseline (`node --test test/ml-vitrine-fallback.test.js`) e confirmar que os 6 casos da feature 004 passam antes de qualquer edição

**Checkpoint**: Baseline verde confirmado.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Módulo puro de decisão e taxonomia — pré-requisito de TODAS as user stories (nenhuma story tem comportamento sem isso).

**⚠️ CRITICAL**: Nenhuma user story pode começar até esta fase estar completa.

- [X] T002 [P] Criar `decideVitrineFallback({ failureType, isDirectVitrine, hasVitrine })` (função pura leaf, sem I/O) em `src/converters/mlVitrinePolicy.js`, implementando a tabela-verdade normativa de `contracts/decide-vitrine-fallback.md` (11 linhas: `use_vitrine` | `missing_vitrine` | `discard` | `passthrough`)
- [X] T003 [P] Criar `test/ml-vitrine-policy.test.js` cobrindo 1:1 as 11 linhas da tabela-verdade de `contracts/decide-vitrine-fallback.md`
- [X] T004 [P] Adicionar constante/branch explícito documentando o motivo `skip:ml_vitrine_missing` (categoria `config_block`, `isBenignSkip=true`) em `src/errorTaxonomy.js`, conforme `contracts/errormsg-vitrine-missing.md`

**Checkpoint**: Módulo `mlVitrinePolicy.js` testado isoladamente e taxonomia atualizada — user stories podem começar.

---

## Phase 3: User Story 1 - Oferta de vitrine de terceiro sai com a vitrine própria mesmo com SSID vencido (Priority: P1) 🎯 MVP

**Goal**: Vitrine direta de terceiro + SSID expirado + vitrine própria cadastrada → oferta sai com a vitrine própria (não é mais descartada).

**Independent Test**: Simular conversão de link de vitrine direta com SSID expirado e vitrine própria cadastrada; verificar que o resultado é o link da vitrine cadastrada com o aviso de fallback.

### Implementation for User Story 1

- [X] T005 [US1] Em `convertMlCouponWithoutProduct` (`src/converters/mercadolivre.js`, ~L983-1016): calcular `isDirectVitrine = isDirectVitrineShare(url)` e `hasVitrine = !!buildVitrineFallback(creds)`, chamar `decideVitrineFallback({ failureType: err.mlFailureType, isDirectVitrine, hasVitrine })` e, no outcome `'use_vitrine'`, retornar `buildVitrineFallback(creds)` (mantendo `warning: 'ml_vitrine_fallback_used'`) tanto para `unsupported_url` (comportamento 004 preservado) quanto para `expired` (novo, FR-001); outros outcomes seguem lançando o erro original por enquanto (preserva comportamento atual até US2/US3)
- [X] T006 [US1] Estender `test/ml-vitrine-fallback.test.js` com o caso: vitrine direta + `expired` + com vitrine própria → `convert()` retorna `{ url: <vitrine cadastrada>, warning: 'ml_vitrine_fallback_used' }`; e regressão explícita do caso 004 (`unsupported_url` + com vitrine → inalterado)

**Checkpoint**: User Story 1 completa e testável de forma independente — MVP entregável.

---

## Phase 4: User Story 2 - Motivo claro quando falta cadastrar a vitrine própria (Priority: P1)

**Goal**: Vitrine direta + SSID expirado (ou fora do programa) + SEM vitrine própria cadastrada → oferta ignorada com motivo específico e acionável, sem mencionar SSID.

**Independent Test**: Simular conversão de vitrine direta com SSID expirado e SEM vitrine cadastrada; verificar que o motivo no painel aponta para cadastrar a vitrine própria e não menciona SSID.

### Implementation for User Story 2

- [X] T007 [US2] Em `convertMlCouponWithoutProduct` (`src/converters/mercadolivre.js`): tratar outcome `'missing_vitrine'` lançando erro sinalizado com `err.mlFailureType` preservado, `err.conversionLogErrorMsg = 'skip:ml_vitrine_missing'` e `err.conversionLogStatus = 'skipped'` (depende de T005)
- [X] T008 [US2] No catch de conversão em `src/bot-worker.js` (~L2698-2708): antes de cair em `recordConversionIssue` genérico, checar `err.conversionLogErrorMsg`/`err.conversionLogStatus` e, se presentes, gravar `MessageLog` com esses valores pré-classificados em vez de `error:conversion:${err.message}` (depende de T007)
- [X] T009 [P] [US2] Adicionar branch `if (errorMsg.startsWith('skip:ml_vitrine_missing'))` em `explainErrorMsg` (`dashboard/lib/painel/logsCopy.js`) explicando que a oferta foi ignorada por falta de cadastro da vitrine própria e indicando o caminho Painel → IDs de afiliada → Mercado Livre; texto NÃO pode mencionar renovar/atualizar SSID
- [X] T010 [P] [US2] Adicionar branch equivalente em `dashboard/lib/mobileLogs.js` (texto mais curto, mesmo sentido, mesmo caminho de cadastro; NÃO mencionar SSID) — não esquecer este arquivo (2º renderizador)
- [X] T011 [US2] Estender `test/ml-vitrine-fallback.test.js` com o caso: vitrine direta + `expired` + sem vitrine própria → `errorMsg='skip:ml_vitrine_missing'`, `status='skipped'` (depende de T007, T008)
- [X] T012 [P] [US2] Adicionar teste unitário garantindo que as traduções de `logsCopy.js` e `mobileLogs.js` para `skip:ml_vitrine_missing` citam "cadastrar a vitrine" e NUNCA contêm "SSID"/"renove"/"cookie" (depende de T009, T010)

**Checkpoint**: User Story 2 completa e testável de forma independente.

---

## Phase 5: User Story 3 - Links que não são vitrine mantêm o comportamento atual (Priority: P1)

**Goal**: Link de produto não-vitrine com SSID expirado continua com o comportamento atual (mensagem de renovar SSID / fallback `partner_id`), sem regressão.

**Independent Test**: Simular conversão de link de produto não-vitrine com SSID expirado; verificar que o comportamento e a mensagem atuais permanecem inalterados.

### Implementation for User Story 3

- [X] T013 [US3] Estender `test/ml-vitrine-fallback.test.js` com o caso de regressão: produto não-vitrine (`isDirectVitrine=false`) + `expired` → outcome `passthrough`, mensagem de renovar SSID / fallback `partner_id` preservada (depende de T005, T007 já estarem implementados para confirmar que não regrediram este caminho)
- [X] T014 [P] [US3] Estender `test/ml-vitrine-fallback.test.js` (ou `test/ml-vitrine-policy.test.js`) com o caso de regressão: `unsupported_url` + não-vitrine + sem vitrine própria → outcome `discard` (descarte silencioso, RCA 2026-07-08) preservado e inalterado

**Checkpoint**: Todas as user stories (US1, US2, US3) funcionais e testáveis de forma independente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final cruzando os três cenários e checagem de não-regressão do caminho de produto.

- [X] T015 [P] Rodar toda a suíte relevante (`node --test test/ml-vitrine-policy.test.js`, `node --test test/ml-vitrine-fallback.test.js`) e confirmar os 4 cenários de `quickstart.md` (SC-004)
- [X] T016 Revisar o diff de `src/converters/mercadolivre.js` confirmando que o guard anti-regressão `!cleanTarget` (~L1031-1039, caminho de produto) permanece intocado (FR-008)
- [X] T017 Validação manual em staging conforme `quickstart.md` seção 3 (cadastrar/remover vitrine própria + SSID expirado real, clique real no celular) antes de promover para produção — PASSO MANUAL da usuária, fora do escopo do agente; deferido para validação em staging pós-merge (fluxo canônico AGENTS.md develop→staging→main)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: Depende do Setup — BLOQUEIA todas as user stories (T002/T003/T004 são a base de decisão e taxonomia que US1/US2/US3 consomem)
- **User Stories (Phase 3-5)**: Todas dependem da Foundational. Como compartilham o mesmo arquivo-alvo (`src/converters/mercadolivre.js`, função `convertMlCouponWithoutProduct`), a ordem de EDIÇÃO é sequencial: **US1 (T005) antes de US2 (T007)** — T007 estende o mesmo bloco de dispatch que T005 introduz. US3 (Phase 5) não adiciona código novo, só testes de regressão, e pode rodar depois de T005+T007 estarem no lugar.
- **Polish (Phase 6)**: Depende de US1+US2+US3 completas

### User Story Dependencies

- **US1 (P1)**: Depende só da Foundational. Introduz o dispatch de `decideVitrineFallback` em `mercadolivre.js`.
- **US2 (P1)**: Depende da Foundational E de T005 (US1) — estende o MESMO bloco de dispatch para tratar `missing_vitrine`. Testável de forma independente (seu próprio cenário: vitrine direta + expired + sem vitrine).
- **US3 (P1)**: Depende da Foundational E de T005+T007 já aplicados — mas é puramente confirmação de não-regressão (nenhum código novo), então não bloqueia nem é bloqueada em termos de implementação, só de sequência de teste.

### Within Each User Story

- Implementação de `mercadolivre.js` antes dos testes que a exercitam
- `bot-worker.js` (US2) depende do sinal (`conversionLogErrorMsg`) já existir em `mercadolivre.js`
- Tradutores de UI (`logsCopy.js`, `mobileLogs.js`) podem ser feitos em paralelo entre si (arquivos diferentes), mas depois do motivo canônico existir (T004/T007)

### Parallel Opportunities

- T002, T003, T004 (Foundational) podem rodar em paralelo — arquivos diferentes, sem dependência entre si
- T009 e T010 (US2, tradutores) podem rodar em paralelo — arquivos diferentes
- T012 e T014 podem rodar em paralelo com outras tasks de teste que não editem o mesmo arquivo simultaneamente
- T015 (Polish) pode rodar em paralelo com T016 (revisão de diff, leitura apenas)

---

## Parallel Example: Foundational

```bash
Task: "Criar decideVitrineFallback em src/converters/mlVitrinePolicy.js"
Task: "Criar test/ml-vitrine-policy.test.js com a tabela-verdade"
Task: "Adicionar branch skip:ml_vitrine_missing em src/errorTaxonomy.js"
```

## Parallel Example: User Story 2 (tradutores)

```bash
Task: "Branch skip:ml_vitrine_missing em dashboard/lib/painel/logsCopy.js"
Task: "Branch equivalente em dashboard/lib/mobileLogs.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (baseline)
2. Completar Phase 2: Foundational (CRÍTICO — bloqueia todas as stories)
3. Completar Phase 3: User Story 1 (T005-T006)
4. **PARAR e VALIDAR**: rodar `test/ml-vitrine-fallback.test.js` e confirmar o cenário US1 isoladamente
5. MVP entregável: vitrine própria já sai mesmo com SSID vencido (o núcleo do bug reportado)

### Incremental Delivery

1. Setup + Foundational → base pronta
2. US1 → testar isoladamente → MVP (resolve o descarte silencioso)
3. US2 → testar isoladamente → motivo honesto no painel quando falta vitrine
4. US3 → testes de regressão → confirma zero impacto no caminho de produto
5. Polish → validação cruzada + staging manual antes de prod

### Notes

- [P] = arquivos diferentes, sem dependência
- [Story] mapeia a task à user story correspondente
- Todas as três stories são P1 na spec — a ordem de fases segue a ordem em que aparecem em spec.md, não prioridade relativa
- Commitar após cada task ou grupo lógico
- Nenhuma task deve tocar o caminho de produto (`!cleanTarget` guard) — violação = bug, não feature
