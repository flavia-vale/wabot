# Contrato — `GET /logs/credential-block`

Rota nova em `src/api/routes/logs.js` (prefixo `/logs`, já registrado). Autenticada com
`app.authenticate`, escopo do próprio usuário (`req.user.sub`) — nunca aceita `userId` por
parâmetro.

## Por que rota nova

- `GET /logs/summary` funde `skip:no_valid_conversions` no balde `skippedConfig` e não
  seleciona `platform`.
- `GET /dashboard/status` só devolve `hasCredentials` (booleano global) e é **poluído a cada
  10 s** pelo `ActivationChecklist` — pendurar agregação ali multiplicaria consulta por cliente
  aberta no painel.
- `GET /credentials/` descreve o cadastro, não os bloqueios.

## Request

```
GET /logs/credential-block
Authorization: Bearer <jwt>
```

Sem parâmetros. Janela fixa de 7 dias (constante no módulo, não query param — evita rota
virar superfície de varredura arbitrária do histórico).

## Response 200

```json
{
  "stores": [
    {
      "platform": "shopee",
      "storeLabel": "Shopee",
      "blockedCount": 12,
      "lastBlockedAt": "2026-08-19T14:03:11.000Z",
      "headline": "As ofertas da Shopee não estão saindo",
      "body": "…",
      "nextStep": "…",
      "href": "/painel/ids-afiliada"
    }
  ]
}
```

`stores: []` quando não há nada a avisar. **Sem credencial faltando ⇒ lista vazia** (FR-021,
cenário 6 da US3).

## Regras de montagem

1. Consulta indexada (`@@index([userId, status, sentAt])`):
   `userId`, `status: 'skipped'`, `sentAt >= agora − 7d`, `errorMsg` começando em
   `skip:no_valid_conversions`. Agrega por `platform`.
2. Cruza com `db.credential.findMany({ where: { userId }, select: { platform: true } })`.
   **Loja com credencial cadastrada é descartada** — quem avisa esse caso é
   `src/credentialExpiry/` (FR-020). O aviso novo nunca duplica nem contradiz o existente.
3. Textos vêm de `src/credentialBlockAlert/message.js` (módulo **puro**, sem DB, testável
   isolado), que expõe:
   ```
   buildCredentialBlockAlerts({ blockedByPlatform, configuredPlatforms }) -> stores[]
   ```
4. **Sem cache.** O cliente chama no mount e no `focus` da janela, sem intervalo. Não cria
   estrutura em memória (o `summaryCache` do mesmo arquivo é um `Map` sem despejo; replicar o
   padrão adicionaria vazamento sem necessidade).

## Erros

| Situação | Resposta |
|---|---|
| sem token / token inválido | 401 (padrão do `authenticate`) |
| falha de banco | 500; o painel **não** renderiza aviso nenhum (nunca inventa alerta) |

## Invariantes de texto (verificadas em teste, não em revisão)

| Regra | FR |
|---|---|
| Shopee: "as ofertas … param de sair" | FR-018 |
| Mercado Livre / Amazon: "continuam saindo … link mais comprido"; nunca "parou" | FR-019 |
| nenhum `cookie`, `SSID`, `tag`, `partner_id`, `?tag=`, `amzn.to` no texto exibido | FR-017 |
| todo item traz o que aconteceu, o porquê e o próximo passo | FR-016 |
| textos de Shopee e de ML/Amazon em constantes separadas | FR-018/FR-019 |

## O que esta rota NÃO faz

- Não altera a recusa de publicação (`skip:no_valid_conversions` continua igual) — Out of Scope
  da spec.
- Não dispara e-mail. Os oito e-mails de "Contato e escuta" continuam manuais (FR-022).
- Não grava nada.
