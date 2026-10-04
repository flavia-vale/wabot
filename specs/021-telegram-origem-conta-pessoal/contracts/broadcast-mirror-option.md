# Contrato — campo opcional `options.mirror` do `sendBroadcast`

`sendBroadcast(userId, text, jids, options)` atravessa API → (supervisor) → worker
com `options` como objeto livre (`src/supervisor/client.js:616`, comando
`SEND_BROADCAST`). **`src/supervisor/protocol.js` não muda; `PROTOCOL_VERSION` não muda.**

## Forma
```
options.mirror = {
  sourceId:        'tg:-100123',      // origem (vai para MessageLog.sourceGroup)
  platform:        'shopee',          // loja do link primário (MessageLog.platform)
  originalUrl:     'https://…',       // link de origem (dedup + histórico)
  convertedUrl:    'https://…',       // link da cliente (dedup + histórico)
  dedupWindowMs:   86400000,          // janela do linkKind (cupom: curta)
  pendingMaxAgeMs: 21600000,          // idade máx. de pendente que conta como duplicata
}
options.source = 'telegramMirror'
options.imageUrl = 'https://<host do ambiente>/api/tg-midia/<token>'   // opcional
```

## Comportamento no worker (`src/bot-worker.js`, ramo `msg.type === 'broadcast'`, ~l.6757)
| `options.mirror` | O que acontece |
|---|---|
| ausente | **exatamente o de hoje** (T-E5): `platform:'broadcast'`, `originalUrl:''`, `convertedUrl:''`, `sourceGroup: broadcastSourceGroup(options)` |
| presente | por destino WhatsApp: `findRecentDestinationDuplicate` + `reserveSendDedupKeys` (mesmas regras do espelhamento); duplicata → `MessageLog{status:'skipped', errorMsg:'skip:dedup_recent_link…'}` como o espelhamento; senão `MessageLog{status:'queued', platform, sourceGroup:sourceId, originalUrl, convertedUrl}` e job com `mirrorSourceJid = sourceId` |
| presente, destino de outro aplicativo | não deve acontecer (a API separa); se acontecer, vai para a caixa de saída como hoje (defesa existente) |

No dequeue (`processSendJob`), job com `mirrorSourceJid` passa pela **revalidação de destino desvinculado** (hoje só `type==='converted'`, ~l.3367): origem sumiu ou destino desligado → `skip:source_unlinked`/`skip:dest_unlinked`.

## Resposta
Igual à de hoje: `{ queued, rejected, errors[] }`. Duplicata conta como `rejected` com `error:'skip:dedup_recent_link'` (a API não reenvia).

## Quem chama
Só `src/telegramOrigin/inboxSweep.js` (PR-4). Filas, ofertas automáticas e broadcast manual **não** mandam `mirror`.
