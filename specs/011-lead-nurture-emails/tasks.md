---

description: "Task list for Sequência de e-mail de nutrição de leads (BOTinho)"
---

# Tasks: Sequência de e-mail de nutrição de leads (BOTinho)

**Input**: Design documents from `/specs/011-lead-nurture-emails/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Incluídas — o quickstart.md e o plan.md nomeiam explicitamente os 4 arquivos de teste
esperados (db-free/SMTP-free), e o repo segue TDD como padrão canônico.

**Organization**: Tasks agrupadas por user story (spec.md). Zero DDL/migration em toda a feature
(FR-008) — nenhuma task cria/edita `prisma/schema.prisma` ou `prisma/migrations/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência)
- **[Story]**: US1 (P1 — trilha), US2 (P1 — LGPD/opt-out), US3 (P2 — operação leve/idempotência)

## Path Conventions

Repositório único, monolito Fastify em `src/`. Testes em `test/` (raiz), padrão `node --test`.

---

## Phase 1: Setup

**Purpose**: Confirmar que não há dependência nova nem infraestrutura a inicializar.

- [ ] T001 Criar o diretório `src/leadNurture/` (vazio) e confirmar que `src/email/mailer.js`
      (transporte no-op), `crypto` nativo e o Prisma Client (`src/db.js`) já cobrem tudo que a
      feature precisa — nenhuma entrada nova em `package.json`.

**Checkpoint**: Nenhuma dependência/infra nova necessária; pronto para o Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Módulos puros e a allowlist de eventos que TODAS as user stories consomem.

**⚠️ CRITICAL**: Nenhuma user story pode ser implementada antes desta fase.

- [ ] T002 [P] Adicionar `nurture_email_sent` e `nurture_unsubscribed` à allowlist
      `ANALYTICS_EVENTS` em `src/analytics.js` (contracts/analytics-events.md). Não tocar em
      `PUBLIC_ANALYTICS_EVENTS`.
- [ ] T003 [P] Criar `src/leadNurture/unsubscribeToken.js`: `signUnsubscribeToken(userId, secret)` e
      `verifyUnsubscribeToken(token, secret)` (HMAC-SHA256, comparação em tempo constante, puro,
      sem I/O) — contracts/nurture-engine.md, data-model.md E5.
- [ ] T004 [P] Criar `src/email/nurtureEmails.js`: constante `NURTURE_STEPS` (steps 0/2/5/7,
      `milestoneDays`, `theme`) e `buildNurtureEmail(step, { name, unsubscribeUrl, dashboardUrl })`
      puro, pt-BR, marca BOTinho, espelhando o padrão de `src/email/welcomeEmail.js` — todo
      `text`/`html` MUST conter `unsubscribeUrl` (FR-004).
- [ ] T005 [P] Criar `src/leadNurture/policy.js`: `isRealEmail(email)` (rejeita `@sistema.com` e
      formato inválido), `isWithinActiveWindow(createdAt, now, {maxDays=8})`,
      `elapsedDays(createdAt, now)`, `computeDueSteps({createdAt, now, sentSteps, isUnsubscribed})`
      — todas puras/determinísticas, sem `Date.now()` interno (data-model.md, contracts/nurture-engine.md).
- [ ] T006 [P] Escrever `test/lead-nurture-policy.test.js`: `isRealEmail` (real, `@sistema.com`,
      formato inválido), `isWithinActiveWindow`, `elapsedDays`, `computeDueSteps` para
      `elapsedDays` 0/2/5/7 combinados com `sentSteps` variados e `isUnsubscribed=true/false`
      (depende de T005).
- [ ] T007 [P] Escrever `test/nurture-emails.test.js`: cada um dos 4 passos gera `subject/text/html`
      pt-BR com marca BOTinho e `unsubscribeUrl` presente em `text` **e** `html` (depende de T004).
- [ ] T008 [P] Escrever a parte de round-trip do token em `test/lead-nurture-unsubscribe.test.js`:
      `verify(sign(userId)) === userId`; token adulterado/malformado → `null` (depende de T003).

**Checkpoint**: Módulos puros prontos e testados isoladamente (db-free) — nenhuma user story
depende de banco/SMTP até este ponto.

---

## Phase 3: User Story 1 - Lead frio recebe a trilha automática (Priority: P1) 🎯 MVP

**Goal**: Um lead com e-mail real recebe automaticamente os passos dia 0 (via welcome existente),
2, 5 e 7 — uma única vez cada, na ordem certa, conteúdo pt-BR BOTinho.

**Independent Test**: Registrar um lead com e-mail real, avançar o relógio simulado dia a dia
(`now` injetado) e confirmar que cada passo (0, 2, 5, 7) é enviado uma única vez, na ordem certa.

### Implementation for User Story 1

- [ ] T009 [US1] Implementar `runNurtureSweep({db, sendMail, now, logger, secret, baseUrl})` em
      `src/leadNurture/sweep.js`: busca leads na janela ativa (`User.createdAt` entre `now-8d` e
      `now`, e-mail real via `isRealEmail`), carrega `sentSteps(userId)` e `isUnsubscribed(userId)`
      lendo `AnalyticsEvent`, chama `computeDueSteps`, monta `unsubscribeUrl` +
      `buildNurtureEmail`, chama `sendMail`, e só grava `AnalyticsEvent nurture_email_sent{step}`
      quando o envio NÃO for `res.skipped` (contracts/nurture-engine.md, contracts/analytics-events.md).
- [ ] T010 [US1] Adicionar `startLeadNurtureSweep()` em `src/api/server.js`: roda `runNurtureSweep`
      uma vez no boot (best-effort, `.catch` que só loga) e agenda via
      `setInterval(run, LEAD_NURTURE_SWEEP_INTERVAL_MS ?? 24h)` com `timer.unref?.()`, espelhando
      `startLogRetentionJob`/`startActivityCacheCleanup` (mesmo arquivo, linhas ~148-173). Chamar a
      função uma vez perto de `startLogRetentionJob()`/`startActivityCacheCleanup()` (linhas ~361-362).
- [ ] T011 [US1] Em `src/api/routes/auth.js`, logo após o `sendWelcomeEmail(...)` fire-and-forget no
      `/register` (linha ~484), semear `AnalyticsEvent { userId, event: 'nurture_email_sent',
      metadata: { step: 0 } }` para o lead recém-criado quando o e-mail for real (reaproveitar
      `isRealEmail` de T005) — marca o dia 0 como coberto pelo welcome (D4), evitando duplicidade.
- [ ] T012 [US1] Escrever `test/lead-nurture-sweep.test.js` (parte 1 — trilha feliz): com `db`/
      `sendMail` fakes injetados, simular `now` avançando (entrada → +2d → +5d → +7d) e confirmar
      que os passos 2, 5 e 7 saem exatamente uma vez cada, na ordem certa, e que nenhum passo extra
      é enviado após a trilha completa (acceptance scenarios 1-4 da US1).

**Checkpoint**: US1 funcional e testável de forma independente (sem depender da rota de
unsubscribe existir).

---

## Phase 4: User Story 2 - Respeitar consentimento e descadastro (LGPD) (Priority: P1)

**Goal**: Todo e-mail da trilha carrega link de descadastro; uma vez descadastrado, o contato
nunca mais recebe passo algum, mesmo que volte a baixar material.

**Independent Test**: Descadastrar um contato no meio da trilha (após o dia 0) e confirmar que os
passos seguintes não são enviados a ele, enquanto outros leads ativos seguem recebendo.

### Implementation for User Story 2

- [ ] T013 [US2] Criar `src/api/routes/leadNurture.js` com `GET /api/lead-nurture/unsubscribe`:
      valida `token` via `verifyUnsubscribeToken` (T003), em caso válido grava (idempotente)
      `AnalyticsEvent { userId, event: 'nurture_unsubscribed', metadata: { via: 'link' } }` e
      responde 200 com HTML pt-BR BOTinho de confirmação; token ausente/malformado/HMAC inválido →
      400 com HTML genérico, sem revelar se o `userId` existe (contracts/unsubscribe-endpoint.md).
- [ ] T014 [US2] Registrar a rota pública (sem auth) de `src/api/routes/leadNurture.js` no
      `src/api/server.js`, junto ao registro das demais rotas.
- [ ] T015 [US2] Em `src/api/routes/auth.js`, condicionar a semeadura do passo 0 (T011) a
      `!isUnsubscribed(userId)` — usar o mesmo lookup de `AnalyticsEvent nurture_unsubscribed` que
      `sweep.js` usa, exportado de `src/leadNurture/sweep.js` para reuso — para que um lead que
      volta a baixar material depois de descadastrado não reinicie a trilha (US2 cenário 3).
- [ ] T016 [P] [US2] Completar `test/lead-nurture-unsubscribe.test.js` (parte 2 — rota HTTP): token
      válido grava o evento exatamente uma vez mesmo com 2 chamadas (idempotente), responde 200
      pt-BR; token inválido/ausente responde 400 sem vazar `userId`/e-mail (contracts/unsubscribe-endpoint.md).
- [ ] T017 [US2] Completar `test/lead-nurture-sweep.test.js` (parte 2 — opt-out): um lead com
      `nurture_unsubscribed` registrado não recebe nenhum passo futuro (`computeDueSteps=[]`)
      enquanto outro lead ativo, no mesmo `now`, continua recebendo normalmente (US2 cenário 2 e 3;
      depende de T012 e T015).

**Checkpoint**: US1 + US2 funcionais e testáveis de forma independente e em conjunto — LGPD
satisfeita antes de qualquer envio real em produção.

---

## Phase 5: User Story 3 - Operação leve, à prova de reexecução e sem envio duplicado (Priority: P2)

**Goal**: A passada roda dentro da própria API (sem processo/worker/Redis novo), nunca envia o
mesmo passo duas vezes, mesmo sob reexecução no mesmo dia, execução dupla ou reinício da API, e
falha em item isolado não aborta os demais.

**Independent Test**: Rodar a passada diária duas vezes seguidas no mesmo dia e após um reinício
simulado da API; confirmar que cada passo elegível é enviado no máximo uma vez por contato e que
nenhum processo/worker/serviço novo é criado.

### Implementation for User Story 3

- [ ] T018 [US3] Completar `test/lead-nurture-sweep.test.js` (parte 3 — dupla execução): rodar
      `runNurtureSweep` duas vezes com o mesmo `now` — a 2ª rodada deve ter `sent=0` para os passos
      já enviados na 1ª (FR-006, SC-002; depende de T012/T017).
- [ ] T019 [US3] Completar `test/lead-nurture-sweep.test.js` (parte 4 — reinício simulado): com
      `sentSteps` pré-populado (ex.: `{0,2}` via fakes de `AnalyticsEvent`), confirmar que a
      passada retoma no próximo passo elegível (5) sem reenviar 0/2 (US3 cenário 2).
- [ ] T020 [US3] Completar `test/lead-nurture-sweep.test.js` (parte 5 — passada perdida): com
      `elapsedDays=6` e nada enviado além do passo 0, confirmar que dia 2 e dia 5 saem juntos na
      mesma passada (FR-011).
- [ ] T021 [US3] Completar `test/lead-nurture-sweep.test.js` (parte 6 — no-op sem SMTP): com
      `sendMail` fake devolvendo `{skipped:true}` para tudo, confirmar que a passada termina sem
      lançar erro e **sem** gravar nenhum `nurture_email_sent` (FR-007, SC-006).
- [ ] T022 [US3] Completar `test/lead-nurture-sweep.test.js` (parte 7 — isolamento por item): um
      lead cujo `sendMail` lança exceção não impede os demais leads elegíveis de serem processados
      na mesma passada; o erro aparece em `failures[]` do retorno (FR-009).
- [ ] T023 [US3] Executar as verificações de restrições canônicas do quickstart.md §2: `grep
      "name:" ecosystem.config.cjs` (nenhum app novo), `grep -n "startLeadNurtureSweep\|setInterval\|unref"
      src/api/server.js`, `grep -rn "bullmq\|ioredis" src/leadNurture src/email/nurtureEmails.js`
      (vazio) — confirma SC-005.

**Checkpoint**: As 3 user stories funcionam de forma independente e em conjunto; restrições de
memória/infra (AGENTS.md) confirmadas.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final de zero-DDL, execução completa da suíte e runbook de staging.

- [ ] T024 [P] Executar as verificações "zero DDL" do quickstart.md §3: `git status --porcelain
      prisma/` (sem migration nova), `grep -c "nurture" prisma/schema.prisma` (deve ser 0), `grep -n
      "nurture_email_sent\|nurture_unsubscribed" src/analytics.js` (os 2 eventos presentes) —
      confirma FR-008.
- [ ] T025 [P] Documentar, como comentário perto de `startLeadNurtureSweep()` em
      `src/api/server.js`, as envs opcionais aditivas `LEAD_NURTURE_SWEEP_INTERVAL_MS` (default
      24h) e `LEAD_NURTURE_GO_LIVE_AT` (ISO, opcional — filtra leads pré-existentes) — sem alterar
      nenhum `.env` de ambiente (FR-010).
- [ ] T026 Rodar a suíte completa: `node --test test/nurture-emails.test.js
      test/lead-nurture-policy.test.js test/lead-nurture-sweep.test.js
      test/lead-nurture-unsubscribe.test.js` e o restante de `test/` para confirmar ausência de
      regressão (db-free/SMTP-free, quickstart.md §1).
- [ ] T027 Seguir o quickstart.md §4 em staging (COM `SMTP_*` configurado, apps de staging de pé):
      cadastrar lead real, confirmar dia 0 + `nurture_email_sent{step:0}`; forçar a passada com
      `now` simulado em +2d/+5d/+7d; clicar no link de descadastro e reexecutar a passada; validar
      SC-001 a SC-006 antes de abrir PR `develop → main` (fluxo canônico do AGENTS.md).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — BLOQUEIA todas as user stories.
- **US1 (Phase 3)**: depende do Foundational. Não depende de US2/US3.
- **US2 (Phase 4)**: depende do Foundational e de T011 (seedagem do passo 0 em `auth.js`, editada
  por T015) — na prática construída após US1, mas testável de forma independente (o teste de
  opt-out em T017 usa fakes de `AnalyticsEvent`, não exige a rota HTTP para validar `sweep.js`).
- **US3 (Phase 5)**: depende de `sweep.js` (T009, US1) existir — são testes de resiliência sobre o
  mesmo motor.
- **Polish (Phase 6)**: depende de todas as stories desejadas estarem completas.

### User Story Dependencies

- **US1 (P1)**: pode começar após o Foundational — sem dependência de US2/US3.
- **US2 (P1)**: pode começar após o Foundational; integra com o `auth.js`/`sweep.js` de US1 mas o
  contrato de opt-out (`isUnsubscribed`) já está embutido em `computeDueSteps` desde o Foundational.
- **US3 (P2)**: depende de US1 (T009) existir para ter o que exercitar sob reexecução/reinício.

### Within Each User Story

- Módulos puros (Foundational) → sweep/rota (efeitos) → testes de integração da story.
- Cada story deve terminar num checkpoint funcional antes de avançar para a próxima prioridade.

### Parallel Opportunities

- Foundational: T002, T003, T004, T005 tocam arquivos diferentes e podem rodar em paralelo; T006,
  T007, T008 (testes) também são paralelos entre si (arquivos diferentes) uma vez prontos T004/T005/T003.
- US2: T016 (arquivo `test/lead-nurture-unsubscribe.test.js`) pode rodar em paralelo com T017
  (arquivo `test/lead-nurture-sweep.test.js`) — arquivos diferentes.
- US3: T018-T022 editam o MESMO arquivo (`test/lead-nurture-sweep.test.js`) em sequência — não
  marcar como paralelos entre si.
- Polish: T024 e T025 tocam arquivos diferentes e podem rodar em paralelo.

---

## Parallel Example: Foundational

```bash
# Após T001, disparar em paralelo (arquivos diferentes):
Task: "Adicionar eventos à allowlist em src/analytics.js"            # T002
Task: "Criar src/leadNurture/unsubscribeToken.js"                    # T003
Task: "Criar src/email/nurtureEmails.js"                             # T004
Task: "Criar src/leadNurture/policy.js"                              # T005

# Depois, os testes puros correspondentes (arquivos diferentes):
Task: "test/lead-nurture-policy.test.js"                             # T006
Task: "test/nurture-emails.test.js"                                  # T007
Task: "test/lead-nurture-unsubscribe.test.js (round-trip)"           # T008
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRÍTICO — bloqueia todas as stories)
3. Completar Phase 3: US1 — leads já começam a receber a trilha automaticamente
4. **PARAR e VALIDAR**: `node --test test/lead-nurture-sweep.test.js` (parte 1) isoladamente
5. **Não subir para produção sem US2** (LGPD é requisito legal inegociável, mesma prioridade P1) —
   mas US1 já é um incremento tecnicamente completo e testável isoladamente.

### Incremental Delivery

1. Setup + Foundational → base pronta (zero DDL, zero processo novo).
2. US1 → trilha envia dia 0/2/5/7 → testar isoladamente.
3. US2 → opt-out/unsubscribe → testar isoladamente e em conjunto com US1 → **só a partir daqui vai
   para produção** (P1 + P1, ambos obrigatórios antes do go-live real).
4. US3 → resiliência (dupla execução, reinício, no-op sem SMTP, isolamento por item) → testar em
   conjunto com US1+US2.
5. Polish → zero-DDL confirmado, suíte completa, runbook de staging antes do PR `develop → main`.

### Parallel Team Strategy

Com mais de uma pessoa: depois do Foundational, uma pessoa segue US1 (`sweep.js` + wiring do
timer + seedagem do passo 0) enquanto outra prepara a rota de US2 (`leadNurture.js`) apontando
para os mesmos helpers de `AnalyticsEvent` já definidos no Foundational — ambas convergem no
mesmo `sweep.js`/`auth.js` para os testes de integração de US2 (T015, T017).

---

## Notes

- [P] = arquivos diferentes, sem dependência entre as tasks.
- [Story] mapeia a task à user story para rastreabilidade (spec.md).
- Zero migration/DDL em qualquer task (FR-008) — nenhuma task toca `prisma/schema.prisma` ou cria
  arquivo em `prisma/migrations/`.
- Nenhuma task cria processo/app PM2/worker/Redis novo (FR-003, FR-012, SC-005).
- Confirmar que os testes falham antes de implementar (TDD) sempre que a ordem do arquivo permitir
  (builders/policy/token puros primeiro, depois sweep/rota).
- Commitar após cada task ou grupo lógico; parar em cada checkpoint para validar a story isolada.
