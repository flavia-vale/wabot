import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildConversionIssue, persistConversionIssue } from '../src/conversionDiagnostics.js'
import {
  describeSheinConversionError,
  SHEIN_CONVERSION_ERROR,
} from '../src/converters/shein.js'

test('diagnósticos SHEIN são leigos e não culpam credencial ou cookie', () => {
  const cases = [
    [SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN, /não permitiu identificar o produto/i],
    [SHEIN_CONVERSION_ERROR.RESOLUTION_TRANSIENT, /consultar.*agora/i],
    [SHEIN_CONVERSION_ERROR.UNKNOWN, /não foi possível converter/i],
  ]
  for (const [code, expected] of cases) {
    const message = describeSheinConversionError(code)
    assert.match(message, expected)
    assert.doesNotMatch(message, /credencial|cookie|código de acesso|etiqueta/i)
  }
})

test('seam persiste os três códigos SHEIN somente após credencial válida', async () => {
  for (const code of Object.values(SHEIN_CONVERSION_ERROR)) {
    const recorded = []
    const handled = await persistConversionIssue({
      platform: 'shein',
      credentialValidation: { configured: true, label: 'SHEIN' },
      error: { code, message: 'segredo não deve passar' },
    }, issue => recorded.push(issue))
    assert.equal(handled, true)
    assert.equal(recorded.length, 1)
    assert.equal(recorded[0].errorMsg, `error:conversion:${code}`)
    assert.doesNotMatch(JSON.stringify(recorded[0]), /segredo não deve passar/)
  }
})

test('falta de tag usa exclusivamente o diagnóstico de credencial', () => {
  const issue = buildConversionIssue({
    platform: 'shein',
    credentialValidation: { configured: false, label: 'SHEIN', missing: ['tag'] },
    error: { code: SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN },
  })
  assert.equal(issue.kind, 'missing_credentials')
  assert.equal(issue.errorMsg, null)
  assert.match(issue.reason, /etiqueta de afiliado/i)
  assert.doesNotMatch(issue.reason, /compartilhamento|cookie/i)
})

test('outra plataforma nunca recebe código ou mensagem SHEIN', async () => {
  const recorded = []
  const handled = await persistConversionIssue({
    platform: 'amazon',
    credentialValidation: { configured: true, label: 'Amazon' },
    error: { code: SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN },
  }, issue => recorded.push(issue))
  assert.equal(handled, false)
  assert.deepEqual(recorded, [])
})

test('falha de encurtamento com resultado longo não cria diagnóstico', () => {
  const issue = buildConversionIssue({
    platform: 'shein',
    credentialValidation: { configured: true, label: 'SHEIN' },
    error: null,
  })
  assert.equal(issue, null)
})

test('campos novos do diagnóstico não propagam valores sensíveis', () => {
  const secrets = ['tag-123', 'cookie-secret', 'shc-secret', 'link-secret', 'https://api-shein.shein.com/intermediate']
  const issue = buildConversionIssue({
    platform: 'shein',
    credentialValidation: { configured: true, label: 'SHEIN' },
    error: { code: SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN, secrets },
  })
  const serialized = JSON.stringify(issue)
  for (const secret of secrets) assert.doesNotMatch(serialized, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})
