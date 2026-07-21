---
description: "Task list for Melhorias no programa de afiliados (rodada 1)"
---

# Tasks: Melhorias no programa de afiliados (rodada 1)

**Input**: Design documents from `/specs/009-affiliate-improvements-r1/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: incluídos — a spec (FR-030) e o quickstart.md exigem testes `node:test` db-free/env-free para toda lógica financeira pura, e listam os arquivos de teste esperados.

**Organization**: tasks agrupadas por user story (prioridade conforme spec.md: US1 P1, US2 P1, US3 P2, US4 P2, US7 P2, US5 P3, US6 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivo diferente, sem dependência de tasks incompletas)
- **[Story]**: US1..US7 conforme spec.md
- Setup/Foundational/Polish não levam label de story

## Path Conventions

Monolito web existente (Fastify API + Next.js dashboard): `src/`, `prisma/`, `test/`, `dashboard/app/` na raiz do repo (ver plan.md → Project Structure).

---

## Phase 1: Setup

- [X] T001 Confirmar branch `009-affiliate-improvements-r1` criada a partir de `develop` (`git status`, `git log --oneline -1`) — sem PR ainda; fluxo canônico feature→develop→staging→main (AGENTS.md).

---

## Phase 2: Foundational (bloqueia US2 e US4 — schema/migration/rota de settings compartilhados)

**Objetivo**: schema aditivo (tabela `AffiliatePayoutRequest` + 4 colunas em `AffiliateSettings`) e a rota de settings que expõe/valida esses campos, usados tanto por US2 (saque) quanto por US4 (endurecimento de atribuição). Nenhuma user story pode ser testada de ponta a ponta sem isso.

- [X] T002 Adicionar model `AffiliatePayoutRequest` e os 4 campos novos em `AffiliateSettings` (`minPayoutCents Int @default(5000)`, `orphanTouchWindowDays Int @default(7)`, `orphanTouchMode String @default("both")`, `payoutRequestsEnabled Boolean @default(true)`) em `prisma/schema.prisma`, incluindo relations `affiliate`/`resolvedBy` e índices `@@index([affiliateId, status])` / `@@index([status, requestedAt])`, conforme `data-model.md`.
- [X] T003 Criar migration aditiva `prisma/migrations/2026072x_affiliate_improvements_r1/migration.sql` com `CREATE TABLE IF NOT EXISTS "AffiliatePayoutRequest"` + índices + `ALTER TABLE "AffiliateSettings" ADD COLUMN` (4 colunas com DEFAULT), exatamente como especificado em `data-model.md` (sem rebuild de tabela existente — pegadinha #8 do AGENTS.md não se aplica). Rodar `npx prisma migrate dev` localmente e `npx prisma generate` para sincronizar o client.
- [X] T004 Estender `GET/PUT /admin/affiliates/settings` em `src/api/routes/affiliate.js` (rota admin `billing:write`) para ler/validar os 4 campos novos: `minPayoutCents` (inteiro ≥ 0), `orphanTouchWindowDays` (inteiro 1–365), `orphanTouchMode` (∈ `off|window|hold|both`), `payoutRequestsEnabled` (boolean) — 400 com mensagem específica por campo em caso de valor inválido, conforme `contracts/affiliate-settings.md`.

**Checkpoint**: schema migrado, `GET/PUT /admin/affiliates/settings` já aceita e devolve os 4 campos novos. US1, US2, US3, US4, US5, US6, US7 podem começar.

---

## Phase 3: User Story 1 - Estorno de comissão já paga vira dívida (Priority: P1) 🎯 MVP parte 1

**Goal**: estorno de comissão `paid` gera lançamento de dívida idempotente no ledger, visível no painel do afiliado e no admin.

**Independent Test**: reembolsar/chargeback um pagamento com comissão `paid` de R$30 e verificar lançamento de dívida (-R$30) no ledger + saldo devedor de R$30 exposto em `GET /affiliate/me`; reprocessar o mesmo estorno e confirmar que não duplica.

- [X] T005 [P] [US1] Criar módulo puro `src/domain/affiliate/affiliateBalance.js`: `computeDebtCents({ ledgerRows })` (soma `toStatus='debt'` negativo menos `toStatus='debt_settled'` positivo, piso em 0) e `computeAvailableCents({ commissionRows })` (soma comissões `eligible`/`approved` não revertidas), conforme R1 de research.md — sem acesso a DB/env.
- [X] T006 [P] [US1] Criar `test/affiliate-balance.test.js` cobrindo: dívida simples, dívida parcialmente amortizada (`debt_settled`), piso em 0 quando amortização excede dívida, e saldo disponível somando só `eligible`/`approved`.
- [X] T007 [US1] Estender `reverseAffiliateCommissionForPayment` em `src/domain/affiliate/service.js` (linha ~406): quando a comissão alvo tem `status='paid'`, gravar lançamento negativo no `AffiliateCommissionLedger` via `writeCommissionLedger` com `toStatus='debt'`, `amountCents` negativo, `reason='reversal_after_paid'` — checando antes se já existe lançamento `debt` para aquela `commissionId` (idempotência FR-003) — e preservar `COMMISSION_REVERSIBLE_STATUSES` (linha 360) para os demais status (comportamento atual intacto, FR-005).
- [X] T008 [US1] Estender `getAffiliateMeData` em `src/domain/affiliate/service.js` (linha ~162) para expor `debtCents` (via `affiliateBalance.computeDebtCents`) no payload consumido pelo painel do afiliado (FR-004).
- [X] T009 [US1] Expor `debtCents` por afiliado na visão administrativa (rota admin de listagem/detalhe de afiliados em `src/api/routes/affiliate.js`), reaproveitando `affiliateBalance.computeDebtCents`.
- [X] T010 [US1] Estender `test/affiliate-service.test.js` com casos: reversão de comissão `paid` cria lançamento `debt`; reprocessar o mesmo estorno não duplica; reversão de comissão `pending/eligible/approved/held` preserva comportamento atual (sem `debt`).
- [X] T011 [US1] Atualizar `dashboard/app/painel/afiliados/page.js` para exibir o saldo devedor (`debtCents`) com texto explicando que será descontado do próximo repasse (FR-004).
- [X] T012 [US1] Atualizar a página admin de afiliados (`dashboard/app/admin/afiliados/...`) para exibir `debtCents` por afiliado.

**Checkpoint**: US1 testável de ponta a ponta de forma independente (o abatimento efetivo no repasse é conectado em US2, que reaproveita `affiliateBalance.js` criado aqui).

---

## Phase 4: User Story 2 - Saque self-service com valor mínimo (Priority: P1) 🎯 MVP parte 2

**Goal**: afiliado solicita saque pelo painel (bloqueado por mínimo/devedor/pedido aberto); admin confirma (abate dívida, marca comissões pagas, audita) ou recusa.

**Independent Test**: afiliado com saldo ≥ mínimo solicita saque → aparece para o admin → admin confirma → comissões viram `paid` e `AdminAuditLog` registrado.

- [X] T013 [P] [US2] Criar módulo puro `src/domain/affiliate/payoutPolicy.js`: `canRequestPayout({ availableCents, debtCents, minPayoutCents, hasOpenRequest })` → `{ ok, error }` (bloqueia por saldo < mínimo, saldo devedor > 0, ou pedido já aberto — FR-012/013/014), conforme `contracts/payout-requests.md`.
- [X] T014 [P] [US2] Criar `test/affiliate-payout-policy.test.js` cobrindo: saldo ok sem devedor sem pedido aberto → `ok:true`; saldo abaixo do mínimo → erro com o valor mínimo na mensagem; saldo devedor pendente → erro; pedido já aberto → erro.
- [X] T015 [US2] Implementar `createPayoutRequest({ userId, db })` em `src/domain/affiliate/service.js`: calcula `availableCents`/`debtCents` via `affiliateBalance.js`, reconsulta pedido aberto (`status='requested'`), decide via `payoutPolicy.canRequestPayout`, cria `AffiliatePayoutRequest` com `amountCents` = saldo disponível no momento (snapshot), nunca aceitando valor do cliente.
- [X] T016 [US2] Implementar `confirmPayoutRequest({ id, adminUserId, db })` em `src/domain/affiliate/service.js`: `updateMany` idempotente (`where status='requested'`, checa `count===1` → 409 se já resolvido), abate `debtCents` primeiro gravando ledger `toStatus='debt_settled'` (`reason='payout_offset'`), marca as comissões `eligible`/`approved` correspondentes como `paid`, grava `settledCommissionIds`, seta `status='paid'`/`resolvedAt`/`resolvedByUserId`.
- [X] T017 [US2] Implementar `rejectPayoutRequest({ id, adminUserId, reason, db })` em `src/domain/affiliate/service.js`: valida `reason` (obrigatório, ≤500 chars), `updateMany` idempotente para `status='rejected'` com `rejectionReason`/`resolvedAt`/`resolvedByUserId` (saldo do afiliado permanece disponível — FR-015).
- [X] T018 [US2] Adicionar rotas de afiliado em `src/api/routes/affiliate.js`: `POST /affiliate/payout-requests` (chama `createPayoutRequest`, 200/400/409/403 conforme `contracts/payout-requests.md`) e `GET /affiliate/payout-requests` (lista pedidos do afiliado + bloco `available: { availableCents, debtCents, minPayoutCents, canRequest }`).
- [X] T019 [US2] Adicionar rotas admin em `src/api/routes/affiliate.js`: `GET /admin/affiliates/payout-requests?status=requested` (fila), `POST /admin/affiliates/payout-requests/:id/confirm` e `POST /admin/affiliates/payout-requests/:id/reject`, ambas exigindo `requireAdminAccess(req, reply, 'billing:write')` e gravando `writeAdminAuditLog` com ação `admin.affiliate.payout.confirm`/`admin.affiliate.payout.reject` (FR-017).
- [X] T020 [US2] Criar `test/affiliate-payout-route.test.js` cobrindo: criação de saque válida, bloqueio por mínimo, bloqueio por devedor, bloqueio por pedido duplicado, confirmação (comissões viram `paid` + auditoria), recusa (saldo permanece, motivo obrigatório).
- [ ] T021 [US2] Atualizar `dashboard/app/painel/afiliados/page.js` com botão "Solicitar saque" (habilitado/desabilitado conforme `available.canRequest`) e histórico de solicitações.
- [ ] T022 [US2] Atualizar a página admin de afiliados com a fila de solicitações de saque (`GET /admin/affiliates/payout-requests`) e ações de confirmar/recusar.

**Checkpoint**: US1 + US2 = MVP completo (fluxo financeiro P1 fim-a-fim: dívida por estorno + saque self-service com abatimento).

---

## Phase 5: User Story 3 - Validação do formato da chave PIX por tipo (Priority: P2)

**Goal**: candidatura/atualização de dados do afiliado rejeita chave PIX cujo formato não bate com o tipo declarado, antes de cifrar.

**Independent Test**: enviar combinações válidas/inválidas de tipo×chave em `POST /affiliate/apply` e `PUT /affiliate/me` e verificar 400 nas inválidas; chave válida continua cifrada em repouso.

- [ ] T023 [P] [US3] Criar módulo puro `src/domain/affiliate/pixKeyValidation.js`: `validatePixKey({ pixKey, pixKeyType })` → `{ ok, error }` com regras por tipo (`cpf`: 11 dígitos + dígito verificador; `phone`: E.164 BR celular `+55DDD9XXXXXXXX`; `email`: regex de e-mail; `random`: UUID v4 ou EVP 32 hex), normalizando espaços/`.`/`-`/`(`/`)` antes de validar CPF/telefone, conforme `contracts/pix-validation.md`.
- [ ] T024 [P] [US3] Criar `test/affiliate-pix-validation.test.js` cobrindo casos válidos e inválidos para os 4 tipos (incluindo CPF com dígito verificador errado e telefone sem DDD).
- [ ] T025 [US3] Chamar `validatePixKey` em `applyAffiliate` (`src/domain/affiliate/service.js`, linha ~138) e em `PUT /affiliate/me` (`src/api/routes/affiliate.js`), retornando 400 com a mensagem de `validatePixKey` **antes** de qualquer chamada a `encryptCredential` (FR-021 preservado).

**Checkpoint**: US3 testável isoladamente; não depende de US1/US2.

---

## Phase 6: User Story 4 - Endurecer atribuição órfã por dispositivo (Priority: P2)

**Goal**: toques órfãos por dispositivo usam janela configurável (default 7 dias) e a comissão resultante nasce `held` por padrão, conforme `orphanTouchMode` das settings.

**Independent Test**: com settings no padrão seguro, simular toque dentro e fora da janela endurecida e verificar que dentro da janela a comissão nasce `held` (não paga automaticamente) e fora da janela nenhuma atribuição por dispositivo ocorre.

- [ ] T026 [P] [US4] Criar módulo puro `src/domain/affiliate/orphanTouchPolicy.js`: `resolveOrphanTouchDecision({ orphanTouchWindowDays, orphanTouchMode, touchAgeDays })` → `{ withinWindow, shouldHold }` implementando a semântica de `orphanTouchMode` (`off`|`window`|`hold`|`both`) descrita em `contracts/affiliate-settings.md`.
- [ ] T027 [P] [US4] Criar `test/affiliate-orphan-touch-policy.test.js` cobrindo os 4 modos × dentro/fora da janela.
- [ ] T028 [US4] Estender `attachOrphanTouchesByDevice` em `src/domain/affiliate/service.js` (linha ~119, hoje `windowDays = 30` hardcoded) para ler `orphanTouchWindowDays`/`orphanTouchMode` de `getAffiliateSettings()`, usar `orphanTouchPolicy.resolveOrphanTouchDecision`, e criar a comissão resultante com `status='held'`/`heldAt`/`holdReason='orphan_device_attribution'` quando `shouldHold=true` (campos já existentes, sem migration nova).
- [ ] T029 [US4] Estender `test/affiliate-service.test.js` com casos: toque dentro da janela endurecida com modo `both`/`hold` → comissão `held`; toque fora da janela → nenhuma atribuição por dispositivo; modo `window` → comissão segue fluxo normal (sem hold); modo `off` → comportamento legado (30 dias, sem hold).

**Checkpoint**: US4 testável isoladamente; visibilidade de comissões `held` para o admin já existe no código atual (FR-010 preservado, sem task nova).

---

## Phase 7: User Story 7 - Corrigir corrida initial/recurring e inconsistências de contagem (Priority: P2)

**Goal**: no máximo uma comissão `initial` por indicado mesmo sob concorrência; contagens "Vendas"/"Vendas válidas" alinhadas (excluindo revertidas); `lifetimeEarnedCents` distinto de total pago.

**Independent Test**: dois pagamentos concorrentes do mesmo indicado geram exatamente uma comissão `initial`; painel do afiliado com comissões revertidas mostra "Vendas" e "Vendas válidas" coincidindo e `lifetimeEarnedCents` ≠ total pago.

- [ ] T030 [US7] Reforçar `tryCreateAffiliateCommission` em `src/domain/affiliate/service.js` (linha ~430): manter `paymentId @unique` (idempotência por pagamento, FR-007) e, ao classificar `initial` vs `recurring`, reconsultar dentro da mesma operação se já existe uma `initial` não revertida para o `referredUserId` — em caso de corrida (duas criações quase simultâneas), a mais antiga por `createdAt` permanece `initial` e a outra é rebaixada a `recurring` numa segunda tentativa determinística (conforme R3 de research.md).
- [ ] T031 [US7] Ajustar `getAffiliateMeData` em `src/domain/affiliate/service.js` (linha ~162): alinhar `byMonth[].count` do histórico mensal para excluir comissões `reversed` (hoje inclui), igualando ao card "Vendas válidas"; adicionar `lifetimeEarnedCents` (soma de todas as comissões não revertidas) distinto de `totalEarnedCents`/total pago (FR-027/FR-028).
- [ ] T032 [US7] Estender `test/affiliate-service.test.js` com casos: dois pagamentos concorrentes do mesmo indicado → exatamente uma `initial`; mesmo `paymentId` processado 2× → sem duplicata (regressão); `byMonth.count` exclui revertidas e bate com "Vendas válidas"; `lifetimeEarnedCents` ≠ total pago quando há comissões elegíveis/pendentes não pagas.
- [ ] T033 [US7] Atualizar `dashboard/app/painel/afiliados/page.js` para exibir `lifetimeEarnedCents` ("total ganho na vida") como métrica distinta do total pago.

**Checkpoint**: US7 testável isoladamente; corrige integridade de dados sem depender de US1/US2/US3/US4.

---

## Phase 8: User Story 5 - Notificações ao afiliado por e-mail (Priority: P3)

**Goal**: e-mails best-effort/no-op para candidatura aprovada, candidatura rejeitada, comissão elegível e comissão paga.

**Independent Test**: disparar os 4 eventos com e-mail configurado (envio ocorre) e sem configuração (fluxo conclui normalmente, sem envio); endereço `user_*@sistema.com` nunca recebe e-mail.

- [ ] T034 [P] [US5] Criar `src/email/affiliateEmails.js` espelhando `src/email/welcomeEmail.js`: 4 pares `build*Email`/`send*Email` (aprovação, rejeição, comissão elegível, comissão paga), reaproveitando `sendMail`/`isEmailConfigured` de `src/email/mailer.js`, com skip silencioso para endereços de fallback (`user_*@sistema.com`, FR-024) e fire-and-forget (nunca lança para o chamador, FR-023).
- [ ] T035 [P] [US5] Criar `test/affiliate-emails.test.js` (padrão de `test/welcome-email.test.js`) cobrindo: builders geram assunto/corpo esperado para os 4 eventos; sem `SMTP_*` configurado, `send*` retorna `{ skipped: true }`; endereço de fallback é ignorado mesmo com SMTP configurado.
- [ ] T036 [US5] Disparar `sendAffiliateApprovedEmail`/`sendAffiliateRejectedEmail` fire-and-forget nas rotas admin de aprovação/rejeição de candidatura em `src/api/routes/affiliate.js`.
- [ ] T037 [US5] Disparar `sendCommissionEligibleEmail` fire-and-forget em `promoteEligibleAffiliateCommissions` (`src/domain/affiliate/service.js`, linha ~545) quando uma comissão é promovida de `pending` para `eligible`.
- [ ] T038 [US5] Disparar `sendCommissionPaidEmail` fire-and-forget nos pontos de marcação de pagamento existentes (mark-paid/mark-all-paid em `src/api/routes/affiliate.js`) e em `confirmPayoutRequest` (T016, US2) quando comissões viram `paid`.

**Checkpoint**: US5 testável isoladamente (db-free para os builders); os pontos de disparo (T036-T038) tocam rotas/serviço já existentes mas de forma aditiva (chamada extra fire-and-forget).

---

## Phase 9: User Story 6 - Alarme operacional se a promoção pending→eligible parar (Priority: P3)

**Goal**: alarme (log de erro + evento `ops_*`) quando existem comissões `pending` com `eligibleAt` vencido há mais que o limiar (default 24h), reaproveitando o cron existente.

**Independent Test**: criar comissões `pending` com `eligibleAt` vencido > limiar e verificar `log.error` + `AnalyticsEvent('ops_affiliate_promotion_stuck')`; sem comissões vencidas além do limiar, nenhum alarme.

- [ ] T039 [P] [US6] Criar módulo puro `src/domain/affiliate/stuckPromotionAlarm.js`: `evaluateStuckPromotion({ rows, now, thresholdMs })` → `{ shouldAlarm, count, oldestMs }`, sem acesso a DB/env.
- [ ] T040 [P] [US6] Criar `test/affiliate-stuck-promotion.test.js` cobrindo: nenhuma comissão vencida além do limiar → `shouldAlarm:false`; comissões vencidas além do limiar → `shouldAlarm:true` com `count`/`oldestMs` corretos.
- [ ] T041 [US6] Adicionar `'ops_affiliate_promotion_stuck'` à allowlist de `src/analytics.js` (mesmo padrão dos demais `ops_*`, linhas ~57-89).
- [ ] T042 [US6] Implementar `checkStuckPromotions({ db, log, now, thresholdMs })` em `src/domain/affiliate/service.js` (consulta comissões `pending` com `eligibleAt < now - thresholdMs`, usa `stuckPromotionAlarm.evaluateStuckPromotion`, emite `log.error` + `AnalyticsEvent('ops_affiliate_promotion_stuck')` quando `shouldAlarm`) e chamá-la em `src/api/routes/payments.js` logo após `promoteEligibleAffiliateCommissions` no `reconciliationTimer` (linha ~709), lendo o limiar de `AFFILIATE_STUCK_PROMOTION_THRESHOLD_MS` (default 24h).

**Checkpoint**: US6 testável isoladamente; não introduz novo processo/timer (reaproveita o `reconciliationTimer` existente — sem impacto de RAM).

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T043 Rodar a suíte completa `node --test` e confirmar que todos os testes novos e existentes passam (regressão zero), incluindo os arquivos listados em quickstart.md.
- [ ] T044 Seguir o roteiro de `quickstart.md` (US1–US7) e a verificação final SC-009 (`AffiliateAttributionTouch.ipHash/uaHash` não recebem novos valores por esta feature) antes de abrir PR para `develop`.
- [ ] T045 Validar em staging (após merge em `develop` e autodeploy): aplicar migration (`npx prisma migrate deploy`), conferir `PRAGMA table_info('AffiliateSettings')` e `.tables` para `AffiliatePayoutRequest`, e repetir os testes de rota/painel do quickstart.md antes de abrir PR `develop → main`.

---

## Dependencies & Execution Order

### Fases
- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup. **Bloqueia** US2 e US4 (schema/rota de settings compartilhados). US1, US3, US5, US6, US7 não dependem do schema novo e podem começar em paralelo com a Phase 2, exceto onde notado abaixo.
- **US1 (Phase 3, P1)**: sem dependência de schema novo (usa `AffiliateCommissionLedger` existente). Pode começar em paralelo com Phase 2.
- **US2 (Phase 4, P1)**: depende de Phase 2 (tabela `AffiliatePayoutRequest`, campo `minPayoutCents`/`payoutRequestsEnabled`) e reaproveita `affiliateBalance.js` criado em US1 (T005) — logo, inicia após T005/T007 estarem prontos, mesmo rodando em paralelo com o restante de US1.
- **US3 (Phase 5, P2)**: independente; pode rodar em paralelo com qualquer outra fase.
- **US4 (Phase 6, P2)**: depende de Phase 2 (campos `orphanTouchWindowDays`/`orphanTouchMode`).
- **US7 (Phase 7, P2)**: independente; pode rodar em paralelo com qualquer outra fase.
- **US5 (Phase 8, P3)**: T036-T038 tocam pontos que também são tocados por US1 (getAffiliateMeData não conflita) e US2 (T016 confirmPayoutRequest) — logo T038 depende de T016 estar mergeado (mesmo arquivo/função).
- **US6 (Phase 9, P3)**: independente de outras user stories; depende apenas da Phase 1.
- **Polish (Phase 10)**: depende de todas as fases anteriores.

### Ordem recomendada (MVP incremental)
1. Phase 1 → Phase 2 (foundational)
2. Phase 3 (US1) + Phase 4 (US2) → **MVP financeiro completo**
3. Phase 5 (US3) + Phase 6 (US4) + Phase 7 (US7) — em paralelo entre si
4. Phase 8 (US5) + Phase 9 (US6) — em paralelo entre si
5. Phase 10 (Polish)

## Parallel Execution Examples

### Dentro da Phase 3 (US1)
```
T005 [P] Criar affiliateBalance.js
T006 [P] Criar affiliate-balance.test.js
```
(T007-T012 são sequenciais após T005/T006, pois todos tocam `service.js`/rotas/dashboard dependentes do módulo.)

### Dentro da Phase 4 (US2)
```
T013 [P] Criar payoutPolicy.js
T014 [P] Criar affiliate-payout-policy.test.js
```

### Entre user stories independentes (após Phase 2 concluída)
```
Agente A: Phase 5 (US3) — pixKeyValidation.js + testes + wiring em affiliate.js
Agente B: Phase 7 (US7) — reforço de tryCreateAffiliateCommission + contagens
Agente C: Phase 9 (US6) — stuckPromotionAlarm.js + testes + wiring em payments.js
```

## Implementation Strategy

- **MVP primeiro**: Phase 1 + Phase 2 + Phase 3 (US1) + Phase 4 (US2) entregam o eixo financeiro P1 completo (estorno vira dívida + saque self-service com abatimento) — maior impacto de dinheiro/confiança contábil, validável em staging isoladamente via quickstart.md.
- **Entrega incremental**: cada user story subsequente (US3, US4, US7, depois US5, US6) é independentemente testável e pode ser mergeada/validada em staging separadamente, sem esperar as demais.
- **Testes antes de merge**: todo módulo puro novo (`affiliateBalance.js`, `payoutPolicy.js`, `pixKeyValidation.js`, `orphanTouchPolicy.js`, `stuckPromotionAlarm.js`) tem teste `node:test` db-free/env-free correspondente antes do wiring em `service.js`/rotas (FR-030).
