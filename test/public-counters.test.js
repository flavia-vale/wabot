import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  PUBLIC_COUNTER_MAX_AGE_MS,
  PUBLIC_COUNTER_MIN_SENDS,
  buildCounterSnapshot,
  resolvePublicCounter,
} from '../src/domain/publicStats/publicCounters.js'
import { getPublicCounter } from '../dashboard/lib/public-counters.js'

const AGORA = new Date('2026-10-01T12:00:00Z')

test('mostra o número real quando é grande e o arquivo é recente', () => {
  const snap = buildCounterSnapshot({ sends30d: 25400, now: new Date('2026-10-01T04:20:00Z') })
  const r = resolvePublicCounter(snap, { now: AGORA })
  assert.equal(r.sends30d, 25400)
  assert.match(r.label, /25\.400 envios de ofertas nos últimos 30 dias/)
})

test('número pequeno some: nunca se mostra o que está abaixo do piso', () => {
  const snap = buildCounterSnapshot({ sends30d: PUBLIC_COUNTER_MIN_SENDS - 1, now: AGORA })
  assert.equal(resolvePublicCounter(snap, { now: AGORA }), null)
})

test('arquivo velho some, e data no futuro também', () => {
  const velho = buildCounterSnapshot({ sends30d: 50000, now: new Date(AGORA.getTime() - PUBLIC_COUNTER_MAX_AGE_MS - 1000) })
  assert.equal(resolvePublicCounter(velho, { now: AGORA }), null)
  const futuro = buildCounterSnapshot({ sends30d: 50000, now: new Date(AGORA.getTime() + 60_000) })
  assert.equal(resolvePublicCounter(futuro, { now: AGORA }), null)
})

test('janela diferente de 30 dias, lixo ou vazio não viram número', () => {
  const snap = { ...buildCounterSnapshot({ sends30d: 50000, now: AGORA }), windowDays: 7 }
  assert.equal(resolvePublicCounter(snap, { now: AGORA }), null)
  assert.equal(resolvePublicCounter(null, { now: AGORA }), null)
  assert.equal(resolvePublicCounter({ sends30d: 'x', windowDays: 30, generatedAt: AGORA.toISOString() }, { now: AGORA }), null)
  assert.equal(buildCounterSnapshot({ sends30d: -3, now: AGORA }).sends30d, 0)
})

test('leitura do arquivo: existe e é válido, não existe, JSON quebrado', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contador-'))
  const file = path.join(dir, 'c.json')
  assert.equal(getPublicCounter({ now: AGORA, file }), null)
  fs.writeFileSync(file, '{quebrado')
  assert.equal(getPublicCounter({ now: AGORA, file }), null)
  fs.writeFileSync(file, JSON.stringify(buildCounterSnapshot({ sends30d: 12345, now: new Date('2026-10-01T04:00:00Z') })))
  assert.equal(getPublicCounter({ now: AGORA, file }).sends30d, 12345)
  fs.rmSync(dir, { recursive: true, force: true })
})
