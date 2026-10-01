import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compareNodes, summarizeInstabilityByNode } from '../src/supervisor/ipMeasure.js'

// 10 contas no n1 (nulas contam como n1) e 1 conta-teste no n2
const nodeOfUser = { ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`a${i}`, i % 2 ? 'n1' : null])), t1: 'n2' }
const ev = (userId, type, code = null) => ({ userId, type, code })

test('MN-20: agrupa por servidor, nulo conta como n1, reconexão é contada à parte', () => {
  const s = summarizeInstabilityByNode({ windowHours: 72, nodeOfUser, events: [ev('a0', 'replaced', '440'), ev('a1', 'reconnect_attempt'), ev('t1', 'flap_cooldown', '408'), ev('fora', 'replaced', '440')] })
  assert.equal(s.n1.accounts, 10)
  assert.equal(s.n2.accounts, 1)
  assert.equal(s.n1.bad, 1)
  assert.equal(s.n1.reconnects, 1)
  assert.deepEqual(s.n1.byCode, { 440: 1 })
  assert.equal(s.n2.bad, 1) // 'fora' (conta fora do conjunto) é ignorada
  assert.equal(s.n1.accountDays, 30)
  assert.equal(s.n2.badPerAccountDay, 1 / 3)
})

test('MN-20: sem dados suficientes não conclui (janela curta, sem conta no candidato, sem base)', () => {
  const s = summarizeInstabilityByNode({ windowHours: 24, nodeOfUser, events: [] })
  assert.equal(compareNodes({ summary: s, candidate: 'n2', windowHours: 24 }).code, 'insufficient_data')
  const s72 = summarizeInstabilityByNode({ windowHours: 72, nodeOfUser, events: [] })
  assert.equal(compareNodes({ summary: s72, candidate: 'n9', windowHours: 72 }).code, 'insufficient_data')
  assert.equal(compareNodes({ summary: { n2: s72.n2 }, candidate: 'n2', windowHours: 72 }).code, 'insufficient_data')
})

test('MN-20: QR novo/bloqueio só no candidato = piora (mesmo com poucos eventos)', () => {
  const s = summarizeInstabilityByNode({ windowHours: 72, nodeOfUser, events: [ev('t1', 'auth_reset', '500')] })
  const v = compareNodes({ summary: s, candidate: 'n2', windowHours: 72 })
  assert.equal(v.code, 'worse')
  assert.match(v.message, /Pare de mover contas/)
})

test('MN-20: taxa por conta/dia ≥ 2× a da base e ≥ 3 eventos = piora', () => {
  const eventos = [ev('a0', 'replaced'), ev('a1', 'flap_cooldown'), ev('t1', 'flap_cooldown'), ev('t1', 'flap_cooldown'), ev('t1', 'retry_giveup')]
  const v = compareNodes({ summary: summarizeInstabilityByNode({ windowHours: 72, nodeOfUser, events: eventos }), candidate: 'n2', windowHours: 72 })
  assert.equal(v.code, 'worse')
  assert.ok(v.ratio >= 2)
})

test('MN-20: sem diferença gritante NÃO afirma que é seguro (honestidade estatística)', () => {
  const eventos = [ev('a0', 'flap_cooldown'), ev('a1', 'flap_cooldown'), ev('t1', 'flap_cooldown')]
  const v = compareNodes({ summary: summarizeInstabilityByNode({ windowHours: 72, nodeOfUser, events: eventos }), candidate: 'n2', windowHours: 72 })
  assert.equal(v.code, 'no_difference')
  assert.match(v.message, /NÃO prova que é seguro/)
})

test('MN-20: poucos eventos no candidato (< 3) não disparam piora só pela razão', () => {
  const v = compareNodes({ summary: summarizeInstabilityByNode({ windowHours: 72, nodeOfUser, events: [ev('t1', 'flap_cooldown'), ev('t1', 'flap_cooldown')] }), candidate: 'n2', windowHours: 72 })
  assert.equal(v.code, 'no_difference')
})

test('MN-20: script é só leitura e mensagens sem jargão', () => {
  const src = readFileSync(new URL('../scripts/medir-ip-no.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /\.(create|update|updateMany|delete|deleteMany|upsert)\(/)
  const v = compareNodes({ summary: summarizeInstabilityByNode({ windowHours: 72, nodeOfUser, events: [ev('t1', 'auth_reset')] }), candidate: 'n2', windowHours: 72 })
  assert.doesNotMatch(v.message, /heartbeat|bullmq|shard|worker|redis/i)
})
