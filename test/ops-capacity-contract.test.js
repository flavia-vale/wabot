import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCapacityResponse, sanitizeCapacityComponent, sanitizeCapacityValue } from '../src/ops/capacity/contract.js'
test('sanitizes secrets, execution output and full paths recursively', () => assert.deepEqual(sanitizeCapacityValue({ safe: 1, env: { HCLOUD_READ_TOKEN: 'abc' }, token: 'abc', Authorization: 'Bearer abc', cmdline: '/usr/bin/node secret', stdout: 'secret', stderr: 'secret', executablePath: '/home/deploy/wabot', nested: { ok: true, password: 'x' } }), { safe: 1, nested: { ok: true } }))
test('normalizes non-finite and unsupported values without inventing zero', () => assert.deepEqual(sanitizeCapacityValue({ missing: undefined, bad: Infinity, unknown: Symbol('x'), good: 0 }), { bad: null, good: 0 }))
test('component serialization is an explicit allowlist', () => assert.deepEqual(sanitizeCapacityComponent({ key: 'api', environment: 'production', status: 'online', rssMb: 12, command: 'secret', extra: 1 }), { key: 'api', environment: 'production', status: 'online', pid: null, uptimeSeconds: null, restartCount: null, cpuPercent: null, rssMb: 12, count: null }))
test('response is versioned and sources are allowlisted', () => {
  const response = buildCapacityResponse({ snapshot: null, sources: [{ name: 'host', status: 'ok', observedAt: null, ageSeconds: 1, errorCode: null, stdout: 'secret' }] })
  assert.equal(response.version, 'admin-capacity-v1'); assert.deepEqual(response.sources[0], { name: 'host', status: 'ok', observedAt: null, ageSeconds: 1, errorCode: null })
})
