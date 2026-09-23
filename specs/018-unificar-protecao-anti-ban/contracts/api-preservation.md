# Contrato — rotas `/api/preservation/*` e gate de plano

**Nenhuma rota nova, nenhuma rota removida.** Compatibilidade retroativa total.

## Escrita (PUT/POST) — inalterada no formato

| Rota | Campos que viraram fixos | Comportamento |
|---|---|---|
| `PUT /api/preservation/config` | `channelStaggerJitterMs` | aceita 0..600000 como hoje e grava; efeito no envio = piso (`max(v, 20000)`) |
| `POST /presets`, `PUT /presets/:id` | `burstCap`, `burstWindowSec`, `throttleEnabled` | aceita e grava; efeito = piso |
| `PUT /destinations/:id` | idem (nulável = herdar) | aceita e grava; efeito = piso |

Nenhum campo da mesma requisição é descartado (FR-013). Validação de faixa e
mensagens de erro de faixa ficam como estão (a tela nova não envia esses campos).

## Leitura (GET) — campos ADITIVOS

- `GET /config` → soma `effective: { channelStaggerJitterMs }` e
  `ritmoMaisCuidadoso: boolean`.
- `GET /presets` → cada preset soma `ritmoMaisCuidadoso`.
- `GET /destinations` → cada destino soma `ritmoMaisCuidadoso` (calculado sobre o
  que está gravado no destino e, se herdando, no modelo) e
  `effective` (config resolvida com piso).

Campos antigos continuam no payload (cliente antigo não quebra).

## Gate de plano

- Fonte única: `canUseAdvancedPreservation` (`src/billing/plans.js`).
- Códigos HTTP inalterados: `preservation.js` → 402, `config.js`/`groups.js` → 403
  (não unificar agora; registrado em research R5).
- Corpo (`buildFeatureGateError(ADVANCED_PRESERVATION)`): `code`, `feature`,
  `requiredPlan` inalterados; **`error` muda** para
  `"O Anti-banimento é um recurso do plano PRO."` — sem prometer que não bane,
  sem jargão.
- Recusa continua registrada como hoje nas demais features por plano.
