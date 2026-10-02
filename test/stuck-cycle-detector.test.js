import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  registerStuckDrop,
  noteDecryptFailure,
  topDecryptCulprit,
  describeStuckCulprit,
} from '../src/core/stuckCycleDetector.js'

const H = 60 * 60_000
const opts = { windowMs: 3 * H, threshold: 3 }

test('3 quedas com ids diferentes na janela = ciclo; e zera depois de disparar', () => {
  let st = []
  let r = registerStuckDrop(st, { now: 0, msgId: 'A', ...opts }); st = r.state
  assert.equal(r.cycle, false)
  r = registerStuckDrop(st, { now: H, msgId: 'B', ...opts }); st = r.state
  assert.equal(r.cycle, false)
  r = registerStuckDrop(st, { now: 2 * H, msgId: 'C', ...opts })
  assert.equal(r.cycle, true)
  assert.equal(r.count, 3)
  assert.equal(r.distinctIds, 3)
  assert.deepEqual(r.state, [])
})

test('o MESMO id repetindo não é ciclo (é caso da quarentena por id)', () => {
  let st = []
  for (const now of [0, 1, 2, 3]) st = registerStuckDrop(st, { now, msgId: 'A', ...opts }).state
  assert.equal(registerStuckDrop(st, { now: 4, msgId: 'A', ...opts }).cycle, false)
})

test('queda fora da janela não conta', () => {
  let st = registerStuckDrop([], { now: 0, msgId: 'A', ...opts }).state
  st = registerStuckDrop(st, { now: 1, msgId: 'B', ...opts }).state
  const r = registerStuckDrop(st, { now: 4 * H, msgId: 'C', ...opts })
  assert.equal(r.cycle, false)
  assert.equal(r.count, 1)
})

test('threshold 0 desliga', () => {
  let st = []
  for (const id of ['A', 'B', 'C', 'D']) {
    const r = registerStuckDrop(st, { now: 0, msgId: id, windowMs: H, threshold: 0 })
    assert.equal(r.cycle, false)
    st = r.state
  }
})

test('culpado: jid do ack vence; status por class; senão o jid com mais falhas de decrypt', () => {
  let m = new Map()
  m = noteDecryptFailure(m, '1@lid', 100, { windowMs: 1000 })
  m = noteDecryptFailure(m, '1@lid', 200, { windowMs: 1000 })
  m = noteDecryptFailure(m, '2@g.us', 300, { windowMs: 1000 })
  assert.deepEqual(topDecryptCulprit(m, 400, { windowMs: 1000 }), { jid: '1@lid', count: 2, kind: 'dm' })
  assert.deepEqual(describeStuckCulprit({ ackClass: 'message', jid: '9@newsletter' }, m, 400, { windowMs: 1000 }),
    { jid: '9@newsletter', kind: 'canal', source: 'ack' })
  assert.equal(describeStuckCulprit({ ackClass: 'status' }, m, 400, { windowMs: 1000 }).kind, 'status')
  assert.deepEqual(describeStuckCulprit({ ackClass: 'message' }, m, 400, { windowMs: 1000 }),
    { jid: '1@lid', kind: 'dm', decryptFailures: 2, source: 'decrypt' })
  assert.equal(describeStuckCulprit(null, new Map(), 400, { windowMs: 1000 }).kind, 'desconhecido')
})

test('mapa de falhas de decrypt é podado por janela e limitado em tamanho', () => {
  let m = new Map()
  for (let i = 0; i < 300; i++) m = noteDecryptFailure(m, `${i}@lid`, 1000, { windowMs: 10_000, maxJids: 200 })
  assert.equal(m.size, 200)
  m = noteDecryptFailure(m, 'x@lid', 50_000, { windowMs: 10_000 })
  assert.deepEqual([...m.keys()], ['x@lid'])
})

// bot-worker.js roda como processo próprio: fiação conferida no fonte (mesmo
// idioma de bot-worker-reception-blindness-wiring.test.js).
const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('fiação: estado em escopo de módulo, zerado só por mensagem aceita, sinal ops_wa_stuck_cycle', () => {
  const startIdx = src.indexOf('async function startBotInner()')
  assert.ok(src.indexOf('let stuckCycleDrops = []') > 0 && src.indexOf('let stuckCycleDrops = []') < startIdx)
  const accepted = src.slice(src.indexOf('function markMessageAccepted()'), src.indexOf('function markMessageAccepted()') + 800)
  assert.match(accepted, /stuckCycleDrops = \[\]/)
  assert.equal(src.split('stuckCycleDrops = []').length - 1, 2, 'só a declaração e markMessageAccepted zeram o ciclo')
  assert.match(src, /registerStuckDrop\(stuckCycleDrops, \{ now, msgId: stuckMsgId/)
  assert.match(src, /recordOperationalSignal\('wa_stuck_cycle'/)
  assert.match(src, /handleGroupDecryptSignal\(args\); noteDecryptFailureForCycle\(args\)/)
  const signals = readFileSync(new URL('../src/observability/operationalSignals.js', import.meta.url), 'utf8')
  assert.match(signals, /wa_stuck_cycle: 'ops_wa_stuck_cycle'/)
  const analytics = readFileSync(new URL('../src/analytics.js', import.meta.url), 'utf8')
  assert.match(analytics, /'ops_wa_stuck_cycle'/)
})
