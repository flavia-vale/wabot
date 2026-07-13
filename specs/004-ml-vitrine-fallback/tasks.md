---

description: "Task list for ml-vitrine-fallback feature implementation"
---

# Tasks: Fallback de vitrine do Mercado Livre não usado apesar de vitrine cadastrada

**Input**: Design documents from `/specs/004-ml-vitrine-fallback/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vitrine-fallback.md, quickstart.md (all present)

**Tests**: FR-007/SC-006 exigem teste automatizado (`node:test`) que falhe se a
regressão voltar — os testes abaixo são obrigatórios, não opcionais.

**Organization**: Tarefas agrupadas por user story (US3 primeiro, apesar de listada
por último na spec, porque é o pré-requisito de diagnóstico — FR-008 — que decide
qual correção aplicar em US1/US2; todas P1).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos/fontes diferentes, sem dependência)
- **[Story]**: US1, US2, US3 (mapeiam para spec.md)
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Projeto único (backend Node + dashboard Next), conforme `plan.md` → Project
Structure. Sem estrutura nova; a correção é cirúrgica sobre arquivos existentes.

---

## Phase 1: Setup

**Purpose**: Confirmar baseline antes de qualquer mudança de código.

- [ ] T001 Rodar a suíte existente do conversor ML para confirmar baseline verde antes do fix: `node --test test/mercadolivre-resolve.test.js test/mercadolivre-lock.test.js test/mercadolivre-session.test.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Estrutura de teste compartilhada por US1 e US2.

**⚠️ CRITICAL**: Bloqueia todo o trabalho de teste das user stories seguintes.

- [ ] T002 Criar `test/ml-vitrine-fallback.test.js` com os 6 casos do contrato (`contracts/vitrine-fallback.md`) como stubs/placeholders (sem asserts finais ainda), importando `src/converters/mercadolivre.js` (`buildVitrineFallback`, `isValidMlVitrineUrl`, `isDirectVitrineShare`, `convert`)

**Checkpoint**: Arquivo de teste pronto para receber os casos de US1/US2/US3.

---

## Phase 3: User Story 3 - Diagnóstico em produção antes de propor a correção (Priority: P1)

**Goal**: Confirmar com evidência real da VPS de produção qual ramo de código foi
executado no incidente de 12/07/2026 21:14 e declarar a causa raiz (hipótese A/B/C/D
de `research.md`) — sem isso, nenhuma correção de US1/US2 pode ser aplicada com
segurança (FR-008).

**Independent Test**: Os comandos de investigação da seção "Investigação obrigatória
em produção" de `research.md` são executados contra `~/wabot/prisma/prod.db` e
`/home/deploy/BOTinho-shared/logs/bot.log`, e a seção "Decisão de causa raiz" de
`research.md` é preenchida citando a evidência coletada (não suposição).

### Investigação para User Story 3

- [x] T003 [P] [US3] Executar a query do `MessageLog` da janela 12/07 21:10–21:20 (`research.md` §Investigação item 1) contra `~/wabot/prisma/prod.db` e registrar se há linha `warning:ml_vitrine_fallback_used` (destGroup='warning') coexistindo com linha `status='skipped'` da mesma mensagem/minuto — **feito**: existem duas linhas (`warning`/`skipped` às 21:14:48 e `success` real às 21:28:49), ver `research.md` §Decisão de causa raiz
- [x] T004 [P] [US3] Confirmar presença/validade de `vitrineUrl` na credencial ML da usuária (`research.md` §Investigação item 2) decifrando `Credential.data` via caminho da aplicação (`src/credentialHealth.js`/`src/credentialCrypto.js`), não presumindo texto puro — **feito**: `vitrineUrl` presente e válida (`https://mercadolivre.com/sec/1Psi79H`), refuta Hipóteses A/B
- [x] T005 [P] [US3] Grep em `/home/deploy/BOTinho-shared/logs/bot.log` pelo ramo executado (`research.md` §Investigação item 3: `vitrine|createLink|mlFailureType|unsupported_url|usando vitrine cadastrada|descartando|recusa ambígua`) na janela de 12/07 21:1x — **feito**: grep não retornou linhas (nível debug/rotação), mas o `MessageLog` (T003) já é evidência decisiva e suficiente
- [x] T006 [US3] Rastrear no código (`src/bot-worker.js` e `src/credentialHealth.js`) o caminho real que monta o objeto `creds` entregue a `convert()` e confirmar se `vitrineUrl` decifrado é propagado (`research.md` §Investigação item 4) — **feito**: propagação correta, confirmada indiretamente pelo envio de sucesso real (T003) usando a vitrine
- [x] T007 [US3] Preencher a seção "Decisão de causa raiz" de `specs/004-ml-vitrine-fallback/research.md` com a hipótese confirmada (A/B/C/D), citando as linhas de log/registro de banco coletadas em T003-T006 (depende de T003, T004, T005, T006) — **feito**: Hipótese D confirmada (com precisão: notificação mal rotulada, não desalinhamento de decisão)

**Checkpoint (concluído)**: Causa raiz declarada em `research.md` com evidência real de produção. **Resumo para as próximas fases**: a oferta de vitrine JÁ é entregue com sucesso (não há bug de substituição/decisão); o bug é que a linha de notificação `warning:ml_vitrine_fallback_used` (e demais `warning:*`) é gravada com `status='skipped'` hardcoded e o painel renderiza isso com o badge "Ignorado", contradizendo o texto explicativo e o envio real que aconteceu em paralelo/depois. T014 (hipótese A/B) portanto **não se aplica** — pular. T013/T015 devem implementar: introduzir um status não-skip (ex. `'info'`) para linhas `destGroup='warning'`, atualizado em `src/bot-worker.js` e refletido em toda a cadeia de exibição (`logsCopy.js`, `SendHistory.js`, `mobileLogs.js`, `/api/logs/summary`), sem alterar a lógica de conversão/fallback do Mercado Livre.

---

## Phase 4: User Story 1 - Oferta de vitrine sai usando a vitrine cadastrada da afiliada (Priority: P1) 🎯 MVP

**Goal**: Quando o link é comprovadamente vitrine/perfil de terceiro não convertível
E a usuária tem `vitrineUrl` válido cadastrado, a oferta sai com a vitrine (status de
sucesso), nunca "ignorado"; a mensagem exibida é sempre coerente com o desfecho real.

**Independent Test**: Simular mensagem de vitrine ML não convertível com credencial
contendo `vitrineUrl` válido e verificar que a oferta é enviada com o link da
vitrine e o `MessageLog` fica com status de sucesso (não "ignorado").

**Depende de**: Phase 3 (causa raiz declarada em `research.md`).

### Tests for User Story 1 ⚠️ (escrever ANTES da implementação, devem falhar primeiro)

- [ ] T008 [P] [US1] Teste "vitrine cadastrada + recusa `unsupported_url` de vitrine direta → fallback retorna `{url: vitrineUrl, warning:'ml_vitrine_fallback_used'}`" em `test/ml-vitrine-fallback.test.js` (contrato caso 1, FR-001)
- [ ] T009 [P] [US1] Teste "`vitrineUrl` ausente + recusa ambígua (não `/social/`) → `buildVitrineFallback`/`convert` retornam `null` (descarte seguro), sem afirmar vitrine" em `test/ml-vitrine-fallback.test.js` (contrato caso 3, FR-006)
- [ ] T010 [P] [US1] Teste "`vitrineUrl` malformada → `isValidMlVitrineUrl` falso → `buildVitrineFallback` `null` → descarte seguro, copy não afirma envio" em `test/ml-vitrine-fallback.test.js` (contrato caso 4, edge case)
- [ ] T011 [P] [US1] Teste de coerência mensagem×status (causa raiz confirmada, `research.md`): a linha de notificação `warning:ml_vitrine_fallback_used` deve ser gravada com `status='info'` (nunca `'skipped'`), exercitando a função responsável pela escrita em `src/bot-worker.js` (~linha 2599-2617) via teste isolado/mock de `db.messageLog.create` em `test/ml-vitrine-fallback.test.js` (contrato caso 5, FR-004) — cobre também os outros 5 `warning:*` existentes (mesma função, mesmo bug)
- [ ] T012 [P] [US1] Teste "invariante de segurança: em nenhum caso o retorno de `convert()`/`buildVitrineFallback` contém o link de terceiro original" em `test/ml-vitrine-fallback.test.js` (contrato caso 6, FR-003)

### Implementation for User Story 1

> **Causa raiz confirmada em produção (T007/research.md)**: a oferta de vitrine
> JÁ é entregue com sucesso — não há bug de decisão/substituição. O bug é que a
> linha de NOTIFICAÇÃO (`destGroup='warning'`, escrita em `src/bot-worker.js`
> ~2599-2617 para QUALQUER `warning:*`, não só vitrine) é gravada com
> `status='skipped'` hardcoded, e o painel renderiza isso com o badge
> "Ignorado" — contradizendo o texto explicativo ("a oferta saiu...") e o envio
> real que ocorre em paralelo/depois. T014 (hipótese A/B) não se aplica —
> vitrineUrl chega corretamente a `creds`; pular.

- [ ] T013 [US1] Em `src/bot-worker.js` (~linha 2602-2613), gravar as linhas de notificação (`destGroup='warning'`) com um status não-skip dedicado (`status: 'info'`) em vez de `'skipped'` hardcoded — preserva `errorMsg='warning:<kind>'` (taxonomia inalterada) para os 6 tipos existentes (`ml_ssid_expired`, `amazon_cookies_expired`, `ml_affiliate_forbidden`, `ml_affiliate_rate_limited`, `ml_affiliate_busy`, `ml_vitrine_fallback_used`) — nenhum é uma decisão de descarte de oferta
- [x] T014 [US1] ~~Se a causa raiz confirmada for Hipótese A/B~~ — **N/A**: vitrineUrl chega corretamente a `creds` (confirmado em T004/T006); nenhuma correção de propagação/validação necessária
- [ ] T015 [US1] Propagar o novo status `'info'` pela cadeia de exibição sem inflar "Ignorados": `dashboard/lib/painel/logsCopy.js` (`STATUS_TAG` — adicionar entrada `info` com label não-"ignorado", ex. "aviso"; `STATUS_TABS` — decidir se aparece em "Todos" mas nunca em "Ignorados"), `dashboard/app/painel/envios/SendHistory.js` (filtro/contagem por status), `dashboard/lib/mobileLogs.js` (equivalente mobile), e o endpoint `/api/logs/summary` (não contar `status='info'` como bloqueada/ignorada). Copy de `explainErrorMsg` para `ml_vitrine_fallback_used` permanece correta (já diz "saiu usando sua vitrine") — o problema era só o badge de status, não o texto (FR-004)
- [ ] T016 [US1] Rodar `node --test test/ml-vitrine-fallback.test.js` e confirmar que os testes T008-T012 passam após T013-T015

**Checkpoint**: User Story 1 funcional e testável de forma independente — oferta de
vitrine com vitrine cadastrada sai com sucesso, nunca "ignorado", copy coerente.

---

## Phase 5: User Story 2 - Link de produto legítimo nunca é substituído pela vitrine (Priority: P1)

**Goal**: Link de produto ML conversível continua saindo com o link de produto
convertido (afiliado da usuária); a vitrine cadastrada NUNCA substitui um link de
produto legítimo, mesmo com `vitrineUrl` válida presente.

**Independent Test**: Processar mensagem com link de produto ML conversível e
verificar que o link enviado é o link de produto convertido, e que
`buildVitrineFallback` NÃO é acionado.

**Depende de**: Phase 4 (não pode regredir o que T013-T015 corrigiram).

### Tests for User Story 2 ⚠️ (escrever ANTES da implementação, devem falhar primeiro)

- [ ] T017 [P] [US2] Teste "link de produto conversível + `vitrineUrl` cadastrada → `buildVitrineFallback` NÃO é chamado; `convert()` retorna o link de produto convertido (afiliado da usuária)" em `test/ml-vitrine-fallback.test.js` (contrato caso 2, FR-002/FR-005)
- [ ] T018 [P] [US2] Teste "link ML ambíguo (aterrissagem incerta, não claramente vitrine/perfil) → fallback de vitrine NÃO substitui o link; mantém descarte seguro existente sem culpar vitrine/credencial" em `test/ml-vitrine-fallback.test.js` (Acceptance Scenario 2 de US2, FR-006)

### Implementation for User Story 2

- [ ] T019 [US2] Revisar `convert()`/`resolveToCleanProductUrl()` em `src/converters/mercadolivre.js` para garantir que o ramo de vitrine só é alcançado quando `cleanTarget` é nulo (sem produto) — guarda explícita contra qualquer regressão introduzida por T013/T014 (depende de T013, T014)
- [ ] T020 [US2] Rodar `node --test test/mercadolivre-resolve.test.js test/mercadolivre-lock.test.js test/mercadolivre-session.test.js` e confirmar zero regressão nos caminhos de produto (FR-005)
- [ ] T021 [US2] Rodar `node --test test/ml-vitrine-fallback.test.js` e confirmar que os testes T017-T018 passam

**Checkpoint**: User Stories 1 e 2 funcionam de forma independente e sem regressão
mútua — vitrine usada só quando é de fato vitrine; produto nunca é substituído.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final ponta a ponta conforme `quickstart.md`.

- [ ] T022 Rodar a suíte completa relevante: `node --test test/ml-vitrine-fallback.test.js test/mercadolivre-resolve.test.js test/mercadolivre-lock.test.js test/mercadolivre-session.test.js` e confirmar tudo verde (quickstart.md Passo 1)
- [ ] T023 Executar a validação manual em staging do `quickstart.md` Passo 2 e Passo 3 (após merge em `develop` → autodeploy staging): oferta de vitrine sai com sucesso, produto não é substituído, credencial sem vitrine orienta cadastro, nenhuma coexistência warning×skipped, link de terceiro nunca aparece no `convertedUrl`
- [ ] T024 Após staging validado, seguir `quickstart.md` Passo 4 (PR `develop` → `main`, FR-009) e confirmar em produção que uma oferta de vitrine com vitrine cadastrada sai corretamente (não "ignorado")

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode iniciar imediatamente
- **Foundational (Phase 2)**: Depende de Setup — bloqueia as user stories (arquivo de teste compartilhado)
- **User Story 3 (Phase 3)**: Depende de Foundational — é o pré-requisito de diagnóstico que **bloqueia** a correção de US1/US2 (FR-008)
- **User Story 1 (Phase 4)**: Depende de Phase 3 (causa raiz declarada em T007)
- **User Story 2 (Phase 5)**: Depende de Phase 4 (não pode regredir a correção aplicada em US1)
- **Polish (Phase 6)**: Depende de todas as user stories completas

### User Story Dependencies

- **User Story 3 (P1 — diagnóstico)**: Bloqueia US1 e US2; sem causa raiz confirmada, nenhuma correção de código deve ser aplicada (FR-008)
- **User Story 1 (P1 — fix principal)**: Depende de US3; entrega o MVP (oferta de vitrine sai com sucesso)
- **User Story 2 (P1 — anti-regressão)**: Depende de US1 (valida que a correção de US1 não introduziu falso positivo em produto)

> Nota: embora a spec liste US1/US2/US3 nessa ordem de prioridade textual, todas são
> P1 e a ordem de EXECUÇÃO real é US3 → US1 → US2, porque US3 é o pré-requisito de
> evidência (FR-008) e US2 é a garantia anti-regressão sobre o que US1 mudou.

### Within Each User Story

- Testes escritos e devem falhar ANTES da implementação (T008-T012 antes de T013-T015; T017-T018 antes de T019)
- Investigação (US3) antes de qualquer correção de código
- Implementação de US1 antes da revisão anti-regressão de US2

### Parallel Opportunities

- T003, T004, T005 (US3) podem rodar em paralelo — fontes de evidência independentes (banco, credencial, log)
- T008-T012 (testes US1) podem ser escritos em paralelo — mesmo arquivo, mas casos de teste independentes entre si (aplicar com cautela: escrever em blocos separados dentro do mesmo `describe`/`test()` para evitar conflito de merge)
- T017-T018 (testes US2) podem rodar em paralelo entre si

---

## Parallel Example: User Story 3

```bash
# Lançar as três investigações independentes em paralelo:
Task: "Query MessageLog da janela 12/07 21:10-21:20 em prisma/prod.db"
Task: "Confirmar vitrineUrl na Credential ML decifrada"
Task: "Grep no bot.log pelo ramo executado (vitrine/createLink/unsupported_url)"
```

## Parallel Example: User Story 1 (testes)

```bash
# Escrever os 5 casos de teste de US1 (mesma suíte, casos independentes):
Task: "Teste: vitrine cadastrada + recusa unsupported_url de vitrine direta"
Task: "Teste: vitrineUrl ausente + recusa ambígua → descarte seguro"
Task: "Teste: vitrineUrl malformada → descarte seguro"
Task: "Teste: coerência mensagem×status (warning não coexiste com skipped)"
Task: "Teste: invariante de segurança (nunca retorna link de terceiro)"
```

---

## Implementation Strategy

### MVP First (User Story 3 → User Story 1)

1. Completar Phase 1: Setup (baseline verde)
2. Completar Phase 2: Foundational (arquivo de teste criado)
3. Completar Phase 3: User Story 3 (causa raiz confirmada em produção — CRÍTICO, bloqueia tudo abaixo)
4. Completar Phase 4: User Story 1 (fix principal — MVP)
5. **PARE e VALIDE**: rodar `test/ml-vitrine-fallback.test.js`, testar US1 isoladamente em staging
6. Deploy/demo se pronto

### Incremental Delivery

1. Setup + Foundational → base pronta
2. US3 (diagnóstico) → causa raiz documentada em `research.md` (pré-requisito, não "entregável" de produto)
3. US1 → oferta de vitrine sai com sucesso → validar isoladamente → deploy/demo (MVP!)
4. US2 → garantia anti-regressão de produto → validar isoladamente → deploy/demo
5. Cada story soma valor sem quebrar a anterior

---

## Notes

- [P] = arquivos/fontes diferentes, sem dependência entre si
- [Story] mapeia a tarefa à user story correspondente para rastreabilidade
- Todos os testes de contrato (`contracts/vitrine-fallback.md`, 6 casos) estão distribuídos entre US1 (casos 1, 3, 4, 5, 6) e US2 (caso 2) — T008-T012 e T017
- A correção NUNCA deve regredir a invariante de segurança (link de terceiro nunca encaminhado — FR-003, coberto por T012) nem o comportamento conservador de recusa ambígua (RCA 2026-07-08 — FR-006, coberto por T009/T018)
- Verificar que os testes falham antes de implementar (T008-T012, T017-T018 antes de T013-T015, T019)
- Rodar `node --test` após cada bloco de implementação, não só no final
- Parar em cada checkpoint para validar a story isoladamente antes de avançar
