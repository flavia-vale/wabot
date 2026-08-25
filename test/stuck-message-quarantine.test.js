import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import { createDurableStuckMessageRetryCache, parseStuckMessageQuarantine } from '../src/core/stuckMessageQuarantine.js'

test('quarentena devolve o limite para qualquer participant e impede novos retries', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'wabot-stuck-')), 'quarantine.json')
  const cache = createDurableStuckMessageRetryCache({ file, maxRetryCount: 5, now: () => 1000 })
  cache.set('MSG1:participant-a', 2)
  assert.equal(cache.quarantine('MSG1'), true)
  assert.equal(cache.get('MSG1:participant-a'), 5)
  assert.equal(cache.get('MSG1:participant-b'), 5)
  assert.equal(cache.del('MSG1:participant-a'), 0)
  assert.equal(cache.get('MSG1:participant-a'), 5)
})

test('quarentena sobrevive ao restart do worker', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'wabot-stuck-')), 'quarantine.json')
  createDurableStuckMessageRetryCache({ file, now: () => 2000 }).quarantine('MSG-PERSISTENTE')
  const afterRestart = createDurableStuckMessageRetryCache({ file, maxRetryCount: 5, now: () => 3000 })
  assert.equal(afterRestart.get('MSG-PERSISTENTE:novo-participant'), 5)
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).messages[0].msgId, 'MSG-PERSISTENTE')
})

test('parser descarta arquivo inválido e entradas expiradas', () => {
  assert.deepEqual(parseStuckMessageQuarantine('{invalido'), new Map())
  const parsed = parseStuckMessageQuarantine({ version: 1, messages: [
    { msgId: 'velha', quarantinedAt: 1 },
    { msgId: 'nova', quarantinedAt: 9_500 },
  ] }, 10_000, 1_000)
  assert.deepEqual([...parsed], [['nova', 9_500]])
})
