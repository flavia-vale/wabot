# Data Model: Melhorias no programa de afiliados (rodada 1)

Todas as mudanças de banco são **aditivas** (tabela nova + colunas nullable/com default). Nenhuma coluna existente é alterada/renomeada → sem rebuild → sem lock exclusivo (AGENTS.md pegadinha #8 não dispara). DML de backfill, se necessário, é idempotente.

## Entidade nova: `AffiliatePayoutRequest` (US2)

Pedido de saque do afiliado. Estados: `requested → paid | rejected`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | String @id @default(cuid()) | |
| `affiliateId` | String | FK → `AffiliateProfile.id` |
| `amountCents` | Int | saldo disponível no momento do pedido (snapshot) |
| `status` | String @default("requested") | `requested` \| `paid` \| `rejected` |
| `requestedAt` | DateTime @default(now()) | |
| `resolvedAt` | DateTime? | quando pago/recusado |
| `resolvedByUserId` | String? | admin que resolveu (FK → User) |
| `rejectionReason` | String? | motivo em caso de recusa (FR-015) |
| `settledCommissionIds` | String? | JSON com ids das comissões liquidadas (rastreabilidade) |
| `createdAt` | DateTime @default(now()) | |

Índices: `@@index([affiliateId, status])` (checar "1 em aberto"), `@@index([status, requestedAt])` (fila do admin).

**Unicidade "1 em aberto" (FR-014)**: garantida em código via `payoutPolicy.js` + reconsulta antes do `create` (não há índice único parcial em SQLite portável). Um `status='requested'` bloqueia novo pedido.

Relations: `affiliate AffiliateProfile @relation(...)`; `resolvedBy User? @relation(...)`.

## Alterações aditivas em `AffiliateSettings` (US2/US4)

Singleton `id=1`. Quatro colunas novas com default seguro (decisões de negócio consolidadas):

| Campo | Tipo | Default | US |
|---|---|---|---|
| `minPayoutCents` | Int | `5000` | US2 (R$50,00) |
| `orphanTouchWindowDays` | Int | `7` | US4 (janela curta) |
| `orphanTouchMode` | String | `"both"` | US4 (`off`\|`window`\|`hold`\|`both`) |
| `payoutRequestsEnabled` | Boolean | `true` | US2 (kill-switch de rollout) |

Validação em `PUT /admin/affiliates/settings`: `minPayoutCents` ≥ 0; `orphanTouchWindowDays` 1–365; `orphanTouchMode` na allowlist; `payoutRequestsEnabled` boolean.

## Uso de `AffiliateCommissionLedger` para saldo devedor (US1) — sem coluna nova

O ledger append-only existente ganha **novos valores de `toStatus`** (string, sem mudança de schema):

- `toStatus='debt'`, `amountCents` **negativo** — dívida criada por estorno de comissão **já paga** (`reason='reversal_after_paid'`). Idempotente por `(commissionId, toStatus='debt')`.
- `toStatus='debt_settled'`, `amountCents` **positivo** — amortização da dívida no repasse seguinte (`reason='payout_offset'`, `actor=<admin>`).

**Saldo devedor derivado** (módulo `affiliateBalance.js`, puro):
`debtCents = -(Σ amountCents onde toStatus='debt') - (Σ amountCents onde toStatus='debt_settled')`, com piso em 0. Agregado via `groupBy`/`_sum` no banco (padrão O6, sem carregar linhas em memória).

Nenhuma coluna nova em `AffiliateProfile` — saldo (disponível e devedor) permanece **derivado**, coerente com o comentário canônico do schema ("saldo continua DERIVADO... este ledger nunca sofre UPDATE").

## Extensão de `AffiliateCommission` (US1/US4) — sem coluna nova

- **US1**: comissão `paid` estornada passa a ter uma linha de dívida no ledger; a própria comissão pode ir para `reversed` (mantendo `reversedAt`/`reversalReason` já existentes). Nenhum campo novo.
- **US4**: comissão de toque órfão por dispositivo nasce `status='held'` com `heldAt`/`holdReason='orphan_device_attribution'` (campos já existentes). Nenhum campo novo.

## Estados e transições

### Comissão (existente, reforçado)
```
pending ──eligibleAt──▶ eligible ──mark-paid──▶ paid
   │                       │                      │
   └──risk/orphan──▶ held  └──reverse──▶ reversed  └──reverse(after paid)──▶ reversed + ledger:debt(-)
```
- No máximo **uma** `initial` por indicado (não-revertida) — FR-006.

### Saque (nova)
```
requested ──admin confirma──▶ paid   (abate debt primeiro; marca comissões paid; auditoria)
requested ──admin recusa───▶ rejected (com rejectionReason; saldo permanece)
```

## Migration (aditiva, idempotente)

Arquivo: `prisma/migrations/2026072x_affiliate_improvements_r1/migration.sql`

```sql
-- Aditiva: tabela nova + colunas nullable/com default. Sem rebuild de tabela
-- (ADD COLUMN e CREATE TABLE no SQLite não recriam a tabela) → sem lock
-- exclusivo prolongado; convive com API/supervisor rodando (pegadinha #8 não
-- se aplica). DML de backfill idempotente. Ver specs/009-affiliate-improvements-r1.

CREATE TABLE IF NOT EXISTS "AffiliatePayoutRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "affiliateId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" DATETIME,
  "resolvedByUserId" TEXT,
  "rejectionReason" TEXT,
  "settledCommissionIds" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AffiliatePayoutRequest_affiliateId_status_idx" ON "AffiliatePayoutRequest"("affiliateId", "status");
CREATE INDEX IF NOT EXISTS "AffiliatePayoutRequest_status_requestedAt_idx" ON "AffiliatePayoutRequest"("status", "requestedAt");

ALTER TABLE "AffiliateSettings" ADD COLUMN "minPayoutCents" INTEGER NOT NULL DEFAULT 5000;
ALTER TABLE "AffiliateSettings" ADD COLUMN "orphanTouchWindowDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "AffiliateSettings" ADD COLUMN "orphanTouchMode" TEXT NOT NULL DEFAULT 'both';
ALTER TABLE "AffiliateSettings" ADD COLUMN "payoutRequestsEnabled" BOOLEAN NOT NULL DEFAULT true;
```

> Nota: gerar via `prisma migrate dev` para manter o schema.prisma como fonte; o SQL acima é a forma esperada. `IF NOT EXISTS`/defaults tornam a aplicação idempotente e segura em staging antes de prod (FR-029).
