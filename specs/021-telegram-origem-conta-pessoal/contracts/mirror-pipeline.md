# Contrato — `src/core/mirrorPipeline.js` e `src/core/mirrorDestinationDedup.js`

Módulos compartilhados entre o robô do WhatsApp (`src/bot-worker.js`) e a passada
de origem do Telegram na API (`src/telegramOrigin/inboxSweep.js`). Nascem no PR-1
por **movimentação sem edição** (plan.md §D1). Ficam em `src/core/` → qualquer
mudança futura reinicia o `bot-supervisor` (é a mesma regra para os dois aplicativos).

## `prepareMirrorOffer(input, deps) → Promise<Result>`

### input
| Campo | Tipo | Origem no worker hoje |
|---|---|---|
| `text` | string | `extractIncomingText(...)` (`bot-worker.js:4847`) |
| (tipo da mensagem) | não é campo de entrada | hoje `detectMessageKind(innerMessage, sanitizedText)` (`:4940`) é calculado DEPOIS do sanitizador; no módulo vira o callback `deps.messageKindFor(sanitizedText)` para manter a ordem exata |
| `monitorGroup` | objeto de `cfg.groups.monitor` | `:4751` |
| `cfg` | `{ botConfig, credentials, plan, ... }` de `getConfig()` / `buildEntitledGroupConfig` | `:4749` |
| `ids` | `{ userId, sourceId, msgId }` | `userId`, `jid`, `msg.key.id` |

### deps (injetadas — é isto que torna o módulo usável fora do worker)
| Dep | Worker passa | API passa |
|---|---|---|
| `recordLog(row)` | `db.messageLog.create({ data: row }).catch(() => {})` | idem (mesma forma de linha) |
| `convertLink(platform, url, credentials, opts)` | `convertLink` de hoje | `src/core/linkCore.js` (o mesmo conversor) |
| `messageKindFor(sanitizedText)` | `detectMessageKind(innerMessage, sanitizedText)` | `telegramMessageKind(message, sanitizedText)` |
| `logger` | logger do worker | logger da API |
| `unsupportedStoreSignal`, `logMonitoredSourceDrop`, `trackAnalyticsEventSafe` | os de hoje | os mesmos módulos (já fora do worker) ou no-op documentado |
| `scrapeProductTitle` | o de hoje | o mesmo |

### Result
```
{ kind: 'drop' }                       // motivo JÁ gravado via recordLog, idêntico ao de hoje
| { kind: 'offer',
    finalText, sanitizedText, links, conversions, linkResults,
    primary: { platform, url, converted, linkKind },
    isCouponMsg, templateApplied, couponContext,
    titleOverlap: 'match'|'mismatch'|'unknown',
    dedupWindows: { effectiveDedupWindowMs, pendingDedupMaxAgeMs } }
```

### Invariantes (testadas)
1. Para toda entrada da tabela de equivalência, as linhas passadas a `recordLog` e o `finalText` são **idênticos** aos produzidos pelo código inline antes da extração (T-E4).
2. O corpo é o trecho original byte a byte, salvo a lista declarada de substituições (T-E1).
3. O módulo não importa Baileys, socket, `telegram` nem `src/telegramOrigin/` (T-E2).
4. Mídia, estratégia de imagem, Story do Instagram, dedup local em arquivo e envio **não** estão aqui.

## `src/core/mirrorDestinationDedup.js`

- `findRecentDestinationDuplicate({ db, userId, destJid, urls, windowMs, pendingMaxAgeMs, now })` → `{ id, sentAt, status } | null` — o `findFirst` de `bot-worker.js:5745–5790`, movido.
- `reserveSendDedupKeys({ db, userId, destJid, dedupKeys, ttlMs, now })` → `{ reservedIds, duplicate, duplicateKey, ageMs }` — o bloco de `:5817–~5900`, movido.
- Usados por: espelhamento do worker (como hoje), ramo `options.mirror` do broadcast (novo, worker), nunca pela caixa de saída (que tem a própria, `sweep.js:268–280`).
