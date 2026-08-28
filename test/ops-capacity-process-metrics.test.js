import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyWorkerCmdline, collectProcessMetrics, resolveProcessRoots } from '../src/ops/capacity/processMetrics.js'
const roots = { production: '/srv/wabot', staging: '/srv/wabot-staging' }
test('valida roots absolutos e usa defaults seguros para valores invalidos', () => {
  assert.deepEqual(resolveProcessRoots({ CAPACITY_PRODUCTION_ROOT: '/srv/custom-prod', CAPACITY_STAGING_ROOT: '/srv/custom-stage' }), { production: '/srv/custom-prod', staging: '/srv/custom-stage' })
  assert.deepEqual(resolveProcessRoots({ CAPACITY_PRODUCTION_ROOT: 'relative', CAPACITY_STAGING_ROOT: '' }), { production: '/home/deploy/wabot', staging: '/home/deploy/wabot-staging' })
})
test('recognizes only exact allowlisted Node worker scripts', () => {
  assert.deepEqual(classifyWorkerCmdline(Buffer.from('/usr/bin/node\0--max-old-space-size=384\0/srv/wabot/src/bot-worker.js\0'), roots), { environment: 'production' })
  assert.deepEqual(classifyWorkerCmdline('/usr/bin/node\0/srv/wabot-staging/src/bot-worker.js\0', roots), { environment: 'staging' })
  assert.equal(classifyWorkerCmdline('/bin/grep\0/srv/wabot/src/bot-worker.js\0', roots), null); assert.equal(classifyWorkerCmdline('/usr/bin/node\0/srv/wabot/src/bot-worker.js.bak\0', roots), null)
})
test('uses execFile fixed arguments and separates PM2 environments', async () => {
  let invocation
  const result = await collectProcessMetrics({ roots, execFile: async (...args) => { invocation = args; return { stdout: JSON.stringify([{ name: 'api', pid: 12, pm2_env: { status: 'online' }, monit: {} }, { name: 'api-staging', pid: 13, pm2_env: { status: 'online' }, monit: {} }]) } }, readdir: async () => [], readFile: async () => '' })
  assert.deepEqual(invocation.slice(0, 2), ['pm2', ['jlist']]); assert.deepEqual(result.components.map(({ key, environment }) => ({ key, environment })), [{ key: 'api', environment: 'production' }, { key: 'api-staging', environment: 'staging' }])
})
test('returns safe PM2 timeout and tolerates missing process fields', async () => {
  const error = Object.assign(new Error('secret stdout'), { killed: true }); const result = await collectProcessMetrics({ execFile: async () => { throw error }, readdir: async () => [], roots })
  assert.deepEqual(result.sources.pm2, { status: 'unavailable', errorCode: 'PM2_TIMEOUT' }); assert.equal(JSON.stringify(result).includes('secret'), false)
})
test('enumerates numeric /proc only and excludes collector command', async () => {
  const dir = (name, directory = true) => ({ name, isDirectory: () => directory }); const files = { '/proc/10/cmdline': Buffer.from('/usr/bin/node\0/srv/wabot/src/bot-worker.js\0'), '/proc/10/status': 'VmRSS:\t204800 kB\n', '/proc/11/cmdline': Buffer.from('/bin/sh\0collector bot-worker.js\0'), '/proc/11/status': 'VmRSS:\t999 kB\n' }
  const result = await collectProcessMetrics({ execFile: async () => ({ stdout: '[]' }), readdir: async () => [dir('10'), dir('11'), dir('self'), dir('12', false)], readFile: async (name) => files[name], roots })
  assert.deepEqual(result.workers, [{ pid: 10, environment: 'production', rssMb: 200 }])
  assert.equal(result.hostRssTotalMb, (204800 + 999) / 1024)
  assert.deepEqual(result.sources.proc, { status: 'ok', errorCode: null })
})

test('soma RSS independente de todos os processos sem expor cmdline', async () => {
  const dir = (name) => ({ name, isDirectory: () => true })
  const files = {
    '/proc/10/cmdline': Buffer.from('/usr/bin/node\0/srv/wabot/src/bot-worker.js\0'), '/proc/10/status': 'VmRSS:\t204800 kB\n',
    '/proc/20/cmdline': Buffer.from('/usr/bin/redis-server\0' + '127.0.0.1:6379\0'), '/proc/20/status': 'VmRSS:\t51200 kB\n',
  }
  const result = await collectProcessMetrics({ execFile: async () => ({ stdout: '[]' }), readdir: async () => [dir('10'), dir('20')], readFile: async (name) => files[name], roots, procConcurrency: 1 })
  assert.equal(result.hostRssTotalMb, 250)
  assert.equal(result.classifiedRssTotalMb, 200)
  assert.equal(JSON.stringify(result).includes('redis-server'), false)
})

test('RSS do host fica desconhecido quando /proc falha ou excede limite', async () => {
  const unavailable = await collectProcessMetrics({ execFile: async () => ({ stdout: '[]' }), readdir: async () => { throw new Error('no proc') }, roots })
  assert.equal(unavailable.hostRssTotalMb, null)
  assert.equal(unavailable.sources.proc.errorCode, 'PROC_UNAVAILABLE')
  const dir = (name) => ({ name, isDirectory: () => true })
  const truncated = await collectProcessMetrics({ execFile: async () => ({ stdout: '[]' }), readdir: async () => [dir('1'), dir('2')], readFile: async () => '', roots, maxProcPids: 1 })
  assert.equal(truncated.hostRssTotalMb, null)
  assert.equal(truncated.sources.proc.errorCode, 'PROC_LIMIT_EXCEEDED')
})
