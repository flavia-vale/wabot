import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LEAD_SOURCES,
  MAX_EMAIL_LENGTH,
  buildLeadCapturePayload,
  normalizeLeadEmail,
  normalizeLeadSource,
  sanitizeLeadContext,
} from '../src/marketing/leadCapture.js'

test('normalizeLeadEmail deduplica caixa e espaço em volta', () => {
  assert.equal(normalizeLeadEmail('  Ana@Gmail.COM '), 'ana@gmail.com')
})

test('normalizeLeadEmail rejeita formato inválido', () => {
  for (const invalid of ['', '   ', 'ana', 'ana@', '@gmail.com', 'ana gmail.com', 'ana@gmail']) {
    assert.equal(normalizeLeadEmail(invalid), null, `deveria rejeitar: ${JSON.stringify(invalid)}`)
  }
})

test('normalizeLeadEmail rejeita e-mail absurdamente longo', () => {
  const long = `${'a'.repeat(MAX_EMAIL_LENGTH)}@gmail.com`
  assert.equal(normalizeLeadEmail(long), null)
})

test('normalizeLeadSource aceita só a allowlist', () => {
  assert.equal(normalizeLeadSource(LEAD_SOURCES.RISK_CALCULATOR), LEAD_SOURCES.RISK_CALCULATOR)
  assert.equal(normalizeLeadSource('qualquer-coisa'), null)
  assert.equal(normalizeLeadSource(undefined), null)
})

test('sanitizeLeadContext corta valor longo e descarta objeto aninhado', () => {
  const safe = sanitizeLeadContext({
    band: 'alto',
    nested: { a: 1 },
    huge: 'x'.repeat(500),
  })
  assert.equal(safe.band, 'alto')
  assert.equal('nested' in safe, false)
  assert.equal(safe.huge.length, 80)
})

test('sanitizeLeadContext limita a quantidade de chaves', () => {
  const raw = {}
  for (let i = 0; i < 50; i += 1) raw[`k${i}`] = i
  assert.ok(Object.keys(sanitizeLeadContext(raw)).length <= 12)
})

test('sanitizeLeadContext tolera entrada não-objeto', () => {
  assert.deepEqual(sanitizeLeadContext(null), {})
  assert.deepEqual(sanitizeLeadContext('texto'), {})
  assert.deepEqual(sanitizeLeadContext([1, 2]), {})
})

test('buildLeadCapturePayload aceita corpo válido e normaliza', () => {
  const parsed = buildLeadCapturePayload({
    email: ' Flavia@Example.com ',
    source: LEAD_SOURCES.TIME_CALCULATOR,
    context: { saved_hours_month: 12 },
  })
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.lead, {
    email: 'flavia@example.com',
    source: LEAD_SOURCES.TIME_CALCULATOR,
    context: { saved_hours_month: '12' },
  })
})

test('buildLeadCapturePayload devolve erro em linguagem leiga, sem lançar', () => {
  const semEmail = buildLeadCapturePayload({ source: LEAD_SOURCES.RISK_CALCULATOR })
  assert.equal(semEmail.ok, false)
  assert.match(semEmail.error, /e-mail/i)

  const origemRuim = buildLeadCapturePayload({ email: 'a@b.com', source: 'inventada' })
  assert.equal(origemRuim.ok, false)
})

test('mensagens de erro não vazam jargão técnico para a tela', () => {
  const jargao = /\b(payload|source|regex|400|null|undefined|string)\b/i
  for (const body of [{}, { email: 'x' }, { email: 'a@b.com', source: 'z' }]) {
    const parsed = buildLeadCapturePayload(body)
    assert.equal(parsed.ok, false)
    assert.ok(!jargao.test(parsed.error), `jargão em: ${parsed.error}`)
  }
})
