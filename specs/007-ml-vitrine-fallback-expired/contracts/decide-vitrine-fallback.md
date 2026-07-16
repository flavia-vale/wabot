# Contrato: `decideVitrineFallback` (função pura leaf)

**Arquivo**: `src/converters/mlVitrinePolicy.js` (novo, leaf — sem imports
pesados, sem I/O).

## Assinatura

```
decideVitrineFallback({ failureType, isDirectVitrine, hasVitrine }) -> outcome
```

- `failureType: string` — tipo de falha do ML (`expired` | `unsupported_url` |
  `forbidden` | `rate_limited` | `busy` | qualquer outro/undefined).
- `isDirectVitrine: boolean` — resultado de `isDirectVitrineShare(originalUrl)`.
- `hasVitrine: boolean` — `!!buildVitrineFallback(creds)`.
- **retorno** `outcome: 'use_vitrine' | 'missing_vitrine' | 'discard' | 'passthrough'`.

Função **pura**: mesma entrada ⇒ mesma saída, sem efeitos colaterais.

## Tabela-verdade normativa (cobrir 1:1 em teste)

| # | failureType       | isDirectVitrine | hasVitrine | outcome           |
|---|-------------------|-----------------|------------|-------------------|
| 1 | `unsupported_url` | `false`         | `true`     | `use_vitrine`     |
| 2 | `unsupported_url` | `true`          | `true`     | `use_vitrine`     |
| 3 | `unsupported_url` | `true`          | `false`    | `missing_vitrine` |
| 4 | `unsupported_url` | `false`         | `false`    | `discard`         |
| 5 | `expired`         | `true`          | `true`     | `use_vitrine`     |
| 6 | `expired`         | `true`          | `false`    | `missing_vitrine` |
| 7 | `expired`         | `false`         | `true`     | `passthrough`     |
| 8 | `expired`         | `false`         | `false`    | `passthrough`     |
| 9 | `forbidden`       | `true`          | `true`     | `passthrough`     |
| 10| `rate_limited`    | `true`          | `false`    | `passthrough`     |
| 11| `undefined`/outro | qualquer        | qualquer   | `passthrough`     |

### Regras derivadas (equivalentes à tabela)
- `use_vitrine` ⟺ `hasVitrine` E ( `failureType==='unsupported_url'` OU
  (`failureType==='expired'` E `isDirectVitrine`) ).
- `missing_vitrine` ⟺ `!hasVitrine` E `isDirectVitrine` E `failureType ∈
  {'unsupported_url','expired'}`.
- `discard` ⟺ `failureType==='unsupported_url'` E `!isDirectVitrine` E `!hasVitrine`.
- `passthrough` ⟺ nenhum dos acima (inclui todo `expired` não-vitrine e todo
  outro `failureType`).

## Requisitos rastreados
- FR-001 (linhas 2,5), FR-003 (3,6), FR-006/US3 (7,8), FR-008 (INV-1, garantido
  a montante), preservação 004 (1,2).
