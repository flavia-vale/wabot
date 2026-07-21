# Contrato: Solicitações de saque (US2)

Todas as rotas sob Fastify com `onRequest: [app.authenticate]`. Rotas admin exigem `requireAdminAccess(req, reply, 'billing:write')` e escrevem `AdminAuditLog` (FR-017).

## Afiliado

### POST /affiliate/payout-requests
Cria uma solicitação de saque do saldo disponível.

- **Auth**: usuário autenticado (afiliado aprovado).
- **Body**: `{}` (o valor é o saldo disponível calculado no servidor — nunca vem do cliente).
- **200**: `{ payoutRequest: { id, amountCents, status: "requested", requestedAt } }`
- **400** `{ error }` — saldo abaixo do mínimo (mensagem inclui `minPayoutCents`) (FR-012).
- **409** `{ error }` — saldo devedor pendente (FR-013) **ou** já existe solicitação em aberto (FR-014).
- **403** `{ error }` — afiliado não aprovado ou `payoutRequestsEnabled=false`.

Decisão de elegibilidade delegada a `payoutPolicy.canRequestPayout({ availableCents, debtCents, minPayoutCents, hasOpenRequest })` (puro).

### GET /affiliate/payout-requests
Lista as solicitações do próprio afiliado (histórico + aberta).

- **200**: `{ requests: [{ id, amountCents, status, requestedAt, resolvedAt, rejectionReason }], available: { availableCents, debtCents, minPayoutCents, canRequest } }`

O bloco `available` alimenta o painel (botão habilitado/desabilitado + saldo devedor visível, FR-004).

## Admin

### GET /admin/affiliates/payout-requests?status=requested
Fila de saques para o admin.

- **200**: `{ requests: [{ id, affiliateId, affiliateCode, amountCents, status, requestedAt, debtCents }], total }`

### POST /admin/affiliates/payout-requests/:id/confirm
Confirma o pagamento; reaproveita o mecanismo `mark-*-paid`.

- **Efeito**: abate `debtCents` primeiro (grava ledger `debt_settled`), marca as comissões elegíveis/aprovadas correspondentes como `paid`, seta `status='paid'`, `resolvedAt`, `resolvedByUserId`, `settledCommissionIds`. Auditoria `admin.affiliate.payout.confirm`. Dispara e-mail "comissão paga" (US5, best-effort).
- **200**: `{ payoutRequest }`
- **409** `{ error }` — solicitação não está em `requested` (recarregar).

### POST /admin/affiliates/payout-requests/:id/reject
Recusa com motivo.

- **Body**: `{ reason: string }` (obrigatório, ≤ 500 chars).
- **Efeito**: `status='rejected'`, `rejectionReason`, `resolvedAt/By`. Saldo do afiliado permanece disponível (FR-015). Auditoria `admin.affiliate.payout.reject`.
- **200**: `{ payoutRequest }`
- **400** `{ error }` — motivo ausente.

## Invariantes
- O valor sacado nunca é informado pelo cliente (evita adulteração) — sempre o saldo disponível derivado no servidor.
- Confirmar/recusar são idempotentes por estado (`updateMany where status='requested'`, checa `count===1`).
- Toda ação admin gera `AdminAuditLog`.
