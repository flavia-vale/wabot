import test from 'node:test'
import assert from 'node:assert/strict'
import { detectLinks } from '../src/detector.js'
import { PLATFORMS, sanitizeCredentialBody, validateCredentialData } from '../src/credentialHealth.js'
import { convertLink } from '../src/converters/index.js'
import { AFFILIATE_PLATFORMS, describeInvalidAffiliateValue } from '../dashboard/lib/painel/affiliatePlatforms.js'
import { describeSaveSessionCheck } from '../src/credentialSaveCheck.js'
import { buildCredentialBlockAlerts } from '../src/credentialBlockAlert/message.js'

test('AliExpress pertence ao contrato de credenciais com três campos obrigatórios', () => {
  assert.ok(PLATFORMS.includes('aliexpress'))
  const sanitized = sanitizeCredentialBody('aliexpress', { appKey: ' 123 ', appSecret: ' secret-value-123456 ', trackingId: ' minha-campanha ' })
  assert.deepEqual(sanitized, { appKey: '123', appSecret: 'secret-value-123456', trackingId: 'minha-campanha' })
  assert.equal(validateCredentialData('aliexpress', sanitized).configured, true)
  assert.deepEqual(validateCredentialData('aliexpress', { appKey: '123' }).missing, ['appSecret', 'trackingId'])
  assert.equal(validateCredentialData('aliexpress', { appKey: 'abc', appSecret: 'secret-value-123456', trackingId: 'track' }).status, 'invalid')
  assert.match(describeInvalidAffiliateValue('aliexpress', 'appKey', 'abc'), /somente números/)
  const platform = AFFILIATE_PLATFORMS.find(item => item.id === 'aliexpress')
  assert.ok(platform)
  assert.equal(platform.fields.find(field => field.key === 'appSecret').sensitive, true)
  assert.deepEqual(
    sanitizeCredentialBody('aliexpress', { appKey: '123', appSecret: 'secret-value-123456', trackingId: 'track', injected: '<script>' }),
    { appKey: '123', appSecret: 'secret-value-123456', trackingId: 'track' },
  )
})

test('falta de dados AliExpress gera aviso fail-closed em linguagem leiga', () => {
  const [alert] = buildCredentialBlockAlerts({
    blockedByPlatform: [{ platform: 'aliexpress', blockedCount: 2, lastBlockedAt: new Date().toISOString() }],
    configuredPlatforms: [],
  })
  assert.equal(alert.storeLabel, 'AliExpress')
  assert.match(alert.body, /nunca é publicado/)
  assert.doesNotMatch(alert.body, /appKey|appSecret|trackingId|API/)
})

test('save não promete credencial AliExpress aceita sem ter consultado a loja', () => {
  const feedback = describeSaveSessionCheck({
    platform: 'aliexpress',
    validation: { configured: true, label: 'AliExpress', warnings: [] },
    probe: null,
    fallbackMessage: 'Tudo certo!',
    isFirstCredential: true,
  })
  assert.equal(feedback.tone, 'warn')
  assert.match(feedback.message, /primeira oferta/)
  assert.doesNotMatch(feedback.message, /Tudo certo/)
})

test('detector reconhece AliExpress em texto e recusa domínio sósia', () => {
  const links = detectLinks('ok https://pt.aliexpress.com/item/1005001234567890.html ruim https://aliexpress.com.evil.test/item/1005001.html curto https://a.aliexpress.com/_mAbCd')
  assert.deepEqual(links.map(item => item.platform), ['aliexpress', 'aliexpress'])
})

test('registro central encaminha AliExpress ao conversor', async () => {
  const credentials = { aliexpress: { appKey: '123', appSecret: 'secret-value-123456', trackingId: 'track' } }
  const result = await convertLink('aliexpress', 'https://aliexpress.com/item/1005001234567890.html', credentials, {
    fetchImpl: async () => ({ ok: true, async json() { return { resp_result: { result: { promotion_links: [{ promotion_link: 'https://s.click.aliexpress.com/e/_ours' }] } } } } }),
  })
  assert.equal(result.url, 'https://s.click.aliexpress.com/e/_ours')
  assert.equal(result.linkKind, 'product')
})
