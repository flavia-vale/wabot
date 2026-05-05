# Pagamentos Mercado Pago — MVP Wabot

## Modelo comercial definido

O MVP do Wabot usa **acesso por 30 dias renovável manualmente**.

- `Basic`: R$50 por 30 dias de acesso.
- `Pro`: R$100 por 30 dias de acesso.
- Não há assinatura recorrente automática nesta fase.
- A tela de planos só deve comunicar acesso ativo depois de confirmação do backend.

## Variáveis de ambiente obrigatórias para produção

Configure estas variáveis no ambiente do processo `api` no PM2/VPS:

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `MP_ACCESS_TOKEN` | Sim | Token privado do Mercado Pago usado para criar preferências e consultar pagamentos. |
| `MP_WEBHOOK_SECRET` | Sim em produção | Segredo usado para validar a assinatura `x-signature` dos webhooks do Mercado Pago. Webhooks sem assinatura válida são rejeitados em produção. |
| `FRONTEND_URL` | Sim | URL pública do dashboard usada nos retornos do checkout. Ex.: `http://178.105.54.0`. |
| `API_URL` | Sim | URL pública da API usada como `notification_url`. Ex.: `http://178.105.54.0` quando API e dashboard estão no mesmo domínio/proxy. |

## Fluxo esperado pós-checkout

1. Usuário clica em comprar `Basic` ou `Pro`.
2. Backend cria preferência no Mercado Pago com metadados `userId` e `plan`.
3. Mercado Pago redireciona para `/dashboard/planos?status=success`, `failure` ou `pending`.
4. A tela consulta `/api/payments/status`.
5. A mensagem de acesso ativo só aparece se o backend retornar plano pago ativo.
6. Se o webhook ainda não processou, a tela mostra estado de confirmação pendente.

## Segurança do webhook

Em produção (`NODE_ENV=production`), `MP_WEBHOOK_SECRET` deve estar configurado. Sem esse segredo, o webhook responde com erro e não processa pagamentos. Com segredo configurado, assinaturas ausentes ou inválidas retornam `401`.
