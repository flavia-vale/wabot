---

description: "Task list template for feature implementation"
---

# Tasks: Blindar escrita de MessageLog contra crash em loop do bot-worker

**Input**: Design documents from `/specs/006-worker-crash-log-safety/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Solicitados explicitamente pela spec (FR-008/SC-004) — incluídos.

**Organization**: Tasks agrupadas por user story para permitir implementação e
teste independentes de cada uma.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1 ou US2
- Caminhos de arquivo exatos incluídos em cada descrição

## Path Conventions

Projeto único (monolito Node): `src/`, `test/` na raiz do repositório.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nenhuma inicialização de projeto necessária — repositório já existe,
dependências já resolvidas, sem dependência nova (ver plan.md Technical Context).

- [ ] T001 Confirmar `node --test` roda localmente sem falhas antes de iniciar (baseline) a partir da raiz do repositório

**Checkpoint**: Baseline verde confirmado — pode prosseguir para Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Criar o módulo leaf `src/messageLogSanitizer.js` que hospeda a lógica
pura de sanitização (D4 do research.md) — pré-requisito de US1 (a correção da
causa raiz) e reaproveitado por todos os call-sites já existentes em
`src/bot-worker.js`, incluindo o handler de broadcast de US2.

**⚠️ CRITICAL**: Nenhuma implementação de user story pode começar antes desta fase.

- [ ] T002 Criar `src/messageLogSanitizer.js`: extrair `MESSAGE_LOG_MAX_CHARS` (linha 743 de `src/bot-worker.js`) e a assinatura de `sanitizeMessageForLog(text)` (linhas 745-750) para o novo módulo, exportando ambos. Implementar nesta task apenas a extração 1:1 (comportamento antigo preservado) — a correção do truncamento por code point é feita em T004 (US1)
- [ ] T003 Editar `src/bot-worker.js`: remover a definição local de `MESSAGE_LOG_MAX_CHARS`/`sanitizeMessageForLog` (linhas 743-750) e adicionar `import { sanitizeMessageForLog, MESSAGE_LOG_MAX_CHARS } from './messageLogSanitizer.js'` no topo do arquivo, preservando a mesma assinatura em todos os ~14 call-sites (linhas 625, 2369, 2431, 2500, 2661, 2757, 2880, 2930, 3140, 3423, 3644 e demais)

**Checkpoint**: `node --test` continua verde (nenhum call-site quebrado); módulo
leaf existe e é importado por `bot-worker.js`. US1 e US2 podem começar.

---

## Phase 3: User Story 1 - Emoji na mensagem não derruba mais o robô (Priority: P1) 🎯 MVP

**Goal**: `sanitizeMessageForLog` nunca produz surrogate solto nem caractere de
controle/`NUL`, mesmo truncando exatamente no meio de um par surrogate de emoji,
e o resultado nunca excede `MESSAGE_LOG_MAX_CHARS`.

**Independent Test**: Truncar um texto exatamente no meio de um par surrogate de
emoji e confirmar que o valor resultante não contém surrogate solto e é aceito
pelo Prisma (via `node --test test/message-log-sanitizer.test.js`).

### Tests for User Story 1 ⚠️

> **NOTE: Escrever este teste PRIMEIRO; confirmar que falha antes de T004.**

- [ ] T004 [P] [US1] Criar `test/message-log-sanitizer.test.js` (`node:test`) cobrindo: (a) corte exatamente no meio de um par surrogate de emoji → sem surrogate solto e dentro do limite; (b) texto composto majoritariamente de emojis/multi-byte → truncagem por code point, não code unit; (c) texto com `NUL`/caracteres de controle → removidos do resultado; (d) `null`/`''`/não-string → retorna `''` sem lançar; (e) texto sanitizado nunca excede `MESSAGE_LOG_MAX_CHARS`

### Implementation for User Story 1

- [ ] T005 [US1] Implementar em `src/messageLogSanitizer.js` a sanitização correta (D1/D2/D3 do research.md): `String(text ?? '')` → normalizar whitespace/trim → remover controle/`NUL` (regex de classe de controle) → truncar por code point (`Array.from`/spread, não `slice`) para ≤ `MESSAGE_LOG_MAX_CHARS` code points → remover surrogate solto residual (`/[\uD800-\uDFFF]/g` sobre o que sobrou fora de pares válidos) → anexar `…` só se houve truncagem (depende de T002; faz T004 passar)

**Checkpoint**: `node --test test/message-log-sanitizer.test.js` passa; `node
--test` inteiro continua verde; User Story 1 é funcional e testável de forma
independente.

---

## Phase 4: User Story 2 - Falha ao gravar log nunca derruba o worker nem a fila (Priority: P1)

**Goal**: Uma falha em `db.messageLog.create()` no handler `type:'broadcast'`
(~linha 3636 de `src/bot-worker.js`) é capturada localmente, logada, e o loop de
`jids` continua — sem `unhandledRejection`, sem `process.exit`, sem perda dos
demais jobs da fila em memória.

**Independent Test**: Forçar a escrita de log do caminho de broadcast a lançar
uma exceção e confirmar que o worker continua rodando e a fila em memória
permanece intacta (nenhum `process.exit`), verificado estruturalmente (T007) e
via quickstart.md item 3 em staging.

### Implementation for User Story 2

- [ ] T006 [US2] Editar `src/bot-worker.js` (~linha 3636, dentro do `for (const jid of msg.jids)` do handler `msg?.type === 'broadcast'`): envolver a chamada `await db.messageLog.create({...})` em `try/catch` local — no `catch`, `logger.warn`/`error` com `err.message` e o `jid` (sem PII crua), registrar o `jid` em `errors` com um `errorMsg` apropriado (sem inventar novo prefixo de taxonomia, ver `src/errorTaxonomy.js`) e usar `continue` para seguir para o próximo `jid` sem chamar `enqueueSendJob` para este (não há `log.id` válido); garantir que nenhum `throw`/`process.exit` escape deste bloco
- [ ] T007 [P] [US2] Adicionar teste estrutural em `test/bot-worker-broadcast-log-safety.test.js` (padrão de grep-de-source, análogo a `test/bot-worker-retry-cache-wiring.test.js`, já que `bot-worker.js` não é importável em `node:test`) que lê `src/bot-worker.js` e falha se o `await db.messageLog.create(` do handler `type:'broadcast'` não estiver dentro de um bloco `try` seguido de `catch` sem `process.exit`/`throw` não capturado (depende de T006)

**Checkpoint**: `node --test` inteiro verde; falha simulada de escrita de log
(inspeção estrutural) não encerra o worker; User Story 1 e User Story 2 ambas
funcionais e testáveis de forma independente.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validação final cruzando as duas correções e confirmando os
critérios de sucesso mensuráveis da spec.

- [ ] T008 Rodar `node --test` completo (suíte inteira) e confirmar 0 falhas, incluindo os testes novos de T004 e T007 (SC-004)
- [ ] T009 Executar o passo 1 do `quickstart.md` (`node --test test/message-log-sanitizer.test.js`) e o snippet de sanidade rápida (`node -e "..."`) e confirmar `lone surrogate? false`
- [ ] T010 Documentar no PR a validação manual do item 3 do `quickstart.md` (defesa em profundidade do broadcast) a ser feita em staging antes do merge `develop`→`main`, conforme fluxo canônico do `AGENTS.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: Depende de Setup — BLOQUEIA US1 e US2 (T002/T003 criam o módulo leaf que ambas as stories tocam)
- **User Story 1 (Phase 3)**: Depende de Foundational completo
- **User Story 2 (Phase 4)**: Depende de Foundational completo — independente de US1 (arquivo/linhas diferentes dentro de `bot-worker.js`, mas ambas tocam o mesmo arquivo, então não são [P] entre si)
- **Polish (Phase 5)**: Depende de US1 e US2 completas

### User Story Dependencies

- **User Story 1 (P1)**: Pode começar após Foundational (Phase 2) — sem dependência de US2
- **User Story 2 (P2 na prática, mas também marcada P1 na spec)**: Pode começar após Foundational (Phase 2) — sem dependência funcional de US1, mas edita o mesmo arquivo (`src/bot-worker.js`), então sequenciar T003→T005→T006 evita conflito de merge

### Within Each User Story

- US1: teste (T004) escrito e falhando antes da implementação (T005)
- US2: implementação (T006) antes do teste estrutural (T007), pois o teste verifica a forma final do código

### Parallel Opportunities

- T004 (teste US1) pode ser escrito em paralelo com T006 (implementação US2) — arquivos diferentes (`test/message-log-sanitizer.test.js` vs `src/bot-worker.js`), mas ambos dependem de T002/T003 concluídos
- T007 (teste estrutural US2) é [P] em relação a T004/T005 (arquivos de teste diferentes)

---

## Parallel Example: Foundational → User Stories

```bash
# Após T002 e T003 (Foundational) concluídos:
Task: "Criar test/message-log-sanitizer.test.js cobrindo corte de surrogate, controle/NUL, limite e entradas inválidas"   # T004 [US1]
Task: "Envolver db.messageLog.create() do handler broadcast em try/catch"                                                 # T006 [US2]
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Completar Phase 1: Setup (T001)
2. Completar Phase 2: Foundational (T002, T003 — CRÍTICO, bloqueia as duas stories)
3. Completar Phase 3: User Story 1 (T004, T005)
4. **PARAR e VALIDAR**: `node --test test/message-log-sanitizer.test.js` verde — a causa raiz do crash em loop está corrigida
5. Deploy/demo se pronto (mas ver Incremental Delivery — US2 é defesa em profundidade e ambas são P1 na spec)

### Incremental Delivery

1. Setup + Foundational → módulo leaf pronto, `bot-worker.js` importando dele
2. Adicionar User Story 1 → testar isoladamente (`node --test test/message-log-sanitizer.test.js`) → corrige a causa raiz do RCA
3. Adicionar User Story 2 → testar isoladamente (teste estrutural + quickstart item 3 em staging) → defesa em profundidade contra qualquer falha futura de escrita de log
4. Phase 5 (Polish): suíte completa + validação de quickstart.md + nota de validação em staging no PR

### Parallel Team Strategy

Como ambas as stories editam `src/bot-worker.js` no mesmo arquivo (embora em
regiões diferentes: linha ~745 vs ~3636), recomenda-se sequenciar Foundational
→ US1 → US2 num único desenvolvedor/PR para evitar conflitos de merge, em vez de
paralelizar entre pessoas.

---

## Notes

- [P] tasks = arquivos diferentes, sem dependências
- [Story] label mapeia a task à user story correspondente
- Cada user story é completável e testável de forma independente
- Confirmar que o teste de T004 falha antes de implementar T005 (TDD)
- Commit após cada task ou grupo lógico
- Nenhuma migration, nenhuma troca de porta, nenhuma mudança de `QUEUE_BACKEND` (NG-001/NG-002/NG-003) — não incluído nas tasks acima de propósito
- Fluxo de entrega: branch `claude/coupon-message-delivery-oo0o3d` → PR contra `develop` → validação em staging (quickstart.md item 3) → PR `develop`→`main`, conforme `AGENTS.md`
