import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createConnectionIntake, noteUpsert, noteAccepted, describeOfflineDrain } from '../src/core/offlineDrainTelemetry.js'

// E11 do diagnóstico de travamento de filas: responder "a fila offline está
// presa?" com um grep no bot.log.

test('conta upserts por tipo e aceitas desde o open', () => {
  let i = createConnectionIntake(1000)
  i = noteUpsert(i, 'append', 5)
  i = noteUpsert(i, 'append', 3)
  i = noteUpsert(i, 'notify', 2)
  i = noteUpsert(i, 'outro', 9)
  i = noteAccepted(i)
  assert.deepEqual(describeOfflineDrain({ intake: i, offlineCount: 20, now: 61_000, phase: 'entregue' }), {
    phase: 'entregue', offlineCount: 20, appendUpserts: 8, notifyUpserts: 2, acceptedSinceOpen: 1, sinceOpenMs: 60_000, maxPending: 12,
  })
})

test('sem open ou sem contagem do servidor não inventa número', () => {
  assert.equal(noteUpsert(null, 'append', 1), null)
  assert.equal(noteAccepted(null), null)
  const d = describeOfflineDrain({ intake: null, offlineCount: undefined, phase: 'entregue' })
  assert.equal(d.offlineCount, null)
  assert.equal(d.maxPending, null)
  assert.equal(describeOfflineDrain({ intake: createConnectionIntake(0), offlineCount: null, phase: 'x' }).offlineCount, null)
})

const require = createRequire(import.meta.url)
const socketJs = readFileSync(require.resolve('@whiskeysockets/baileys/lib/Socket/socket.js'), 'utf8')
const patch = readFileSync(new URL('../patches/@whiskeysockets+baileys+6.7.23.patch', import.meta.url), 'utf8')
const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('o Baileys (patch) entrega a contagem do servidor no evento', () => {
  assert.match(socketJs, /ev\.emit\('connection\.update', \{ receivedPendingNotifications: true, wabotOfflineCount: offlineNotifs \}\)/)
  assert.ok(patch.includes('wabotOfflineCount: offlineNotifs'))
})

test('fiação no worker: zera no open, conta upsert e aceita, loga ao fim da fila e 2 min depois', () => {
  assert.match(worker, /connectionOpenedAt = Date\.now\(\)\s*connectionIntake = createConnectionIntake\(connectionOpenedAt\)/)
  assert.match(worker, /connectionIntake = noteUpsert\(connectionIntake, type, messages\.length\)/)
  const accepted = worker.slice(worker.indexOf('function markMessageAccepted()'), worker.indexOf('function markMessageAccepted()') + 900)
  assert.match(accepted, /connectionIntake = noteAccepted\(connectionIntake\)/)
  assert.match(worker, /if \(receivedPendingNotifications !== true\) return/)
  assert.match(worker, /'fila offline do WhatsApp: servidor terminou de entregar'/)
  assert.match(worker, /'fila offline do WhatsApp: dreno 2 min depois'/)
  assert.match(worker, /offlineDrainCheckTimer\.unref\?\.\(\)/)
})
