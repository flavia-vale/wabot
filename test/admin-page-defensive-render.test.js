import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adminPageSource = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')

test('admin page normaliza coleções opcionais antes de renderizar listas vindas da API', () => {
  assert.match(adminPageSource, /const asArray = \(value\) => Array\.isArray\(value\) \? value : \[\]/)
  assert.match(adminPageSource, /const asPlainObject = \(value\) => value && typeof value === 'object' && !Array\.isArray\(value\) \? value : \{\}/)

  const brittlePatterns = [
    'customer.contactReasons.map',
    '(successQueue?.queue ?? []).map',
    '(systemMetrics?.routes ?? []).slice',
    '(systemMetrics?.recentErrors ?? []).slice',
    'Object.entries(sessionTelemetry?.summary || {})',
    '(sessionTelemetry?.events || []).slice',
    '(users?.users ?? []).map',
    '(sessions?.sessions ?? []).map',
    '(logs?.logs ?? []).map',
  ]

  for (const pattern of brittlePatterns) {
    assert.equal(
      adminPageSource.includes(pattern),
      false,
      `admin/page.js não deve renderizar com padrão frágil: ${pattern}`,
    )
  }

  const defensivePatterns = [
    'asArray(customer.contactReasons).map',
    'asArray(successQueue?.queue).map',
    'asArray(systemMetrics?.routes).slice',
    'asArray(systemMetrics?.recentErrors).slice',
    'Object.entries(asPlainObject(sessionTelemetry?.summary))',
    'asArray(sessionTelemetry?.events).slice',
    'asArray(users?.users).map',
    'asArray(sessions?.sessions).map',
    'asArray(logs?.logs).map',
  ]

  for (const pattern of defensivePatterns) {
    assert.equal(
      adminPageSource.includes(pattern),
      true,
      `admin/page.js deve usar padrão defensivo: ${pattern}`,
    )
  }
})
