import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import {
  INCOMING_DROP_REASON,
  INCOMING_MAX_AGE_MS,
  shouldProcessIncomingMessage,
} from '../src/core/incomingFreshness.js'

const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

// RCA 2026-07: mensagem publicada 1x no grupo monitorado foi espelhada 5x ao
// longo de ~6h. Ela estava sendo VISTA várias vezes: o WhatsApp reentrega a
// fila offline a cada reconexão e o Baileys marca essas mensagens com
// `type: 'append'` (`node.attrs.offline ? 'append' : 'notify'`, Baileys 6.7.23
// lib/Socket/messages-recv.js). O handler aceitava as duas vias.

test('mensagem ao vivo e recente é processada', () => {
  const now = Date.parse('2026-07-27T17:14:00Z')
  const r = shouldProcessIncomingMessage({ upsertType: 'notify', messageTimestampMs: now - 30_000, now })
  assert.equal(r.process, true)
  assert.equal(r.reason, null)
  assert.equal(r.ageMs, 30_000)
})

test('reentrega de mensagem velha é descartada (qualquer via)', () => {
  const now = Date.parse('2026-07-27T22:41:00Z')
  const publicadaAs = Date.parse('2026-07-27T17:13:00Z')
  for (const upsertType of ['append', 'notify']) {
    const r = shouldProcessIncomingMessage({ upsertType, messageTimestampMs: publicadaAs, now })
    assert.equal(r.process, false, `${upsertType} velha precisa ser descartada`)
    assert.equal(r.reason, INCOMING_DROP_REASON.STALE)
  }
})

// Buraco real: o Baileys monta `messageTimestamp: +stanza.attrs.t`. Sem o
// atributo `t` isso vira NaN e o cutoff antigo (`if (msgTs && msgTs < cutoff)`)
// era PULADO — reentrega de horas antes passava direto.
test('reentrega sem timestamp confiável é descartada', () => {
  for (const ts of [null, undefined, NaN, 0]) {
    const r = shouldProcessIncomingMessage({ upsertType: 'append', messageTimestampMs: ts })
    assert.equal(r.process, false, `append sem timestamp (${String(ts)}) precisa ser descartada`)
    assert.equal(r.reason, INCOMING_DROP_REASON.REPLAY_WITHOUT_TIMESTAMP)
  }
})

// Contrapartida: não perder mensagem legítima. 'notify' é a via ao vivo; sem
// timestamp não dá pra julgar idade, e descartar perderia mensagem nova.
test('mensagem ao vivo sem timestamp continua sendo processada', () => {
  const r = shouldProcessIncomingMessage({ upsertType: 'notify', messageTimestampMs: null })
  assert.equal(r.process, true)
  assert.equal(r.ageMs, null)
})

// Canal (@newsletter) ao vivo também chega como 'append' no Baileys
// ('Processed plaintext newsletter message'), com `t` válido — não pode ser
// descartado em bloco junto com a reentrega.
test('mensagem de canal ao vivo (append com timestamp recente) é processada', () => {
  const now = Date.now()
  const r = shouldProcessIncomingMessage({ upsertType: 'append', messageTimestampMs: now - 5_000, now })
  assert.equal(r.process, true)
  assert.equal(r.reason, null)
})

test('limite de idade é exatamente INCOMING_MAX_AGE_MS', () => {
  const now = 10_000_000
  assert.equal(shouldProcessIncomingMessage({ upsertType: 'notify', messageTimestampMs: now - INCOMING_MAX_AGE_MS + 1, now }).process, true)
  assert.equal(shouldProcessIncomingMessage({ upsertType: 'notify', messageTimestampMs: now - INCOMING_MAX_AGE_MS, now }).process, false)
})

// Guardas estruturais: a decisão precisa continuar no chokepoint do upsert, e o
// descarte precisa deixar rastro (antes era um `continue` mudo — impossível ver
// reoferta acontecendo no bot.log).
test('bot-worker usa shouldProcessIncomingMessage no messages.upsert e loga o descarte', () => {
  assert.match(
    botWorkerSource,
    /import \{[^}]*\bINCOMING_MAX_AGE_MS\b[^}]*\bshouldProcessIncomingMessage\b[^}]*\} from '\.\/core\/incomingFreshness\.js'/,
  )
  assert.match(
    botWorkerSource,
    /let freshness = shouldProcessIncomingMessage\(\{\s*\n\s*upsertType: type,\s*\n\s*messageTimestampMs: msgTs,/,
    'o filtro de frescor precisa receber o tipo do upsert (notify vs append)',
  )
  assert.match(
    botWorkerSource,
    /if \(!freshness\.process\) \{[\s\S]*reason: freshness\.reason[\s\S]*'Mensagem descartada: reentrega\/mensagem velha não reentra no pipeline'/,
    'descarte precisa logar motivo e idade',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /if \(msgTs && msgTs < cutoff\) continue/,
    'o cutoff antigo (pulado quando o timestamp faltava) não pode voltar',
  )
})
