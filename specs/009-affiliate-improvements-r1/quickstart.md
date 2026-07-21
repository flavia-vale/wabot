# Quickstart / Validação: Melhorias no programa de afiliados (rodada 1)

Guia de validação end-to-end por User Story. Testes puros rodam localmente sem DB/env; validação de rota/painel roda em **staging** (`http://178.105.54.0:3006`) antes de `main` (FR-029).

## Pré-requisitos
- Branch `009-affiliate-improvements-r1` mergeada em `develop` → autodeploy staging.
- Migration aplicada: `npx prisma migrate deploy` (staging). Conferir colunas novas: `sqlite3 prisma/staging.db "PRAGMA table_info('AffiliateSettings')"` deve listar `minPayoutCents`, `orphanTouchWindowDays`, `orphanTouchMode`, `payoutRequestsEnabled`; e `.tables` deve conter `AffiliatePayoutRequest`.

## Testes unitários (db-free/env-free — rodar antes de tudo)
```bash
node --test test/affiliate-pix-validation.test.js \
            test/affiliate-balance.test.js \
            test/affiliate-payout-policy.test.js \
            test/affiliate-orphan-touch-policy.test.js \
            test/affiliate-stuck-promotion.test.js \
            test/affiliate-service.test.js
```
Esperado: todos verdes. Cobrem FR-001..003, FR-006, FR-008/009, FR-019/020, FR-025/026, FR-027/028.

## US1 — Estorno de comissão paga vira dívida
1. Ter comissão `paid` de R$30 de um afiliado.
2. Disparar reembolso/chargeback do pagamento (webhook MP em staging) → `reverseAffiliateCommissionForPayment`.
3. Conferir: linha `toStatus='debt'` com `amountCents=-3000` no `AffiliateCommissionLedger`; saldo devedor R$30 em `GET /affiliate/me` e no admin (FR-004).
4. Reprocessar o mesmo estorno → **não** duplica a dívida (FR-003).
5. Próximo repasse com R$100 elegíveis → repassa R$70, dívida zera (ledger `debt_settled`).

## US2 — Saque self-service
1. Afiliado com saldo ≥ `minPayoutCents` (R$50) e **sem** dívida → `POST /affiliate/payout-requests` retorna `requested`.
2. Saldo < mínimo → 400 com o valor mínimo na mensagem.
3. Com dívida pendente → 409 (FR-013). Com pedido já aberto → 409 (FR-014).
4. Admin: `GET /admin/affiliates/payout-requests?status=requested` mostra o pedido; `.../confirm` → comissões viram `paid`, `AdminAuditLog` registrado; `.../reject` com motivo → `rejected`, saldo permanece.

## US3 — Validação PIX
```bash
# CPF inválido → 400
curl -sX POST $BASE/api/affiliate/apply -H "Authorization: Bearer $JWT" \
  -H 'content-type: application/json' -d '{"pixKey":"11111111111","pixKeyType":"cpf"}'
# e-mail válido → 200, chave cifrada em repouso
```
Conferir no banco que `pixKey` está no formato `v1:...` (cifrado) e que combinações inválidas de tipo×chave retornam 400 (FR-019/020/021).

## US4 — Atribuição órfã endurecida
1. Settings no default (`orphanTouchWindowDays=7`, `orphanTouchMode=both`).
2. Toque anônimo por dispositivo dentro de 7d + pagamento → comissão nasce `held` (visível ao admin, FR-010).
3. Toque > 7d → nenhuma atribuição por dispositivo (FR-008).
4. Ajustar settings (janela/modo) e repetir → respeita config vigente (FR-009).

## US5 — E-mails
1. Com `SMTP_*` configurado em staging: aprovar candidatura / promover elegível / marcar paga → e-mail chega a endereço real.
2. Sem `SMTP_*`: os 4 eventos ocorrem e o fluxo conclui sem enviar nada (FR-023).
3. Afiliado com e-mail `user_*@sistema.com` → nenhum envio (FR-024).

## US6 — Alarme de promoção travada
1. Criar comissões `pending` com `eligibleAt` vencido > 24h.
2. Aguardar o tick do cron (ou invocar `checkStuckPromotions`) → `log.error` + `AnalyticsEvent('ops_affiliate_promotion_stuck')`.
   ```bash
   sqlite3 prisma/staging.db "SELECT COUNT(*) FROM AnalyticsEvent WHERE type='ops_affiliate_promotion_stuck'"
   ```
3. Sem comissões vencidas além do limiar → nenhum evento (FR-026).

## US7 — Corrida initial/recurring + contagens
1. Dois pagamentos concorrentes do mesmo indicado → exatamente **uma** comissão `initial` (FR-006); mesmo `paymentId` 2× → sem duplicata (FR-007).
2. `GET /affiliate/me` com comissões revertidas: "Vendas" (mensal) e "Vendas válidas" coincidem, ambas excluindo revertidas (FR-027); `lifetimeEarnedCents` (não revertidas) ≠ total pago (FR-028).

## Verificação final (SC-009)
- Confirmar que nenhum código desta feature grava fingerprint: `AffiliateAttributionTouch.ipHash/uaHash` **não** recebem novos valores por esta feature (FR-031).

## Suite completa
```bash
node --test
```
