import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adminPageSource = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
// Listas técnicas (métricas de rota, telemetria, sessões, logs, erros 24h)
// moram na página Operação desde o G2 da auditoria — a regra defensiva vale
// para as duas telas, por isso os padrões são procurados na soma dos dois arquivos.
const operacaoSource = readFileSync(new URL('../dashboard/app/admin/operacao/page.js', import.meta.url), 'utf8')
const fontes = adminPageSource + '\n' + operacaoSource

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
      fontes.includes(pattern),
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
    'sortByDateField(asArray(users?.users), usersSort)',
    'asArray(sessions?.sessions).map',
    'asArray(logs?.logs).map',
  ]

  for (const pattern of defensivePatterns) {
    assert.equal(
      fontes.includes(pattern),
      true,
      `admin/page.js deve usar padrão defensivo: ${pattern}`,
    )
  }
})


test('admin page exibe volumetria de erros das últimas 24h', () => {
  assert.match(operacaoSource, /api\.adminLogsSummary\('24h', \{ topErrors: 50 \}\)/)
  assert.match(operacaoSource, /function ErrorVolumeCard\(\{ summary \}\)/)
  assert.match(operacaoSource, /Erros nas últimas 24h/)
  assert.match(operacaoSource, /errorsByMessage/)
})
