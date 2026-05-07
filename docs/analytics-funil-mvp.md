# Analytics de funil — MVP BOTinho

## Ferramenta escolhida

Para o MVP, o BOTinho usa **eventos internos simples** gravados na tabela `AnalyticsEvent`.

Motivos:
- não depende de ferramenta externa para começar;
- evita envio de credenciais, cookies, tokens, mensagens completas ou dados pessoais para terceiros;
- pode ser desabilitado em local/teste com `ANALYTICS_ENABLED=false`.

## Eventos rastreados

| Evento | Origem | Metadados permitidos |
| --- | --- | --- |
| `signup_created` | Cadastro criado | `hasReferral` |
| `login_completed` | Login realizado | `plan` |
| `whatsapp_connected` | Sessão WhatsApp conectada | nenhum |
| `credential_saved` | Credencial salva | `platform` |
| `monitor_group_created` | Grupo monitorado criado | `role` |
| `post_group_created` | Grupo destino criado | `role` |
| `checkout_started` | Checkout iniciado | `plan` |
| `payment_pending` | Webhook de pagamento pendente | `plan`, `status` |
| `payment_approved` | Webhook de pagamento aprovado | `plan`, `status` |
| `payment_failed` | Webhook de pagamento falho/rejeitado | `plan`, `status` |
| `first_send_success` | Envio/log de sucesso | `platform` |
| `send_error` | Erro de envio | `platform`, `errorType` |

## Privacidade e segurança

O sanitizador de analytics remove chaves sensíveis por padrão, incluindo `token`, `secret`, `password`, `cookie`, `credential`, `csrf`, `ssid`, `key`, `message`, `text`, `url`, `phone` e `email`.

## Como conferir eventos

Na VPS, após deploy e migration:

```bash
cd /home/deploy/BOTinho
sqlite3 prisma/dev.db "SELECT event, COUNT(*) FROM AnalyticsEvent GROUP BY event ORDER BY COUNT(*) DESC;"
sqlite3 prisma/dev.db "SELECT event, metadata, createdAt FROM AnalyticsEvent ORDER BY createdAt DESC LIMIT 20;"
```

## Desabilitar em ambiente local/teste

```bash
ANALYTICS_ENABLED=false
```
