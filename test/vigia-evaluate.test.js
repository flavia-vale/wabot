import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateVigia, formatVigia, LEVEL } from '../src/ops/vigia/evaluate.js'

const saudavel = () => ({
  pm2: [{ name: 'api', status: 'online', restarts: 3 }, { name: 'bot-supervisor', status: 'online', restarts: 1 }],
  prevRestarts: { api: 3, 'bot-supervisor': 1 },
  mem: { totalGb: 31, availableGb: 20, swapUsedGb: 0 },
  diskFreePct: 60,
  apiReady: true,
  supervisorAlive: true,
  sessions: { total: 78, connected: 77, stale: 1 },
  sends: { total: 200, success: 190, error: 5, stuck: 0 },
  queueBacklog: 0,
  wa: { reconnects: 2, forbidden: 0, replaced: 0 },
  backupAgeH: 5,
})
const por = (r, id) => r.checks.find(c => c.id === id)

test('tudo saudável = ok', () => {
  assert.equal(evaluateVigia(saudavel()).level, LEVEL.OK)
})

test('nada medido nunca vira ok', () => {
  const r = evaluateVigia({})
  assert.equal(r.level, LEVEL.UNKNOWN)
  assert.ok(r.checks.every(c => c.level === LEVEL.UNKNOWN))
})

test('processo fora do ar = vermelho', () => {
  const s = saudavel(); s.pm2[1].status = 'errored'
  assert.equal(por(evaluateVigia(s), 'pm2').level, LEVEL.RED)
})

test('reinícios novos: 1 = amarelo, 3 = vermelho', () => {
  const s = saudavel(); s.pm2[0].restarts = 4
  assert.equal(por(evaluateVigia(s), 'pm2').level, LEVEL.WARN)
  s.pm2[0].restarts = 6
  assert.equal(por(evaluateVigia(s), 'pm2').level, LEVEL.RED)
})

test('swap decide a memória', () => {
  const s = saudavel(); s.mem.swapUsedGb = 0.3
  assert.equal(por(evaluateVigia(s), 'memoria').level, LEVEL.WARN)
  s.mem.swapUsedGb = 2
  assert.equal(por(evaluateVigia(s), 'memoria').level, LEVEL.RED)
})

test('memória sem swap medido não é ok', () => {
  const s = saudavel(); s.mem = { availableGb: 20, swapUsedGb: null }
  assert.equal(por(evaluateVigia(s), 'memoria').level, LEVEL.UNKNOWN)
})

test('disco, API e gerenciador', () => {
  const s = saudavel(); s.diskFreePct = 5; s.apiReady = false; s.supervisorAlive = false
  const r = evaluateVigia(s)
  assert.equal(por(r, 'disco').level, LEVEL.RED)
  assert.equal(por(r, 'api').level, LEVEL.RED)
  assert.equal(por(r, 'supervisor').level, LEVEL.RED)
  assert.equal(r.level, LEVEL.RED)
})

test('sessões sem sinal', () => {
  const s = saudavel(); s.sessions = { total: 100, connected: 90, stale: 10 }
  assert.equal(por(evaluateVigia(s), 'sessoes').level, LEVEL.WARN)
  s.sessions = { total: 100, connected: 50, stale: 40 }
  assert.equal(por(evaluateVigia(s), 'sessoes').level, LEVEL.RED)
})

test('envios: erro só conta com amostra mínima; parados contam sempre', () => {
  const s = saudavel(); s.sends = { total: 5, success: 1, error: 4, stuck: 0 }
  assert.equal(por(evaluateVigia(s), 'envios').level, LEVEL.OK)
  s.sends = { total: 100, success: 60, error: 40, stuck: 0 }
  assert.equal(por(evaluateVigia(s), 'envios').level, LEVEL.RED)
  s.sends = { total: 10, success: 10, error: 0, stuck: 40 }
  assert.equal(por(evaluateVigia(s), 'envios').level, LEVEL.RED)
})

test('fila, quedas e backup', () => {
  const s = saudavel(); s.queueBacklog = 150; s.wa = { reconnects: 5, forbidden: 1 }; s.backupAgeH = 30
  const r = evaluateVigia(s)
  assert.equal(por(r, 'fila').level, LEVEL.RED)
  assert.equal(por(r, 'quedas').level, LEVEL.WARN)
  assert.equal(por(r, 'backup').level, LEVEL.RED)
})

test('formato: só problemas esconde os verdes', () => {
  const s = saudavel(); s.apiReady = false
  const txt = formatVigia(evaluateVigia(s), { onlyProblems: true })
  assert.match(txt, /ATENÇÃO/)
  assert.doesNotMatch(txt, /🟢 Memória/)
  assert.match(txt, /🔴 Site\/API/)
})

test('envios: interrompidos por reinício aparecem à parte e não entram na taxa de erro', () => {
  const s = saudavel(); s.sends = { total: 2000, success: 1300, error: 40, restarted: 620, stuck: 0 }
  const c = por(evaluateVigia(s), 'envios')
  assert.equal(c.level, LEVEL.OK)
  assert.match(c.detail, /620 interrompidos por reinício/)
})
