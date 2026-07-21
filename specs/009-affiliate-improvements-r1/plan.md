# Implementation Plan: Melhorias no programa de afiliados (rodada 1)

**Branch**: `009-affiliate-improvements-r1` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-affiliate-improvements-r1/spec.md`

## Summary

Sete melhorias no programa de afiliados, **sem captura de fingerprint** (FR-031). O eixo financeiro (US1 estorno→dívida, US2 saque self-service, US7 corrida initial/recurring + contagens) concentra o risco e recebe módulos puros/testáveis (FR-030). Os demais (US3 validação PIX, US4 endurecimento de atribuição, US5 e-mails, US6 alarme operacional) reaproveitam infra existente (`encryptCredential`, `src/email/mailer.js`, `AnalyticsEvent` allowlist, cron de reconciliação em `payments.js`).

**Abordagem técnica**: estender o domínio existente em `src/domain/affiliate/service.js` (append-only ledger já existe — `AffiliateCommissionLedger`) com um conceito de **saldo devedor derivado do ledger** (lançamentos negativos), uma nova entidade `AffiliatePayoutRequest` (saque), novos campos aditivos em `AffiliateSettings`, e módulos puros novos (`pixKeyValidation.js`, `payoutPolicy.js`, `affiliateBalance.js`, `stuckPromotionAlarm.js`, `orphanTouchPolicy.js`). Migrations aditivas seguem o padrão do repo (DML idempotente; DDL apenas colunas/tabela nova nullable → sem rebuild). Sem mudanças memory-heavy.

## Technical Context

**Language/Version**: Node.js (ESM), sem TypeScript. Prisma Client.

**Primary Dependencies**: Fastify (rotas + `app.authenticate`), Prisma + SQLite (WAL), `nodemailer` (via `src/email/mailer.js`, opcional/no-op), `src/credentialCrypto.js` (AES-256-GCM D-3), `src/analytics.js` (allowlist de eventos duráveis).

**Storage**: SQLite (`prisma/prod.db` / `staging.db`), WAL + `busy_timeout=5000`. Modelos tocados: `AffiliateProfile`, `AffiliateCommission`, `AffiliateCommissionLedger`, `AffiliateSettings`, `AffiliateAttributionTouch`, `AdminAuditLog`; novo `AffiliatePayoutRequest`.

**Testing**: `node:test` (`node --test`). Testes db-free/env-free para toda lógica pura (FR-030). Fakes de `db` (objetos com `findMany`/`updateMany`/`groupBy`) já são o padrão no repo para service tests.

**Target Platform**: Linux server (VPS x86), PM2 (`api`/`api-staging`). Sem novo processo PM2 → sem impacto de RAM.

**Project Type**: web-service (Fastify API) + dashboard Next.js (painel afiliado e admin).

**Performance Goals**: agregações continuam via `groupBy` no banco (padrão de `getAffiliateMeData`, O6) — nada carrega comissões inteiras em memória. Saldo devedor derivado por soma agregada no ledger.

**Constraints**: fluxo canônico feature→develop→staging→main (FR-029). Migrations preferencialmente aditivas/idempotentes; DDL só de coluna/tabela nova nullable (sem rebuild → sem lock exclusivo, pegadinha #8 não dispara). Cifragem PIX preservada intacta (FR-021). E-mail no-op sem SMTP (FR-023). Nenhuma mudança memory-heavy (Política de memória: nada a sinalizar).

**Scale/Scope**: dezenas–centenas de afiliados; volume por afiliado limitado por paginação existente. Escopo: ~5 módulos puros novos, 1 tabela nova, ~4 colunas novas, ~4 rotas novas, extensões em 3 rotas/serviços existentes, 4 templates de e-mail, 1 alarme no cron existente.

## Decisões de negócio consolidadas (Assumptions da spec → decisões concretas)

Os 4 defaults registrados em Assumptions ficam **assim decididos** neste plano (todos configuráveis, com default seguro):

1. **Valor mínimo de saque** = **5000 centavos (R$50,00)**. Novo campo `AffiliateSettings.minPayoutCents Int @default(5000)`. Editável em `PUT /admin/affiliates/settings`. (FR-011, FR-018)
2. **Endurecimento de atribuição órfã por dispositivo** = **janela curta 7 dias + comissão em `held` (revisão manual)**, ambos ligados por padrão (modo "ambos"). Campos `AffiliateSettings.orphanTouchWindowDays Int @default(7)` e `AffiliateSettings.orphanTouchMode String @default("hold")` (valores: `off` | `window` | `hold` | `both`; default efetivo tratado como `both` quando janela+hold). Módulo puro `orphanTouchPolicy.js` decide janela efetiva e se resultante vai a `held`. (FR-008, FR-009)
3. **Limiar do alarme de promoção travada** = **24h além de `eligibleAt`**. Env `AFFILIATE_STUCK_PROMOTION_THRESHOLD_MS` (default 24h) lida em runtime. Alarme roda no mesmo tick do cron de `promoteEligibleAffiliateCommissions` em `payments.js`. (FR-025, FR-026)
4. **Formatos de chave PIX**: CPF (11 dígitos + dígito verificador válido), telefone (E.164 BR / celular `+55DDD9XXXXXXXX`), e-mail (regex de e-mail), aleatória (UUID v4 / EVP 32 hex). Validação de **formato apenas** — titularidade PIX continua no antifraude separado (`pixMatchesReferredUser`). (FR-019, FR-020)

Regras auxiliares decididas: **uma** solicitação de saque em aberto por afiliado (FR-014, `status='requested'` único por `affiliateId`). Saldo devedor **bloqueia** novo saque (FR-013). Endereços `user_*@sistema.com` são fallback e não recebem e-mail (FR-024).

## Constitution Check

*GATE: constituição do projeto é template não preenchido (`.specify/memory/constitution.md`).* Na ausência de constituição formal, os gates aplicados são as **regras canônicas do `AGENTS.md`** (fonte única de regras para agentes neste repo):

| Regra canônica (AGENTS.md) | Status | Como o plano cumpre |
|---|---|---|
| Fluxo feature→develop→staging→main; nunca direto p/ main | PASS | Branch de feature; PR contra `develop`; validar em staging antes de `main` (FR-029). |
| Migrations SQLite aditivas/idempotentes; cuidado de lock (pegadinha #8) | PASS | Só DDL de coluna/tabela **nova nullable** (sem rebuild → sem lock exclusivo); UPDATEs idempotentes (`WHERE col IS NULL`). Nenhum ALTER de DEFAULT físico. |
| Cifragem D-3 (idempotente, no-op sem env, tolera texto puro) | PASS | PIX continua via `encryptCredential`/`decryptCredential` intactos (FR-021); validação de formato roda **antes** de cifrar. |
| Testes `node:test` db-free/env-free | PASS | Toda lógica financeira/decisão em módulos puros (FR-030) com fakes de `db`. |
| Política de memória — super sinalizar mudanças memory-heavy | PASS (nada a sinalizar) | Sem novo processo PM2, sem worker, sem cache em memória, sem dependência pesada. E-mail reusa transporte existente. Agregações via `groupBy` no banco. |
| Lógica financeira em módulos puros | PASS | `affiliateBalance.js`, `payoutPolicy.js`, `pixKeyValidation.js`, `orphanTouchPolicy.js`, `stuckPromotionAlarm.js`. |
| Eventos `ops_*` na allowlist de `src/analytics.js` | PASS | Novo `ops_affiliate_promotion_stuck` adicionado à allowlist + mapeamento em `operationalSignals` se aplicável. |
| Ações admin auditadas (`AdminAuditLog`) | PASS | Confirmar/recusar saque escrevem `writeAdminAuditLog` (FR-017), reaproveitando `mark-paid`. |

Nenhuma violação. **Complexity Tracking**: N/A.

## Project Structure

### Documentation (this feature)

```text
specs/009-affiliate-improvements-r1/
├── plan.md              # Este arquivo
├── research.md          # Decisões técnicas e alternativas
├── data-model.md        # Entidades, campos novos, migrations
├── quickstart.md        # Roteiro de validação por US (staging)
├── contracts/           # Contratos de rotas novas/alteradas
│   ├── payout-requests.md
│   ├── affiliate-settings.md
│   └── pix-validation.md
└── tasks.md             # (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── domain/affiliate/
│   ├── service.js                 # ESTENDER: tryCreateAffiliateCommission (US7 initial única),
│   │                              #   reverseAffiliateCommissionForPayment (US1 dívida se paga),
│   │                              #   getAffiliateMeData (US7 contagens + saldo devedor),
│   │                              #   applyAffiliate/PUT me (US3 validação),
│   │                              #   attachOrphanTouchesByDevice (US4 janela+hold),
│   │                              #   novo: createPayoutRequest / confirmPayoutRequest / rejectPayoutRequest (US2)
│   ├── pixKeyValidation.js        # NOVO módulo puro (US3)
│   ├── affiliateBalance.js        # NOVO módulo puro: saldo disponível + saldo devedor derivado do ledger (US1/US2)
│   ├── payoutPolicy.js            # NOVO módulo puro: pode sacar? mínimo/devedor/aberto (US2)
│   ├── orphanTouchPolicy.js       # NOVO módulo puro: janela efetiva + held (US4)
│   └── stuckPromotionAlarm.js     # NOVO módulo puro: decide se alarma (US6)
├── api/routes/
│   ├── affiliate.js               # ESTENDER: validação PIX nas rotas; novas rotas de saque (afiliado + admin); settings novos campos
│   └── payments.js                # ESTENDER: cron chama checkStuckPromotions (US6); webhook reverse já chama service (US1)
├── email/
│   └── affiliateEmails.js         # NOVO: 4 builders + senders (approved/rejected/eligible/paid) no padrão welcomeEmail.js (US5)
├── analytics.js                   # ESTENDER allowlist: ops_affiliate_promotion_stuck
prisma/
├── schema.prisma                  # AffiliateSettings +4 campos; AffiliateProfile (saldo derivado, sem coluna nova);
│                                  #   novo model AffiliatePayoutRequest
└── migrations/
    └── 2026072x_affiliate_improvements_r1/migration.sql   # aditiva (tabela nova + colunas nullable/default)
dashboard/app/
├── painel/afiliados/page.js       # ESTENDER: saldo devedor, botão solicitar saque, contagens alinhadas (US1/US2/US7)
└── admin/afiliados/…              # ESTENDER: fila de saques (confirmar/recusar), saldo devedor visível (US1/US2)
test/
├── affiliate-pix-validation.test.js       # NOVO (US3)
├── affiliate-balance.test.js              # NOVO (US1/US2)
├── affiliate-payout-policy.test.js        # NOVO (US2)
├── affiliate-orphan-touch-policy.test.js  # NOVO (US4)
├── affiliate-stuck-promotion.test.js      # NOVO (US6)
├── affiliate-service.test.js              # ESTENDER (US1 dívida, US7 initial única/contagens)
└── affiliate-payout-route.test.js         # NOVO (US2 rotas + auditoria)
```

**Structure Decision**: web-service monolito existente. Toda lógica de decisão financeira vive em **módulos puros novos** sob `src/domain/affiliate/` (importados pelo `service.js` e pelas rotas), preservando a testabilidade db-free/env-free (FR-030) e mantendo o `service.js` como orquestrador. Nenhuma nova fronteira de processo.

## Notas de implementação por User Story

- **US1 (dívida)**: `reverseAffiliateCommissionForPayment` passa a detectar comissões com `status='paid'` (hoje `COMMISSION_REVERSIBLE_STATUSES` **não** inclui `paid`, então pagas são ignoradas — é exatamente o bug). Para pagas: grava lançamento **negativo** no `AffiliateCommissionLedger` (`toStatus='debt'`, `amountCents` negativo, `reason='reversal_after_paid'`) e marca a comissão `reversed` (ou mantém histórico + linha de dívida). Idempotência por `(commissionId, reason)` no ledger (FR-003). Saldo devedor = soma dos lançamentos `debt` ainda não amortizados, derivado em `affiliateBalance.js`.
- **US2 (saque)**: nova tabela `AffiliatePayoutRequest`. `createPayoutRequest` valida via `payoutPolicy.js` (saldo ≥ mínimo, sem devedor, sem aberto). `confirmPayoutRequest` reaproveita a lógica de `mark-all-paid` para o ciclo/afiliado e abate saldo devedor primeiro. Auditoria via `writeAdminAuditLog`.
- **US7 (initial única)**: `tryCreateAffiliateCommission` já filtra `status != 'reversed'` para classificar initial/recurring, mas a corrida concorrente não é atômica. Decisão: adicionar índice único parcial-equivalente via **guard determinístico** — como SQLite não tem índice único parcial simples aqui, usar `paymentId @unique` (já existe, cobre mesmo-pagamento) + reforço: na criação, reconsultar dentro de transação/`create` com captura de corrida (o segundo cai em recurring). Detalhe em research.md.
- **US7 (contagens)**: `getAffiliateMeData` — `totalSales` já exclui reversed; alinhar `byMonth[].count` para também excluir reversed (hoje soma `count` incl. reversed) e expor `lifetimeEarnedCents` (não revertidas) distinto de `totalEarnedCents`/pago.

## Complexity Tracking

N/A — sem violações a justificar.
