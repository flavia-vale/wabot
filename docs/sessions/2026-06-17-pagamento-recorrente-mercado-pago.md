# Session Documentation
Date: 2026-06-17

## Summary
Implementado backend completo de assinatura recorrente via Mercado Pago Preapproval, com persistência, webhook e concessão de acesso. Frontend (botão "Assinar") não incluído nesta sessão.

## Changes

### Features
- feat(payments): add `Subscription` model (mpSubscriptionId, plan, status, nextChargeAt, cancelledAt) com relação User.subscriptions
- feat(payments): add migration `20260617000000_add_subscription` (FK ON DELETE CASCADE, índice userId+status)
- feat(payments): add `POST /api/payments/create-subscription` — cria Preapproval no MP e persiste Subscription, retorna init_point
- feat(payments): add `upsertSubscription` e `findSubscriptionByMpId` em payments/service.js
- feat(payments): add `activateSubscriptionAccess` (+30d, idempotente por mpPaymentId)
- feat(payments): handle webhook `subscription_preapproval` → upsertSubscription
- feat(payments): handle webhook `subscription_authorized_payment` → activateSubscriptionAccess + comissão afiliado
- feat(payments): `/overview` reflete autoRenew:true e nextChargeAt quando há subscription authorized

### Tests
- test(payments): casos para upsertSubscription, activateSubscriptionAccess e idempotência em payments-service.test.js
- test(payments): casos para predicados shouldHandleSubscriptionPreapproval/shouldHandleSubscriptionAuthorizedPayment em payments-webhook.test.js

## Technical Decisions

- Mantido axios raw (sem SDK mercadopago), consistente com checkout avulso existente.
- Identificação do usuário no webhook recorrente via `findSubscriptionByMpId(preapproval_id)`, não via external_reference do payment — o MP não garante external_reference em authorized_payment.
- mpPaymentId prefixado com `sub_` nos pagamentos recorrentes para não colidir com o namespace de pagamentos avulsos na tabela de dedup (WebhookEvent).
- Reuso total das peças existentes: validação HMAC, dedup via WebhookEvent, comissão de afiliado, concessão acumulada de 30 dias.
- Webhook responde ok:true imediatamente ao MP; processamento assíncrono via processPendingWebhookEvents (ativado por BILLING_WEBHOOK_AUTOPROCESS=true).

## Próximos Passos

- Configurar eventos `subscription_preapproval` e `subscription_authorized_payment` no painel MP (Webhooks), apontando para `https://espelhagrupos.com.br/api/payments/webhook`; usar token sandbox em staging.
- Rodar migration em staging parando apps PM2 antes (pegadinha #8): `pm2 stop api-staging bot-supervisor-staging telegram-offer-bot-staging` antes do `prisma migrate deploy`.
- Validar end-to-end em staging (http://178.105.54.0:3006) antes de produção.
- Implementar UI do dashboard (botão "Assinar") — não coberto nesta sessão.
- Status dos testes: 980/983 passam; 3 falhas pré-existentes por sqlite3 ausente no ambiente, sem relação com a feature.
