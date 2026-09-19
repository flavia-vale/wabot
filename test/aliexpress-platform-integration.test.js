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

// Decisão da dona do produto (2026-09-19): o banner do topo do painel para a
// AliExpress foi RETIRADO. A conversão dela segue fail-closed (nada é
// publicado sem cadastro) e a oferta perdida continua visível no histórico de
// envios com a etiqueta "faltou cadastrar a loja" — o que saiu foi o banner,
// não o sinal. As outras lojas não podem ser arrastadas junto.
test('AliExpress sem cadastro NÃO gera aviso no topo do painel', () => {
  const stores = buildCredentialBlockAlerts({
    blockedByPlatform: [{ platform: 'aliexpress', blockedCount: 2, lastBlockedAt: new Date().toISOString() }],
    configuredPlatforms: [],
  })
  assert.deepEqual(stores, [])
})

test('retirar o aviso da AliExpress não calou o das outras lojas', () => {
  const stores = buildCredentialBlockAlerts({
    blockedByPlatform: [
      { platform: 'aliexpress', blockedCount: 2, lastBlockedAt: new Date().toISOString() },
      { platform: 'shopee', blockedCount: 3, lastBlockedAt: new Date().toISOString() },
      { platform: 'shein', blockedCount: 1, lastBlockedAt: new Date().toISOString() },
      { platform: 'mercadolivre', blockedCount: 1, lastBlockedAt: new Date().toISOString() },
    ],
    configuredPlatforms: [],
  })
  assert.deepEqual(stores.map(s => s.platform), ['shopee', 'shein', 'mercadolivre'])
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
