# Phase 1 — Data Model: Fallback de vitrine ML quando o SSID está vencido

Feature **sem persistência nova** (sem migração). As "entidades" abaixo são
lógicas/em-memória — descrevem os dados que a decisão pura e o log consomem.

## Entidades lógicas

### 1. Falha de conversão do ML (`mlFailureType`)
Classificação já produzida por `classifyMlAffiliateFailure`
(`src/converters/mercadolivre.js`).

| Campo         | Valores                                                     | Origem |
|---------------|------------------------------------------------------------|--------|
| `failureType` | `expired` \| `forbidden` \| `rate_limited` \| `unsupported_url` \| `busy` | status HTTP / error_code 111 |

Relevantes para esta feature: `expired` (SSID vencido) e `unsupported_url`
(fora do programa). Os demais → `passthrough` (comportamento atual).

### 2. Link de vitrine direta (`isDirectVitrine`)
Booleano derivado de `isDirectVitrineShare(originalUrl)` — `true` só quando o
link ORIGINAL já era `/social/...` no host ML (certeza de vitrine/perfil).

### 3. Vitrine própria cadastrada (`hasVitrine`)
Booleano derivado de `!!buildVitrineFallback(creds)`, que por sua vez valida
`creds.vitrineUrl` via `isValidMlVitrineUrl`. Fonte: `Credential.data.vitrineUrl`
(sem coluna/tabela nova).

### 4. Decisão de fallback (outcome — saída da função pura)
Enum de saída de `decideVitrineFallback`:

| Outcome           | Efeito em `convertMlCouponWithoutProduct` |
|-------------------|--------------------------------------------|
| `use_vitrine`     | retorna `buildVitrineFallback(creds)` → oferta sai com a vitrine própria + `warning:ml_vitrine_fallback_used` |
| `missing_vitrine` | lança erro sinalizado → log `skip:ml_vitrine_missing`, status `skipped` |
| `discard`         | retorna `null` → mensagem descartada silenciosamente (caso ambíguo) |
| `passthrough`     | `if (err.mlFailureType) throw err` → comportamento atual (renovar SSID / partner_id) |

### 5. Registro de Envio (`MessageLog`) — só valores novos, sem schema novo
| Campo      | Valor para "vitrine ausente" | Observação |
|------------|------------------------------|------------|
| `errorMsg` | `skip:ml_vitrine_missing`    | novo prefixo canônico (categoria `config_block`) |
| `status`   | `skipped`                    | painel pinta cinza "Ignorado" (benign skip) |
| `destGroup`| `conversion`                 | igual ao diagnóstico de conversão atual |

Para `use_vitrine` o log de sucesso paralelo continua `warning:ml_vitrine_fallback_used`
com status `info` (feature 004, inalterado).

## Regras de validação (invariantes)

- **INV-1**: a decisão nunca substitui link de produto — só é alcançada via
  `!cleanTarget` em `convert()` (guard L1031-1039). (FR-008)
- **INV-2**: `expired` com `isDirectVitrine=false` → SEMPRE `passthrough`
  (produto com SSID vencido mantém "renovar SSID"). (FR-006/US3)
- **INV-3**: `use_vitrine` só quando `hasVitrine=true`; caso contrário nunca se
  encaminha link de terceiro (segurança de comissão). (FR-001, invariante ML)
- **INV-4**: o motivo `skip:ml_vitrine_missing` NÃO contém texto sobre renovar/
  atualizar SSID em nenhum tradutor. (FR-005)
- **INV-5**: função pura — mesmos inputs ⇒ mesmo outcome, sem I/O.

## Transições de estado (fluxo de decisão)

```
createLink recusa (err.mlFailureType)
        │
        ▼
isDirectVitrine = isDirectVitrineShare(url)
hasVitrine      = !!buildVitrineFallback(creds)
        │
        ▼
decideVitrineFallback({ failureType, isDirectVitrine, hasVitrine })
        │
  ┌─────┼───────────────┬───────────────┬───────────────┐
  ▼     ▼               ▼               ▼               ▼
use_vitrine        missing_vitrine   discard        passthrough
(retorna           (throw sinalizado (retorna null) (throw err
 fallback)          → skip:ml_          silencioso)   original →
                    vitrine_missing)                   SSID/partner_id)
```
