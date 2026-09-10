import test from 'node:test'
import assert from 'node:assert/strict'
import { detectLinks } from '../src/detector.js'
import { PLATFORMS, sanitizeCredentialBody, validateCredentialData } from '../src/credentialHealth.js'
import { convertLink } from '../src/converters/index.js'
import { AFFILIATE_PLATFORMS, describeInvalidAffiliateValue } from '../dashboard/lib/painel/affiliatePlatforms.js'
import { describeSaveSessionCheck } from '../src/credentialSaveCheck.js'
import { buildCredentialBlockAlerts } from '../src/credentialBlockAlert/message.js'

test('AliExpress pertence ao contrato de credenciais com um código de acesso obrigatório', () => {
  assert.ok(PLATFORMS.includes('aliexpress'))
  const sanitized = sanitizeCredentialBody('aliexpress', { cookie: ' session=secret ' })
  assert.deepEqual(sanitized, { cookie: 'session=secret' })
  assert.equal(validateCredentialData('aliexpress', sanitized).configured, true)
  assert.deepEqual(validateCredentialData('aliexpress', {}).missing, ['cookie'])
  assert.equal(validateCredentialData('aliexpress', { cookie: 'incompleto' }).status, 'invalid')
  assert.match(describeInvalidAffiliateValue('aliexpress', 'cookie', 'incompleto'), /não parece completo/)
  assert.equal(validateCredentialData('aliexpress', { cookie: 'session=ok\r\nInjected: yes' }).status, 'invalid')
  const platform = AFFILIATE_PLATFORMS.find(item => item.id === 'aliexpress')
  assert.ok(platform)
  assert.equal(platform.fields.length, 1, 'AliExpress deve pedir somente o JSON do Cookie-Editor')
  assert.equal(platform.fields[0].key, 'cookie')
  assert.match(platform.fields[0].label, /JSON do Cookie-Editor/)
  assert.doesNotMatch(JSON.stringify(platform), /appKey|appSecret|trackingId/)
  assert.equal(platform.fields.find(field => field.key === 'cookie').sensitive, true)
  assert.deepEqual(
    sanitizeCredentialBody('aliexpress', { cookie: 'session=secret', injected: '<script>' }),
    { cookie: 'session=secret' },
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
  const credentials = { aliexpress: { cookie: 'session=secret' } }
  const result = await convertLink('aliexpress', 'https://aliexpress.com/item/1005001234567890.html', credentials, {
    fetchImpl: async () => ({ ok: true, async json() { return { code: '00', data: { shortLink: 'https://s.click.aliexpress.com/e/_ours' }, success: true } } }),
  })
  assert.equal(result.url, 'https://s.click.aliexpress.com/e/_ours')
  assert.equal(result.linkKind, 'product')
})
