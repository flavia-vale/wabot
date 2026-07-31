# Contract — Eventos AnalyticsEvent (novos)

Dois eventos novos entram na **allowlist** `ANALYTICS_EVENTS` de `src/analytics.js` (edição de
código, **não** de schema). Ambos amarram estado ao lead por `userId`. A metadata passa por
`sanitizeAnalyticsMetadata` (descarta chaves sensíveis e trunca strings a 80) — por isso só
carregamos valores **não sensíveis** (número do passo, rótulo curto).

## `nurture_email_sent`

Registra que um passo da trilha foi **efetivamente enviado** (não-`skipped`) a um lead.

| Campo | Valor |
|---|---|
| `event` | `'nurture_email_sent'` |
| `userId` | id do `User` lead |
| `metadata` | `{ step: 0 \| 2 \| 5 \| 7 }` |

- Gravado por: `runNurtureSweep` (passos 2/5/7, só após `sendMail` não-`skipped`) e `/register`
  (passo 0 = welcome — D4).
- Leitura: `sentSteps(userId)` = conjunto de `metadata.step`. Base da idempotência (FR-006/SC-002).
- Invariante: **nunca** gravar quando o envio foi `skipped` (sem SMTP) — senão queima o passo (SC-006).

## `nurture_unsubscribed`

Registra o opt-out durável de um lead (LGPD).

| Campo | Valor |
|---|---|
| `event` | `'nurture_unsubscribed'` |
| `userId` | id do `User` lead |
| `metadata` | `{ via: 'link' }` (sem PII) |

- Gravado por: `GET /api/lead-nurture/unsubscribe` (token válido).
- Leitura: `isUnsubscribed(userId)` = existe ≥1 evento. Checado antes de todo envio e da semeadura
  do step 0 (FR-005/SC-003). Prevalece para sempre (novo download não reinicia — US2 cenário 3).

## Edição em `src/analytics.js`

Adicionar à `ANALYTICS_EVENTS` (Set):

```js
// Trilha de nutrição de leads (011-lead-nurture-emails): passo enviado (idempotência)
'nurture_email_sent',
// Opt-out durável da trilha de nutrição (LGPD) — prevalece sobre novos downloads.
'nurture_unsubscribed',
```

Nenhuma mudança em `PUBLIC_ANALYTICS_EVENTS` (não são eventos disparados pelo front público).
