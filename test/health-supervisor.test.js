import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildHealthPayload, withTimeout } from '../src/ops/healthPayload.js'

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

test('inline: /health continua { ok: true } puro', () => {
  assert.deepEqual(buildHealthPayload({ mode: 'inline' }), { ok: true })
})

test('remote com supervisor vivo mostra alive e o último heartbeat em ISO', () => {
  const r = buildHealthPayload({ mode: 'remote', supervisorAlive: true, heartbeatAtMs: Date.UTC(2026, 9, 3, 12, 0, 0) })
  assert.deepEqual(r, { ok: true, supervisor: { alive: true, lastHeartbeatAt: '2026-10-03T12:00:00.000Z' } })
})

test('remote com supervisor morto: ok segue true (status 200), alive false, sem heartbeat', () => {
  const r = buildHealthPayload({ mode: 'remote', supervisorAlive: false, heartbeatAtMs: null })
  assert.equal(r.ok, true)
  assert.deepEqual(r.supervisor, { alive: false, lastHeartbeatAt: null })
})

test('remote sem saber (Redis lento): alive null, não inventa false', () => {
  assert.equal(buildHealthPayload({ mode: 'remote' }).supervisor.alive, null)
})

test('withTimeout rejeita promessa que demora e deixa passar a rápida', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20), /timeout/)
  assert.equal(await withTimeout(Promise.resolve(7), 20), 7)
})

test('server.js: /health usa o payload, nunca responde 503 e o supervisor lê o heartbeat', () => {
  const server = read('src/api/server.js')
  const ini = server.indexOf("app.get('/health'")
  const corpo = server.slice(ini, server.indexOf("app.get('/metrics'", ini))
  assert.match(corpo, /buildHealthPayload/)
  assert.doesNotMatch(corpo, /code\(5\d\d\)/, '/health não pode mudar o status HTTP')
  assert.match(corpo, /withTimeout/)
  assert.match(read('src/supervisor/client.js'), /async function getSupervisorHeartbeatAtMs/)
})

test('/ready/bots continua sendo quem devolve 503', () => {
  const server = read('src/api/server.js')
  assert.match(server, /reply\.code\(503\)\.send\(\{ ok, reason \}\)/)
})
