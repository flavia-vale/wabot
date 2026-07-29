import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

const stopRoute = readFileSync(new URL('../src/api/routes/session.js', import.meta.url), 'utf8')
const supervisor = readFileSync(new URL('../src/supervisor/index.js', import.meta.url), 'utf8')

// Testes estruturais: a política em sessionResumePolicy.js só funciona se as
// duas pontas continuarem ligadas. Cada uma destas asserções corresponde a uma
// regressão que reintroduziria, em silêncio, o problema do RCA 2026-07-29.

test('/session/stop grava o marcador de parada manual', () => {
  // Sem o marcador, "desliguei de propósito" fica idêntico a "o incidente me
  // abandonou" e o supervisor religaria o robô de quem desligou.
  const stopBlock = stopRoute.slice(stopRoute.indexOf("app.post('/stop'"))
  assert.match(stopBlock.slice(0, 900), /lifecycle:\s*STOPPED_BY_USER_LIFECYCLE/)
  assert.match(stopRoute, /import\s*\{[^}]*STOPPED_BY_USER_LIFECYCLE[^}]*\}\s*from\s*'\.\.\/\.\.\/core\/sessionResumePolicy\.js'/)
})

test('supervisor decide retomada pela política, não por query solta', () => {
  assert.match(supervisor, /import\s*\{\s*shouldResumeSession\s*\}\s*from\s*'\.\.\/core\/sessionResumePolicy\.js'/)
  assert.match(supervisor, /function listResumableSessions\s*\(/)
  assert.match(supervisor, /shouldResumeSession\(/)
})

test('nenhuma retomada voltou a filtrar só por connected/connecting', () => {
  // Era exatamente essa query que descartava sessão marcada 'disconnected' e
  // deixava clientes fora do ar depois de um incidente longo.
  const legacy = /status:\s*\{\s*in:\s*\['connected',\s*'connecting'\]\s*\}/g
  assert.equal(
    supervisor.match(legacy),
    null,
    'query legada de retomada reapareceu no supervisor — use listResumableSessions()'
  )
})

test('boot e health monitor usam a MESMA fonte de sessões retomáveis', () => {
  // Se só um dos dois caminhos for corrigido, a recuperação passa a depender
  // de qual deles roda primeiro.
  const uses = supervisor.match(/await listResumableSessions\(\)/g) || []
  assert.equal(uses.length, 2, 'esperado uso no resume de boot E no health monitor')
})

test('retomada continua respeitando o shard', () => {
  const fn = supervisor.slice(supervisor.indexOf('async function listResumableSessions'))
  assert.match(fn.slice(0, 1500), /belongsToThisShard\(/)
})

test('credencial só é checada no disco para o caso novo', () => {
  // Checar creds.json de toda sessão a cada 15s seria I/O à toa no tick.
  const fn = supervisor.slice(supervisor.indexOf('async function listResumableSessions'))
  assert.match(fn.slice(0, 1500), /status === 'disconnected' \? await hasStoredCredential/)
})
