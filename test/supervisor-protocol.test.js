import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  COMMAND,
  EVENT,
  COMMAND_TIMEOUTS_MS,
  EVENTS_CHANNEL,
  COMMAND_QUEUE,
  PROTOCOL_VERSION,
  commandTimeoutMs,
  decodeEvent,
  encodeEvent,
  isCommandStale,
  isKnownCommand,
  resolveRedisUrl,
} from '../src/supervisor/protocol.js'

test('protocolo expõe nomes canônicos de canais e fila', () => {
  // COMMAND_QUEUE não pode ter ':' — BullMQ proíbe e o supervisor crasha
  // no boot. Pub/sub channel e heartbeat key são chaves Redis simples,
  // ':' é OK lá.
  assert.equal(COMMAND_QUEUE, 'supervisor-commands')
  assert.ok(!COMMAND_QUEUE.includes(':'), 'BullMQ não aceita ":" em nome de fila')
  assert.equal(EVENTS_CHANNEL, 'bots:events')
  assert.equal(PROTOCOL_VERSION, 1)
})

test('isKnownCommand cobre todos os comandos do enum', () => {
  for (const name of Object.values(COMMAND)) {
    assert.ok(isKnownCommand(name), `${name} deveria ser conhecido`)
  }
  assert.equal(isKnownCommand('foo:bar'), false)
})

test('todo comando tem timeout configurado', () => {
  for (const name of Object.values(COMMAND)) {
    const t = COMMAND_TIMEOUTS_MS[name]
    assert.ok(typeof t === 'number' && t > 0, `timeout ausente para ${name}`)
  }
})

test('commandTimeoutMs cai no default para comando desconhecido', () => {
  assert.equal(commandTimeoutMs(COMMAND.LIST_GROUPS), 10_000)
  assert.equal(commandTimeoutMs('desconhecido'), 10_000)
})

test('isCommandStale: job dentro do timeout NÃO é obsoleto', () => {
  const now = 1_000_000
  // SEND_BROADCAST timeout = 30s; enfileirado há 10s => ainda válido
  assert.equal(isCommandStale(COMMAND.SEND_BROADCAST, now - 10_000, now), false)
})

test('isCommandStale: job mais velho que o timeout é obsoleto', () => {
  const now = 1_000_000
  // START_BOT timeout = 5s; enfileirado há 6s => API já desistiu => descartar
  assert.equal(isCommandStale(COMMAND.START_BOT, now - 6_000, now), true)
  // SEND_BROADCAST 30s; enfileirado há 31s => descartar (evita envio duplicado)
  assert.equal(isCommandStale(COMMAND.SEND_BROADCAST, now - 31_000, now), true)
})

test('isCommandStale: enqueuedAt ausente/ inválido é fail-safe (não obsoleto)', () => {
  const now = 1_000_000
  assert.equal(isCommandStale(COMMAND.SEND_BROADCAST, undefined, now), false)
  assert.equal(isCommandStale(COMMAND.SEND_BROADCAST, null, now), false)
  assert.equal(isCommandStale(COMMAND.SEND_BROADCAST, 'abc', now), false)
  assert.equal(isCommandStale(COMMAND.SEND_BROADCAST, 0, now), false)
})

test('isCommandStale: graceMs estende a janela antes do descarte', () => {
  const now = 1_000_000
  // START_BOT 5s + grace 2s = 7s; aos 6s ainda válido, aos 8s obsoleto
  assert.equal(isCommandStale(COMMAND.START_BOT, now - 6_000, now, 2_000), false)
  assert.equal(isCommandStale(COMMAND.START_BOT, now - 8_000, now, 2_000), true)
})

test('encodeEvent gera JSON canônico com versão', () => {
  const json = encodeEvent({ userId: 'u1', type: EVENT.STATUS, data: 'connected', ts: 1000 })
  const parsed = JSON.parse(json)
  assert.deepEqual(parsed, { v: 1, userId: 'u1', type: 'status', data: 'connected', ts: 1000 })
})

test('encodeEvent valida campos obrigatórios', () => {
  assert.throws(() => encodeEvent({ userId: '', type: EVENT.QR }))
  assert.throws(() => encodeEvent({ userId: 'u1', type: '' }))
})

test('decodeEvent rejeita malformados sem lançar', () => {
  assert.equal(decodeEvent(null), null)
  assert.equal(decodeEvent(''), null)
  assert.equal(decodeEvent('not-json'), null)
  assert.equal(decodeEvent(JSON.stringify({ v: 999, userId: 'u', type: 't' })), null)
  assert.equal(decodeEvent(JSON.stringify({ v: 1, type: 'qr' })), null)
  assert.equal(decodeEvent(JSON.stringify({ v: 1, userId: 'u' })), null)
})

test('decodeEvent aceita evento bem formado', () => {
  const json = encodeEvent({ userId: 'abc', type: EVENT.QR, data: 'qr-string', ts: 42 })
  const decoded = decodeEvent(json)
  assert.deepEqual(decoded, { v: 1, userId: 'abc', type: 'qr', data: 'qr-string', ts: 42 })
})

test('resolveRedisUrl prefere SUPERVISOR_REDIS_URL sobre REDIS_URL', () => {
  assert.equal(resolveRedisUrl({ SUPERVISOR_REDIS_URL: 'redis://a', REDIS_URL: 'redis://b' }), 'redis://a')
  assert.equal(resolveRedisUrl({ REDIS_URL: 'redis://b' }), 'redis://b')
  assert.equal(resolveRedisUrl({}), '')
})
