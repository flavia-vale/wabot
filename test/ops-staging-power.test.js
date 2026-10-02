import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getStagingStatus,
  setStagingPower,
  assertStagingControlAllowed,
  __test,
} from '../src/ops/stagingPower.js'

const JLIST = JSON.stringify([
  { name: 'api-staging', pm2_env: { status: 'online' }, monit: { memory: 419430400, cpu: 1 } },
  { name: 'visual-staging', pm2_env: { status: 'stopped' }, monit: { memory: 0, cpu: 0 } },
  { name: 'api', pm2_env: { status: 'online' }, monit: { memory: 100, cpu: 0 } },
])

function fakeExec(calls, { jlist = JLIST, failNotFound = [] } = {}) {
  return async (bin, args, opts) => {
    calls.push({ bin, args, opts })
    if (args[0] === 'jlist') return { stdout: jlist }
    if (args[0] === 'stop' && failNotFound.includes(args[1])) {
      throw new Error(`[PM2][ERROR] Process or Namespace ${args[1]} not found`)
    }
    return { stdout: '' }
  }
}

test('getStagingStatus mapeia apps e computa on/totalMemory', async () => {
  const calls = []
  const status = await getStagingStatus({ exec: fakeExec(calls) })
  assert.equal(status.on, true) // api-staging online
  assert.equal(status.apps.length, __test.STAGING_APPS.length)
  const api = status.apps.find((a) => a.name === 'api-staging')
  assert.equal(api.online, true)
  assert.equal(api.memoryMB, 400) // 419430400 / 1048576
  const visual = status.apps.find((a) => a.name === 'visual-staging')
  assert.equal(visual.online, false)
  assert.equal(status.totalMemoryMB, 400)
  assert.deepEqual(calls[0].args, ['jlist'])
})

test("setStagingPower('off') para cada app, salva e retorna status", async () => {
  const calls = []
  await setStagingPower('off', { exec: fakeExec(calls) })
  const stops = calls.filter((c) => c.args[0] === 'stop').map((c) => c.args[1])
  assert.deepEqual(stops, __test.STAGING_APPS)
  // Salva pelo guarda (nunca `pm2 save` cru — RCA 2026-10-01).
  assert.ok(calls.some((c) => c.args[0] === __test.SAFE_SAVE_SCRIPT))
  assert.ok(!calls.some((c) => c.args[0] === 'save'))
})

test("setStagingPower('off') tolera app inexistente (not found)", async () => {
  const calls = []
  await assert.doesNotReject(
    setStagingPower('off', { exec: fakeExec(calls, { failNotFound: ['visual-staging'] }) })
  )
})

test("setStagingPower('on') sobe do cwd de staging com --only", async () => {
  const calls = []
  await setStagingPower('on', { exec: fakeExec(calls) })
  const start = calls.find((c) => c.args[0] === 'start')
  assert.ok(start, 'deve chamar pm2 start')
  assert.deepEqual(start.args, ['start', 'ecosystem.config.cjs', '--only', __test.STAGING_APPS.join(',')])
  assert.equal(start.opts.cwd, __test.STAGING_DIR)
})

test('ação inválida lança', async () => {
  await assert.rejects(() => setStagingPower('reboot', { exec: fakeExec([]) }), /Ação inválida/)
})

test('assertStagingControlAllowed bloqueia no host de staging', () => {
  assert.throws(() => assertStagingControlAllowed({ APP_ENV: 'staging' }), /staging/)
  assert.doesNotThrow(() => assertStagingControlAllowed({ APP_ENV: 'production' }))
})

test('pm2 separado do staging (P2-1): com PM2_HOME do staging, todas as chamadas levam esse env', async () => {
  const calls = []
  const pm2Env = { PM2_HOME: '/home/deploy/.pm2-staging' }
  await setStagingPower('off', { exec: fakeExec(calls), pm2Env })
  assert.ok(calls.length > 0)
  for (const c of calls) assert.equal(c.opts?.env?.PM2_HOME, '/home/deploy/.pm2-staging', JSON.stringify(c.args))
})

test('resolveStagingPm2Env: sem arquivo = null (daemon compartilhado, padrão de hoje)', async () => {
  const { resolveStagingPm2Env } = await import('../src/ops/stagingPower.js')
  assert.equal(resolveStagingPm2Env({ readFile: () => { throw new Error('ENOENT') } }), null)
  assert.equal(resolveStagingPm2Env({ readFile: () => '/x/.pm2-staging\n', env: {} }).PM2_HOME, '/x/.pm2-staging')
})
