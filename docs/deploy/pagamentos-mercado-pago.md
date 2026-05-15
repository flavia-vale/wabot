# Pagamentos Mercado Pago — MVP BOTinho

## Modelo comercial

O BOTinho usa **links de assinatura fixos do Mercado Pago** para checkout.

| Plano | Preço | Link |
| --- | --- | --- |
| Basic | R$39 / 30 dias | `preapproval_plan_id=7417a34c47be40fdbc4bc1decc0233e0` |
| Pro | R$69 / 30 dias | `preapproval_plan_id=251ba8b89a8a483a89e4e6ba336adb5c` |

Os links estão hardcoded em `src/api/routes/payments.js` (campo `checkoutUrl` de cada plano).

## Variáveis de ambiente obrigatórias para produção

Configure no processo `api` no PM2/VPS:

| Variável | Uso |
| --- | --- |
| `MP_ACCESS_TOKEN` | Token privado do MP — usado pelo `/recover` para consultar o pagamento na API. |
| `MP_WEBHOOK_SECRET` | Segredo para validar a assinatura `x-signature` dos webhooks. Sem ele em produção o webhook rejeita todas as requisições. |

`FRONTEND_URL` e `API_URL` não são mais necessárias para o fluxo de checkout.

## Fluxo de ativação pós-pagamento

Como os links são fixos (sem metadados de usuário), o acesso é ativado manualmente pelo usuário após o pagamento:

1. Usuário clica em comprar → frontend redireciona para o link do MP.
2. Usuário paga no MP.
3. MP exibe o `payment_id` na página de confirmação e o envia por e-mail.
4. Usuário volta ao dashboard, informa o `payment_id` no campo de ativação.
5. Frontend chama `POST /api/payments/recover` com `{ paymentId }`.
6. Backend consulta o MP, confirma status `approved`, infere o plano pelo valor (R$39 = basic, R$69 = pro) e libera o acesso por 30 dias.

## Segurança do endpoint `/recover`

- Requer autenticação JWT — o acesso é concedido ao usuário logado.
- O `mpPaymentId` é único no banco — o mesmo pagamento não pode ativar duas contas.
- Se o `payment_id` já foi usado por outra conta, retorna `409 PAYMENT_ALREADY_USED`.

## Segurança do webhook

Em produção (`NODE_ENV=production`), `MP_WEBHOOK_SECRET` deve estar configurado. Com links fixos o webhook não processa acesso automaticamente (sem `metadata.userId`), mas a validação de assinatura protege o endpoint contra requisições falsas.
