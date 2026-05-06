import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeAnalyticsMetadata } from '../src/analytics.js'

test('removes sensitive analytics metadata keys', () => {
  assert.deepEqual(
    sanitizeAnalyticsMetadata({
      plan: 'basic',
      token: 'secret-token',
      secretKey: 'secret',
      ssid: 'cookie',
      messageText: 'private message',
      groupRole: 'monitor',
    }),
    { plan: 'basic', groupRole: 'monitor' }
  )
})

test('truncates long string values', () => {
  const result = sanitizeAnalyticsMetadata({ plan: 'x'.repeat(120) })
  assert.equal(result.plan.length, 80)
})
