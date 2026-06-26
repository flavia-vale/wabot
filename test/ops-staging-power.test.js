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
  assert.ok(calls.some((c) => c.args[0] === 'save'))
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
