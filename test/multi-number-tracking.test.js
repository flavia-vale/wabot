import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decideFailover, isActiveBlind, RECEPTION_STATE_FRESH_MS } from '../src/domain/session/failoverPolicy.js'

const NOW = Date.parse('2026-10-03T12:00:00Z')
const standby = { status: 'connected', lastHeartbeatAt: new Date(NOW - 30_000) }
const blindActive = { status: 'connected', receptionState: 'blind', receptionStateAt: new Date(NOW - 60_000) }

test('"conectado mas cego" conta como caído, com estado fresco', () => {
  assert.equal(isActiveBlind(blindActive, NOW), true)
  assert.equal(isActiveBlind({ ...blindActive, receptionState: 'ok' }, NOW), false)
  assert.equal(isActiveBlind({ ...blindActive, receptionStateAt: new Date(NOW - RECEPTION_STATE_FRESH_MS - 1) }, NOW), false, 'estado velho não prova cegueira')
  assert.equal(isActiveBlind({ ...blindActive, status: 'disconnected' }, NOW), false)
})

test('cego só troca depois do mesmo tempo da queda, com motivo "blind"', () => {
  assert.equal(decideFailover({ active: blindActive, standby, downSinceMs: NOW - 60_000, now: NOW }).reason, 'waiting')
  assert.deepEqual(decideFailover({ active: blindActive, standby, downSinceMs: NOW - 11 * 60_000, now: NOW }), { promote: true, reason: 'blind' })
  assert.equal(decideFailover({ active: { status: 'connected', receptionState: 'quiet', receptionStateAt: new Date(NOW) }, standby, downSinceMs: NOW - 11 * 60_000, now: NOW }).reason, 'active_ok')
})

test('estrutural: rastreio por número só com a flag; recepção no heartbeat só do ativo', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /\.\.\.\(MULTI_NUMBER_ON \? \{ senderSlot: SESSION_IDENTITY\.authSlot \} : \{\}\)/)
  assert.match(src, /if \(MULTI_NUMBER_ON && !IS_STANDBY\) \{\n\s+const reception = getReceptionHealth\(\)/)
  const job = readFileSync(new URL('../src/jobs/numberFailover.js', import.meta.url), 'utf8')
  assert.match(job, /active\.status === 'connected' && !isActiveBlind\(active, now\.getTime\(\)\)/)
})
