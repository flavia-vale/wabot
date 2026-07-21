# Contrato: Configurações do programa (US2/US4) — extensão

Estende `PUT /admin/affiliates/settings` (`billing:write`) e `GET /admin/affiliates/settings` com 4 campos novos. Campos existentes inalterados.

## Campos novos

| Campo | Tipo | Default | Validação | US |
|---|---|---|---|---|
| `minPayoutCents` | number | 5000 | inteiro ≥ 0 | US2 |
| `orphanTouchWindowDays` | number | 7 | inteiro 1–365 | US4 |
| `orphanTouchMode` | string | "both" | ∈ `off`\|`window`\|`hold`\|`both` | US4 |
| `payoutRequestsEnabled` | boolean | true | booleano | US2 |

### GET /admin/affiliates/settings
- **200**: objeto de settings incluindo os 4 campos novos.

### PUT /admin/affiliates/settings
- **Body** (parcial, upsert): quaisquer campos existentes + os 4 novos.
- **400** `{ error }` — validação de qualquer campo novo falha (mensagem específica por campo).
- **200**: settings atualizadas.

## Semântica `orphanTouchMode` (consumida por `orphanTouchPolicy.js`)
- `off` — comportamento legado (janela 30d hardcoded desativada → usa `orphanTouchWindowDays`; sem hold).
- `window` — só encurta a janela; comissão segue fluxo normal.
- `hold` — janela padrão das settings + comissão resultante em `held`.
- `both` (default seguro) — janela curta **e** `held`.
