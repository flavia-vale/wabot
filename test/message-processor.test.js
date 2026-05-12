import test from 'node:test'
import assert from 'node:assert/strict'

import { applyConversionsAndBranding, appendBrandingFooter, buildProcessedMessage, isValidBrandingLink, normalizeBrandingLink, sanitizeInviteLinks } from '../src/messageProcessor.js'

test('sanitizeInviteLinks remove convites WhatsApp e Telegram preservando oferta', () => {
  const original = 'Oferta top https://produto.example/item\nEntre no grupo https://chat.whatsapp.com/AbCdEf12345 e t.me/+ConviteXYZ'
  const sanitized = sanitizeInviteLinks(original)

  assert.equal(sanitized.includes('chat.whatsapp.com'), false)
  assert.equal(sanitized.includes('t.me/+'), false)
  assert.equal(sanitized.includes('https://produto.example/item'), true)
  assert.equal(sanitized.startsWith('Oferta top'), true)
})

test('sanitizeInviteLinks remove convites com querystring, canais e grupos publicos do Telegram', () => {
  const original = [
    'Oferta https://shopee.com.br/produto?abc=1',
    'Grupo monitorado: https://chat.whatsapp.com/AbCdEf12345?mode=ac_t.',
    'Canal: www.whatsapp.com/channel/CanalMonitorado123,',
    'Telegram: https://t.me/grupo_publico',
    'Telegram www: https://www.t.me/outro_grupo',
  ].join('\n')
  const sanitized = sanitizeInviteLinks(original)

  assert.equal(sanitized.includes('chat.whatsapp.com'), false)
  assert.equal(sanitized.includes('whatsapp.com/channel'), false)
  assert.equal(sanitized.includes('t.me/grupo_publico'), false)
  assert.equal(sanitized.includes('www.t.me/outro_grupo'), false)
  assert.equal(sanitized.includes('https://shopee.com.br/produto?abc=1'), true)
})

test('buildProcessedMessage sanitiza antes de converter e anexa branding válido', () => {
  const originalUrl = 'https://produto.example/item'
  const converted = 'https://afiliado.example/item?tag=abc'
  const brandingLink = 'https://chat.whatsapp.com/MeuGrupo123'
  const finalText = buildProcessedMessage(
    `Oferta imperdível ${originalUrl}\nGrupo monitorado: https://chat.whatsapp.com/GrupoMonitorado123`,
    [{ url: originalUrl, converted }],
    brandingLink,
  )

  assert.equal(finalText.includes('GrupoMonitorado123'), false)
  assert.equal(finalText.includes(originalUrl), false)
  assert.equal(finalText.includes(converted), true)
  assert.equal(finalText.endsWith(`Participe do grupo: ${brandingLink}`), true)
})



test('buildProcessedMessage remove CTAs orfaos do grupo monitorado antes de anexar branding', () => {
  const originalUrl = 'https://shopee.com.br/produto?abc=1'
  const converted = 'https://s.shopee.com.br/afiliado'
  const brandingLink = 'https://chat.whatsapp.com/MeuGrupo'
  const finalText = buildProcessedMessage(
    [
      `Oferta relampago ${originalUrl}`,
      'Participe do Grupo:',
      'https://chat.whatsapp.com/GrupoMonitorado?mode=ac_t',
      '🚀 Participe do Grupo VIP: https://t.me/grupo_monitorado',
    ].join('\n'),
    [{ url: originalUrl, converted }],
    brandingLink,
  )

  assert.equal(finalText.includes('GrupoMonitorado'), false)
  assert.equal(finalText.includes('grupo_monitorado'), false)
  assert.equal(finalText.match(/Participe do Grupo/gi)?.length, 1)
  assert.equal(finalText.includes(converted), true)
  assert.equal(finalText.endsWith(`Participe do grupo: ${brandingLink}`), true)
})

test('sanitizeInviteLinks remove CTA inline que ficou sem link de convite', () => {
  const sanitized = sanitizeInviteLinks('Oferta boa https://amzn.to/produto 🚀 Participe do Grupo: https://chat.whatsapp.com/Monitorado')

  assert.equal(sanitized, 'Oferta boa https://amzn.to/produto')
})

test('branding vazio ou inválido não altera a mensagem', () => {
  assert.equal(appendBrandingFooter('Oferta convertida', ''), 'Oferta convertida')
  assert.equal(appendBrandingFooter('Oferta convertida', 'chat.whatsapp.com/sem-protocolo'), 'Oferta convertida')
  assert.equal(isValidBrandingLink('https://t.me/+GrupoValido'), true)
  assert.equal(normalizeBrandingLink(' https://t.me/+GrupoValido '), 'https://t.me/+GrupoValido')
  assert.equal(isValidBrandingLink('nota'), false)
})

test('mensagem composta apenas por convite vira vazia sem lançar erro', () => {
  assert.equal(sanitizeInviteLinks('https://chat.whatsapp.com/ApenasConvite123'), '')
  assert.equal(buildProcessedMessage('https://chat.whatsapp.com/ApenasConvite123', [], 'https://t.me/+MeuGrupo'), '')
})

test('applyConversionsAndBranding reutiliza texto já sanitizado sem segunda limpeza por regex', () => {
  const finalText = applyConversionsAndBranding(
    'Oferta https://produto.example/item',
    [{ url: 'https://produto.example/item', converted: 'https://afiliado.example/item' }],
    '',
  )

  assert.equal(finalText, 'Oferta https://afiliado.example/item')
})

test('sanitizeInviteLinks processa entrada grande hostil sem backtracking catastrófico', () => {
  const hostile = `${'x'.repeat(20_000)} t.me/${'a'.repeat(20_000)} https://produto.example/item`
  const sanitized = sanitizeInviteLinks(hostile)

  assert.equal(sanitized.includes('https://produto.example/item'), true)
  assert.equal(sanitized.includes('t.me/'), false)
})
