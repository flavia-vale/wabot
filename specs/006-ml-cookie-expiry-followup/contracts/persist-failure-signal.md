# Contrato — Sinal de falha de persistência (#4)

## Novo sinal operacional

- Nome curto: `ml_patch_persist_failed`
- Evento durável: `ops_ml_patch_persist_failed`

### Registro (dois lugares obrigatórios)

- `src/observability/operationalSignals.js` — mapa nome→evento:
  `ml_patch_persist_failed: 'ops_ml_patch_persist_failed'`
- `src/analytics.js` — allowlist `ANALYTICS_EVENTS`:
  `'ops_ml_patch_persist_failed'` (sem isso o `AnalyticsEvent` durável é descartado).

## Emissão

Nos `catch` da persistência de rotação em `productInfoScraper.js` (eixos OAuth e cookie), substituir o bloco vazio por:

```
} catch (err) {
  logger.warn({ err, axis }, 'ML credential rotation persist failed')
  recordOperationalSignal('ml_patch_persist_failed', { axis }) // axis: 'oauth' | 'cookie'
}
```

- `axis` distingue o eixo (`'oauth'` no bloco de `getMlUserToken`/item token; `'cookie'` no novo bloco de rotação de cookie).
- **Metadata sem segredo/PII**: apenas `{ axis }`. Nunca o valor do cookie/token.

## Invariantes

- **FR-011**: falha de persistência sempre emite `logger.warn` (nunca `catch` vazio).
- **FR-012**: sempre registra o evento durável; presente na allowlist.
- **FR-013**: best-effort — nem a falha de persistência nem o registro do evento podem interromper ou propagar erro ao fluxo de scrape. `recordOperationalSignal` já trata a emissão durável como best-effort (contador in-memory é a fonte confiável).

## Testes (node:test, db-free/env-free)

- `operationalSignals`: `recordOperationalSignal('ml_patch_persist_failed', { axis: 'cookie' })` roteia para `ops_ml_patch_persist_failed` (mapa) e incrementa o contador.
- `productInfoScraper`: com `__onCredentialPatch` stub que lança, o fluxo de scrape retorna normalmente e o sinal é registrado (spy em `recordOperationalSignal`), para os dois eixos.
