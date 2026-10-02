import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  chatKindOfJid,
  extractStreamErrorAck,
  classifyStuckAck,
  tallyStuckAcksFromLog,
  dailyStuck500Ratio,
} from '../src/core/stuckAckClassifier.js'

const SCRIPT = readFileSync(new URL('../scripts/diag-quedas-500.mjs', import.meta.url), 'utf8')

const streamErr = (ackAttrs) => JSON.stringify({
  level: 50, pid: 1,
  node: { tag: 'stream:error', attrs: {}, content: [{ tag: 'ack', attrs: ackAttrs }] },
  msg: 'stream errored out',
})

test('tipo de chat por jid', () => {
  assert.equal(chatKindOfJid('123@newsletter'), 'canal')
  assert.equal(chatKindOfJid('123-456@g.us'), 'grupo')
  assert.equal(chatKindOfJid('5511@s.whatsapp.net'), 'dm')
  assert.equal(chatKindOfJid('99@lid'), 'dm')
  assert.equal(chatKindOfJid('status@broadcast'), 'status')
  assert.equal(chatKindOfJid(null), 'desconhecido')
})

test('extrai o ack da linha do bot.log e de node objeto', () => {
  const a = extractStreamErrorAck(streamErr({ class: 'message', id: 'ABC', type: 'text', from: '1@newsletter' }))
  assert.deepEqual(a, { id: 'ABC', ackClass: 'message', type: 'text', jid: '1@newsletter' })
  assert.equal(extractStreamErrorAck('não é json'), null)
  assert.equal(extractStreamErrorAck({ tag: 'stream:error', content: [] }), null)
})

test('class=status é status mesmo sem jid; senão cruza com o id logado', () => {
  assert.equal(classifyStuckAck({ id: 'X', ackClass: 'status' }), 'status')
  assert.equal(classifyStuckAck({ id: 'X', ackClass: 'message' }, new Map([['X', '9@lid']])), 'dm')
  assert.equal(classifyStuckAck({ id: 'Y', ackClass: 'message' }), 'desconhecido')
})

test('conta acks recusados por tipo cruzando com a linha de descarte do mesmo id', () => {
  const log = [
    streamErr({ class: 'message', id: 'A1' }),
    streamErr({ class: 'message', id: 'A1' }),
    streamErr({ class: 'message', id: 'B2', from: '5@newsletter' }),
    streamErr({ class: 'status', id: 'C3' }),
    JSON.stringify({ jid: '77@lid', msgId: 'A1', msg: 'Mensagem descartada: reentrega/mensagem velha não reentra no pipeline' }),
  ].join('\n')
  const t = tallyStuckAcksFromLog(log)
  assert.equal(t.total, 4)
  assert.equal(t.idsDistintos, 3)
  assert.deepEqual(t.porTipo, { dm: 2, canal: 1, status: 1 })
  assert.deepEqual(t.porClasse, { message: 3, status: 1 })
})

test('razão diária = 500 com stuckMsg ÷ opens', () => {
  const d = '2026-10-01T10:00:00Z'
  const rows = [
    { type: 'connected', occurredAt: d },
    { type: 'reconnect_success', occurredAt: d },
    { type: 'reconnect_success', occurredAt: d },
    { type: 'reconnect_success', occurredAt: d },
    { type: 'disconnect', code: '500', metadata: '{"stuckMsg":true}', occurredAt: d },
    { type: 'disconnect', code: '500', metadata: '{"stuckMsg":false}', occurredAt: d },
    { type: 'disconnect', code: '428', metadata: '{"stuckMsg":true}', occurredAt: d },
  ]
  assert.deepEqual(dailyStuck500Ratio(rows), [{ dia: '2026-10-01', quedas500: 2, stuckMsg: 1, opens: 4, razao: 0.25 }])
})

test('o diagnóstico usa o classificador compartilhado e é read-only', () => {
  assert.match(SCRIPT, /from '\.\.\/src\/core\/stuckAckClassifier\.js'/)
  for (const escrita of ['\\.create\\(', '\\.update\\(', '\\.delete\\(', '\\.upsert\\(', 'executeRaw', 'writeFile']) {
    assert.ok(!new RegExp(escrita).test(SCRIPT), `script não pode conter ${escrita}`)
  }
})
