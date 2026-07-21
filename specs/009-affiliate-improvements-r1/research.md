# Research: Melhorias no programa de afiliados (rodada 1)

Todas as NEEDS CLARIFICATION foram resolvidas via os 4 defaults de negócio da spec (seção Assumptions) + inspeção do código existente. Nenhum item pendente.

## R1 — Saldo devedor: coluna nova vs. derivado do ledger

- **Decisão**: **derivar** o saldo devedor do `AffiliateCommissionLedger` (append-only já existente), somando lançamentos `toStatus='debt'` (amount negativo) menos amortizações (`toStatus='debt_settled'`). Nenhuma coluna mutável de saldo no `AffiliateProfile`.
- **Rationale**: o repo já trata o ledger como fonte imutável e o saldo como **derivado** (comentário no schema: "O saldo do afiliado continua DERIVADO de AffiliateCommission; este ledger nunca sofre UPDATE"). Manter o mesmo princípio evita coluna desincronizável e mantém auditoria. Agregação por `groupBy`/`_sum` no banco (padrão O6) — sem custo de memória.
- **Alternativas**: coluna `debtCents` mutável no perfil (rejeitada: fonte de verdade dupla, risco de drift, precisa lock de update); tabela separada de dívidas (rejeitada: o ledger já modela lançamentos financeiros).

## R2 — Idempotência da dívida de estorno (FR-003)

- **Decisão**: idempotência por `(commissionId, toStatus='debt')` no ledger — antes de gravar a linha de dívida, checar se já existe uma para aquela comissão. Reprocessar o mesmo estorno/webhook não duplica.
- **Rationale**: o webhook de reversão é fire-and-forget e pode reentrar; o ledger é o ponto natural de idempotência. Alinha com a idempotência existente por `paymentId @unique`.
- **Alternativas**: chave de idempotência no `Payment` (rejeitada: espalha a responsabilidade); constraint DB única (rejeitada: exigiria índice/DDL mais pesado sem ganho — a checagem em código é suficiente e testável db-free).

## R3 — Corrida initial/recurring (FR-006)

- **Decisão**: manter `paymentId @unique` (cobre o mesmo pagamento processado 2×, FR-007) e resolver a corrida de **dois pagamentos distintos do mesmo indicado** classificando por reconsulta ordenada: a criação já filtra `referredUserId + status != reversed` para decidir `initial` vs `recurring`. Reforço: capturar violação de corrida no `create` e, em caso de duas `initial` simultâneas, a segunda é rebaixada a `recurring` numa segunda tentativa determinística (a mais antiga por `createdAt` permanece `initial`). Sem novo índice único parcial (SQLite não expressa "único onde type='initial' e status!='reversed'" de forma simples/portável via Prisma).
- **Rationale**: menor mudança de schema; aproveita a lógica já existente e comentada (O1+O4). O caso realmente concorrente é raro (dois webhooks do mesmo indicado no mesmo instante) e o dano é 1 comissão a mais — o reforço determinístico + reconciliação periódica fecham a janela.
- **Alternativas**: índice único `@@unique([referredUserId, commissionType])` (rejeitado: quebra com múltiplas `recurring` legítimas e com reversões que precisam coexistir historicamente); transação serializável (SQLite já serializa escritas via WAL+busy_timeout; a reconsulta dentro da transação basta).

## R4 — Validação de formato PIX (FR-019/FR-020)

- **Decisão**: módulo puro `pixKeyValidation.js` com `validatePixKey({ pixKey, pixKeyType })` → `{ ok, error }`. Regras: CPF = 11 dígitos + dígito verificador; telefone = E.164 BR (`^\+?55\d{2}9?\d{8}$` normalizado); e-mail = regex de e-mail; aleatória = UUID v4 ou EVP 32 hex. Validação roda **antes** de `encryptCredential` nas rotas `/affiliate/apply` e `PUT /affiliate/me`.
- **Rationale**: formato apenas (titularidade fica no antifraude existente `pixMatchesReferredUser`, FR edge case). Puro → testável sem DB/env (FR-030). Preserva cifragem (FR-021) por rodar antes de cifrar e não tocar o fluxo de `encryptCredential`.
- **Alternativas**: lib externa de validação PIX (rejeitada: dependência extra desnecessária; política de memória favorece manter leve); validar só comprimento (rejeitado: não pega CPF inválido, objetivo do FR).

## R5 — Endurecimento de atribuição órfã (FR-008/009)

- **Decisão**: módulo puro `orphanTouchPolicy.js` que recebe settings e retorna `{ windowDays, holdResult }`. Defaults: `orphanTouchWindowDays=7`, `orphanTouchMode='hold'` (janela curta + resultante em `held`). `attachOrphanTouchesByDevice` passa a usar `windowDays` das settings (hoje hardcoded 30) e a comissão resultante de toque órfão por dispositivo nasce `held` (via `holdReason='orphan_device_attribution'`) quando o modo pede hold.
- **Rationale**: reduz atribuição incorreta sem novos dados (fingerprint fora de escopo, FR-031). Configurável com default seguro (FR-009). Não captura nada novo — apenas encurta janela e segura a comissão para revisão (comissões `held` já são visíveis ao admin, FR-010).
- **Alternativas**: recusar direto (rejeitado como default: perde comissão legítima; disponível via `orphanTouchMode='off'`/`window` para quem quiser); manter 30 dias (rejeitado: é justamente o risco reportado).

## R6 — Notificações por e-mail (FR-022/023/024)

- **Decisão**: novo `src/email/affiliateEmails.js` espelhando `welcomeEmail.js`: 4 `build*Email` puros + `send*` best-effort. Reusa `sendMail`/`isEmailConfigured` de `src/email/mailer.js` (no-op sem SMTP). Disparado fire-and-forget nos pontos: aprovação/rejeição de candidatura (rotas admin), promoção pending→eligible (`promoteEligibleAffiliateCommissions`), pagamento (`mark-paid`/`mark-all-paid`/confirmação de saque). Skip para `user_*@sistema.com` (FR-024).
- **Rationale**: infra de e-mail já existe e é opcional/no-op — zero custo quando desligado, nenhum fluxo quebra (FR-023). Sem nova dependência → nada a sinalizar na política de memória.
- **Alternativas**: fila de e-mail (rejeitada: over-engineering, best-effort basta); provider dedicado (rejeitada: mailer atual é provider-agnóstico).

## R7 — Alarme de promoção travada (FR-025/026)

- **Decisão**: módulo puro `stuckPromotionAlarm.js` (`evaluateStuckPromotion({ rows, now, thresholdMs })` → `{ shouldAlarm, count, oldestMs }`). No cron de `payments.js`, após `promoteEligibleAffiliateCommissions`, consultar comissões `status='pending'` com `eligibleAt < now - threshold` (24h default via `AFFILIATE_STUCK_PROMOTION_THRESHOLD_MS`); se houver, `log.error` + `AnalyticsEvent('ops_affiliate_promotion_stuck')`. Novo nome na allowlist de `src/analytics.js`.
- **Rationale**: reaproveita o tick de cron existente (sem novo timer/processo → sem RAM). Limiar tolerante (24h) evita falso-positivo por atraso normal do ciclo. Segue o precedente de `ops_*` durável.
- **Alternativas**: novo cron dedicado (rejeitado: processo/timer extra desnecessário); só log sem evento durável (rejeitado: FR-025 exige evento `ops_*`).

## R8 — Saque self-service (FR-011..018)

- **Decisão**: nova entidade `AffiliatePayoutRequest` (ver data-model). `payoutPolicy.js` puro decide elegibilidade (mínimo, sem devedor, sem aberto). Confirmação reaproveita o mecanismo `mark-*-paid` (marca comissões elegíveis/aprovadas do afiliado como `paid`, abatendo saldo devedor primeiro). Auditoria via `writeAdminAuditLog` (FR-017).
- **Rationale**: transforma repasse manual em fluxo auditável; reusa mark-paid (Assumption). Estado `requested→paid|rejected` simples. Unicidade "1 em aberto" por checagem em `payoutPolicy` + reconsulta.
- **Alternativas**: acoplar saque diretamente a comissões sem entidade própria (rejeitado: perde rastreabilidade do pedido e do motivo de recusa); permitir múltiplos abertos (rejeitado por FR-014).

## R9 — Migrations aditivas sob WAL (FR-029, pegadinha #8)

- **Decisão**: uma migration aditiva: `CREATE TABLE AffiliatePayoutRequest` (nova) + `ALTER TABLE AffiliateSettings ADD COLUMN` (4 colunas com DEFAULT). `ADD COLUMN` com default constante e `CREATE TABLE` **não** exigem rebuild da tabela no SQLite → sem lock exclusivo prolongado; convivem com API/supervisor rodando. UPDATEs de backfill (se houver) idempotentes (`WHERE col IS NULL`).
- **Rationale**: `ADD COLUMN`/`CREATE TABLE` são operações leves no SQLite (não recriam a tabela), diferente de alterar/renomear coluna existente. A pegadinha #8 (DDL exigindo parar apps) só morde em rebuild — evitado aqui.
- **Alternativas**: alterar colunas existentes (rejeitado: exigiria rebuild + parar PM2); tabela de settings key-value (rejeitado: foge do modelo `AffiliateSettings` singleton atual).
