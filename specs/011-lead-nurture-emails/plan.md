# Implementation Plan: Sequência de e-mail de nutrição de leads (BOTinho)

**Branch**: `011-lead-nurture-emails` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-lead-nurture-emails/spec.md`

## Summary

Trilha automática fixa de 4 e-mails pt-BR da marca BOTinho (dia 0 / 2 / 5 / 7) para leads com
e-mail real, disparada por um **timer in-process na API** com passada diária
(`setInterval` + `.unref()`, mesmo padrão de `startLogRetentionJob`/`startActivityCacheCleanup`
em `src/api/server.js`). Reaproveita o transporte `src/email/mailer.js` (no-op sem SMTP) e o
padrão puro de `src/email/welcomeEmail.js`. **Zero migration/DDL**: o estado da sequência (qual
passo já saiu) e o opt-out são derivados de eventos duráveis `AnalyticsEvent` (dois eventos novos
na allowlist de `src/analytics.js`), com o e-mail do lead lido de `User.email` (durável, único) —
nunca da metadata do evento, que sanitiza/descarta `email`. O e-mail de boas-vindas já disparado
no `/register` passa a valer como o **passo dia 0**; a passada cuida só dos dias 2/5/7. Idempotência
natural (não reenvia passo já registrado), isolamento por item, e nenhum processo/worker/Redis novo.

## Technical Context

**Language/Version**: Node.js (ESM), mesma toolchain do repo (`src/`), sem transpiler.

**Primary Dependencies**: `nodemailer` (via `src/email/mailer.js`, já presente); Prisma Client
(`src/db.js`); `crypto` nativo (HMAC do token de unsubscribe). Nenhuma dependência nova.

**Storage**: SQLite via Prisma. **Sem tabela/coluna nova.** Leitura de `User` (email, createdAt) +
`AnalyticsEvent` (progresso e opt-out). Escrita só de `AnalyticsEvent` (via `writeAnalyticsEvent`).

**Testing**: `node --test` (suíte existente em `test/`), db-free / SMTP-free. Builders de e-mail e
lógica de elegibilidade são funções puras testadas isoladamente; a passada é testada com `db` e
`sendMail` injetados/fakes.

**Target Platform**: processo PM2 `api` (prod) / `api-staging` (staging), Linux VPS.

**Project Type**: web-service (backend monolito Fastify em `src/`).

**Performance Goals**: passada diária O(N_leads_da_janela); janela ≈ 8 dias de cadastros. Custo de
memória em regime **desprezível** (um `setInterval` `unref()`, sem heap retido, sem cache grande).

**Constraints** (canônicas — AGENTS.md "Política de memória", regra #1):
- PROIBIDO: novo processo/app PM2, cron dedicado, worker, Redis/BullMQ, cache em memória grande.
- No-op silencioso sem SMTP; só e-mails reais (nunca `user_*@sistema.com`).
- Não alterar `.env`/portas/deploy; fluxo `feature → develop → main`.

**Scale/Scope**: dezenas a centenas de leads/dia no horizonte atual; a passada varre só a janela
de 8 dias, então o custo cresce com o fluxo diário, não com a base histórica.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` é o **template não preenchido** (placeholders), sem
princípios ratificados. Não há gates formais da constituição a avaliar. Aplicam-se, no lugar, as
**regras canônicas do `AGENTS.md`** como gates de fato:

| Gate canônico (AGENTS.md) | Status | Como o plano satisfaz |
|---|---|---|
| Memória — regra #1 (super sinalizar) | ✅ PASS | Timer in-process `unref()`; nenhuma alternativa memory-heavy adotada. Alternativas pesadas registradas como descartadas em research.md (D1). |
| Sem novo processo/worker/Redis | ✅ PASS | Só `setInterval` top-level em `src/api/server.js`. |
| Reuso do mailer no-op | ✅ PASS | `src/email/mailer.js` + padrão de `welcomeEmail.js`. |
| Evitar migration/DDL (pegadinha #8) | ✅ PASS | Estado e opt-out via `AnalyticsEvent`; e-mail via `User.email`. Zero DDL. |
| LGPD (unsubscribe + opt-out) | ✅ PASS | Link em todo e-mail; endpoint de opt-out durável; checado antes de cada envio. |
| Só e-mail real | ✅ PASS | Filtro por `providedEmail`/exclusão de `@sistema.com`. |
| Fluxo de branches / não mexer em env-deploy | ✅ PASS | Nenhuma mudança de `.env`/portas/workflow. |

**Resultado**: PASS. Sem violações → seção "Complexity Tracking" não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/011-lead-nurture-emails/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 (decisões D1–D7)
├── data-model.md        # Phase 1 (entidades derivadas, sem DDL)
├── quickstart.md        # Phase 1 (validação end-to-end)
├── contracts/
│   ├── unsubscribe-endpoint.md   # HTTP: GET /api/lead-nurture/unsubscribe
│   ├── nurture-engine.md         # Contrato do módulo puro + passada
│   └── analytics-events.md       # Shape dos eventos AnalyticsEvent novos
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── email/
│   ├── mailer.js               # (existe) transporte SMTP no-op — REUSAR, sem mudança
│   ├── welcomeEmail.js         # (existe) padrão de builder puro — REFERÊNCIA
│   └── nurtureEmails.js        # NOVO: builders puros dos 4 passos (subject/text/html + unsubscribe)
├── leadNurture/
│   ├── policy.js               # NOVO: puro — passos, milestones, computeDueSteps, elegibilidade
│   ├── sweep.js                # NOVO: passada diária (db + sendMail injetáveis), isolamento por item
│   └── unsubscribeToken.js     # NOVO: puro — assina/verifica HMAC(userId) do link de descadastro
├── analytics.js                # EDIT: +2 eventos na allowlist (nurture_email_sent, nurture_unsubscribed)
├── api/
│   ├── server.js               # EDIT: startLeadNurtureSweep() (setInterval + unref, top-level)
│   └── routes/
│       ├── auth.js             # EDIT: após sendWelcomeEmail no /register, semear step 0 (nurture_email_sent{step:0})
│       └── leadNurture.js      # NOVO: GET /api/lead-nurture/unsubscribe (rota pública, sem auth)

test/
├── nurture-emails.test.js          # builders puros (marca, pt-BR, link unsubscribe presente)
├── lead-nurture-policy.test.js     # computeDueSteps, elegibilidade, exclusão de @sistema.com
├── lead-nurture-sweep.test.js      # idempotência, opt-out, no-op sem SMTP, isolamento por item
└── lead-nurture-unsubscribe.test.js# token HMAC round-trip + rota escreve evento durável
```

**Structure Decision**: web-service monolito — código novo isolado num módulo `src/leadNurture/`
(lógica) + `src/email/nurtureEmails.js` (conteúdo), consumidos por um único `setInterval` em
`src/api/server.js` e por uma rota pública fina. Mantém a lógica pura fora do timer/rota para
testabilidade db-free, espelhando `sessionPersistencePolicy.js`/`welcomeEmail.js`.

## Complexity Tracking

> Não aplicável — Constitution Check passou sem violações.
