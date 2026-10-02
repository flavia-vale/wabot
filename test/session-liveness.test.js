import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { HEARTBEAT_FRESH_MS, RECEPTION_BLIND_WINDOW_MS, isHeartbeatFresh, isSessionLive } from '../src/domain/session/sessionLiveness.js'
import { DEFAULT_HEARTBEAT_STALE_MS } from '../src/core/sessionOwnership.js'
import { BOTS_STALE_MS } from '../src/ops/botsReadiness.js'
import { DEFAULTS } from '../src/ops/vigia/evaluate.js'

const AGORA = Date.parse('2026-10-02T12:00:00Z')
const atras = ms => new Date(AGORA - ms).toISOString()

test('uma janela de heartbeat só: admin, ownership, readiness e vigia concordam', () => {
  assert.equal(DEFAULT_HEARTBEAT_STALE_MS, HEARTBEAT_FRESH_MS)
  assert.equal(BOTS_STALE_MS, HEARTBEAT_FRESH_MS)
  assert.equal(DEFAULTS.staleHeartbeatMs, HEARTBEAT_FRESH_MS)
})

test('heartbeat fresco até a janela, velho depois; ausente nunca é fresco', () => {
  assert.equal(isHeartbeatFresh(atras(HEARTBEAT_FRESH_MS), AGORA), true)
  assert.equal(isHeartbeatFresh(atras(HEARTBEAT_FRESH_MS + 1), AGORA), false)
  assert.equal(isHeartbeatFresh(null, AGORA), false)
  assert.equal(isHeartbeatFresh('lixo', AGORA), false)
})

test('conectada é viva; subindo só com heartbeat fresco', () => {
  assert.equal(isSessionLive({ status: 'connected' }, AGORA), true)
  assert.equal(isSessionLive({ status: 'connecting', lifecycle: 'reconnecting', lastHeartbeatAt: atras(60_000) }, AGORA), true)
  assert.equal(isSessionLive({ status: 'connecting', lifecycle: 'reconnecting', lastHeartbeatAt: atras(HEARTBEAT_FRESH_MS + 1) }, AGORA), false)
  assert.equal(isSessionLive({ status: 'disconnected', lastHeartbeatAt: atras(1000) }, AGORA), false)
  assert.equal(isSessionLive(null, AGORA), false)
})

test('a janela de cegueira é maior que o throttle de 1 h do sinal', () => {
  assert.ok(RECEPTION_BLIND_WINDOW_MS >= 60 * 60_000 + 10 * 60_000)
})

test('admin.js não redeclara as janelas', () => {
  const fonte = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  assert.ok(!/2 \* 60_000/.test(fonte), 'voltou a janela de 2 min de heartbeat')
  assert.ok(!fonte.includes('ADMIN_RECEPTION_BLIND_WINDOW_MS'), 'a janela de cegueira voltou a ser declarada no admin.js')
})
