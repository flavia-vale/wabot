# Contrato — API de cupons da cliente

Registro: `app.register(couponsRoutes, { prefix: '/api/coupons' })` em
`src/api/server.js`. Todas as rotas exigem `app.authenticate` e operam **apenas**
sobre `req.user.sub` (FR-007 — nenhuma cliente enxerga cupom de outra; o `userId`
nunca vem do corpo nem da query).

**Invariante de toda rota que ESCREVE**: depois de gravar, chama
`await reloadWorkerConfig(userId)` (`src/api/workerConfigReload.js`) e registra
no log `couponReloaded` / `couponReloadError`. Falha do reload **não** reprova a
requisição — o cupom já está no banco e o TTL de 60s do cache do worker é a rede
de segurança (D1 da pesquisa).

---

## `GET /api/coupons`

Lista os cupons da cliente, do mais novo para o mais antigo.

```json
{
  "coupons": [
    {
      "id": "clx...",
      "code": "BEMVINDO10",
      "label": "Cupom de boas-vindas",
      "platform": "shopee",
      "discountType": "percent",
      "discountValue": 10,
      "validUntil": "2026-12-31T23:59:59.000Z",
      "enabled": true,
      "expired": false,
      "createdAt": "2026-09-19T12:00:00.000Z"
    }
  ]
}
```

`expired` é **calculado na resposta** pela regra pura, nunca gravado — assim a
tela e o envio usam a mesma definição de vencido (FR-005).

## `POST /api/coupons`

Corpo: `{ code, platform, discountType, discountValue, label?, validUntil? }`.

- `201` com o cupom criado (`enabled: true`).
- `400` com `{ error: "<mensagem em português simples>" }` nas recusas de FR-006
  (ver tabela em `data-model.md`). **Nunca** devolver nome de campo técnico.
- `409` **não existe**: código repetido é permitido. A duplicata vira o aviso
  `{ duplicateWarning: true }` na resposta `201`, e a tela mostra "você já tem um
  cupom igual para esta loja".

## `PUT /api/coupons/:id`

Mesmo corpo do `POST`, todos os campos opcionais. `404` se o cupom não for da
cliente. Mesmas recusas de validação.

## `PATCH /api/coupons/:id/enabled`

Corpo: `{ enabled: true | false }`. Existe separada do `PUT` porque ligar/desligar
é um clique na lista — mandar o cupom inteiro de volta só para virar uma chave
convida a sobrescrever campo sem querer.

Resposta: `{ id, enabled }`. **É a rota mais sensível ao FR-014**: o reload do
worker aqui é o que faz o desligamento valer nos próximos envios.

## `DELETE /api/coupons/:id`

`200` com `{ deleted: true }`. **Idempotente**: cupom que já não existe devolve
`200` com `{ deleted: false }`, no mesmo padrão de
`DELETE /credentials/:platform`.

---

## Mudança em rota existente

`POST` e `PUT` de `/api/offer-automations` passam a aceitar o campo booleano
`useCoupons`. Ausente = **não muda o valor atual** (no `PUT`) e `false` (no
`POST`) — FR-023. Nenhum outro campo muda, nenhuma resposta muda de formato.
