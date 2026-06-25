import test from 'node:test'
import assert from 'node:assert/strict'

import { applyConversionsAndBranding, appendBrandingFooter, buildProcessedMessage, DEFAULT_BRANDING_CTA_TEXT, extractKeywordTokens, hasSignificantTokenOverlap, isValidBrandingLink, normalizeBrandingCtaText, normalizeBrandingLink, sanitizeInviteLinks, stripUrlsFromText } from '../src/messageProcessor.js'

test('sanitizeInviteLinks remove convites WhatsApp e Telegram preservando oferta', () => {
  const original = 'Oferta top https://amzn.to/item\nEntre no grupo https://chat.whatsapp.com/AbCdEf12345 e t.me/+ConviteXYZ'
  const sanitized = sanitizeInviteLinks(original)

  assert.equal(sanitized.includes('chat.whatsapp.com'), false)
  assert.equal(sanitized.includes('t.me/+'), false)
  assert.equal(sanitized.includes('https://amzn.to/item'), true)
  assert.equal(sanitized.startsWith('Oferta top'), true)
})

test('sanitizeInviteLinks remove links que não são de marketplace de oferta em qualquer posição', () => {
  const sanitized = sanitizeInviteLinks([
    '🔥 Oferta imperdível https://amzn.to/produto',
    'Veja mais no nosso site https://ofertasdagrasi.lovable.app hoje',
    'Outro link aleatório: https://bit.ly/xyz',
  ].join('\n'))

  assert.equal(sanitized.includes('lovable.app'), false)
  assert.equal(sanitized.includes('bit.ly'), false)
  assert.equal(sanitized.includes('https://amzn.to/produto'), true)
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
  const originalUrl = 'https://amazon.com.br/item'
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

test('sanitizeInviteLinks remove CTA+link final irrelevante fora de marketplaces suportados', () => {
  const sanitized = sanitizeInviteLinks([
    '🚨 MENOR PREÇO!',
    '🔗 LINK PROMOCIONAL: https://s.shopee.com.br/809mpYoiVb?lp=aff',
    '🎫 Cupons disponíveis aqui: 👇',
    'https://s.shopee.com.br/7VDWEdqxpm',
    '🛍️ Conheça nossos grupos👇',
    'https://ofertasdagrasi.lovable.app',
  ].join('\n'))

  assert.equal(sanitized.includes('ofertasdagrasi.lovable.app'), false)
  assert.equal(sanitized.includes('Conheça nossos grupos'), false)
  assert.equal(sanitized.includes('https://s.shopee.com.br/809mpYoiVb?lp=aff'), true)
  assert.equal(sanitized.includes('https://s.shopee.com.br/7VDWEdqxpm'), true)
})

test('branding vazio ou inválido não altera a mensagem', () => {
  assert.equal(appendBrandingFooter('Oferta convertida', ''), 'Oferta convertida')
  assert.equal(appendBrandingFooter('Oferta convertida', 'chat.whatsapp.com/sem-protocolo'), 'Oferta convertida')
  assert.equal(isValidBrandingLink('https://t.me/+GrupoValido'), true)
  assert.equal(normalizeBrandingLink(' https://t.me/+GrupoValido '), 'https://t.me/+GrupoValido')
  assert.equal(isValidBrandingLink('nota'), false)
})

test('appendBrandingFooter permite CTA personalizado e normaliza texto vazio para o padrao', () => {
  assert.equal(
    appendBrandingFooter('Oferta convertida', 'https://chat.whatsapp.com/meu-grupo', 'Entre na comunidade:'),
    'Oferta convertida\n\nEntre na comunidade: https://chat.whatsapp.com/meu-grupo',
  )
  assert.equal(normalizeBrandingCtaText('   '), DEFAULT_BRANDING_CTA_TEXT)
})

test('buildProcessedMessage usa CTA personalizado no rodape', () => {
  const finalText = buildProcessedMessage(
    'Oferta https://amazon.com.br/item',
    [{ url: 'https://amazon.com.br/item', converted: 'https://afiliado.example/item' }],
    'https://t.me/meu_grupo',
    'Receba mais ofertas:',
  )

  assert.equal(finalText.endsWith('Receba mais ofertas: https://t.me/meu_grupo'), true)
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
  const hostile = `${'x'.repeat(20_000)} t.me/${'a'.repeat(20_000)} https://amzn.to/item`
  const sanitized = sanitizeInviteLinks(hostile)

  assert.equal(sanitized.includes('https://amzn.to/item'), true)
  assert.equal(sanitized.includes('t.me/'), false)
})

test('extractKeywordTokens normaliza, remove stopwords e ignora tokens curtos', () => {
  const tokens = extractKeywordTokens('Jogo de Toalhas 4 Peças Fio Cardado 100% Algodão Softmax Bressan Karsten')
  assert.equal(tokens.has('jogo'), true)
  assert.equal(tokens.has('toalhas'), true)
  assert.equal(tokens.has('algodao'), true)
  assert.equal(tokens.has('softmax'), true)
  assert.equal(tokens.has('bressan'), true)
  assert.equal(tokens.has('karsten'), true)
  // stopwords e tokens curtos descartados
  assert.equal(tokens.has('de'), false)
  assert.equal(tokens.has('fio'), false)
  assert.equal(tokens.has('para'), false)
  assert.equal(tokens.has('100'), false)
})

test('hasSignificantTokenOverlap detecta mismatch entre título de mochila e texto de toalhas', () => {
  const titulo = 'Mochila Esportiva Adidas Originals Trefoil 30L Preta'
  const caption = '✅ Jogo de Toalhas 4 Peças Fio Cardado 100 Algodão Softmax Bressan Karsten - Bordô ou Azul/Branco'
  assert.equal(hasSignificantTokenOverlap(titulo, caption), false)
})

test('hasSignificantTokenOverlap aceita quando há overlap em pelo menos um token relevante', () => {
  const titulo = 'Jogo de Toalhas 4 Peças Karsten Softmax Algodão'
  const caption = '✅ Jogo de Toalhas 4 Peças Fio Cardado 100 Algodão Softmax Bressan Karsten'
  assert.equal(hasSignificantTokenOverlap(titulo, caption), true)
})

test('hasSignificantTokenOverlap aceita quando título tem poucos tokens significativos (sinal insuficiente)', () => {
  // Título genérico com pouca substância — não flagamos para não bloquear ofertas válidas.
  assert.equal(hasSignificantTokenOverlap('Oferta Imperdível', 'qualquer texto aqui'), true)
})

test('hasSignificantTokenOverlap rejeita quando candidato vazio mas título tem signal', () => {
  assert.equal(hasSignificantTokenOverlap('Mochila Adidas Trefoil Esportiva 30L', ''), false)
})

test('hasSignificantTokenOverlap ignora ruído de marketplace (nomes de plataformas) no título', () => {
  // Título do og:title da Amazon costuma vir "Amazon.com.br: <Produto>".
  // Sem stopwords, "amazon" daria match com qualquer caption mencionando Amazon.
  const titulo = 'Amazon.com.br Mochila Esportiva Trefoil 30L'
  const caption = 'Oferta Amazon imperdível confira'
  assert.equal(hasSignificantTokenOverlap(titulo, caption), false)
})

test('stripUrlsFromText remove URL de cupom do texto e normaliza espaços', () => {
  const text = '🔗 Compre aqui:\nhttps://s.shopee.com.br/6Aiuu0cLP2\n\n🏷️ Cupons disponíveis aqui: https://s.shopee.com.br/40eQK1or1O\n\n🛍️ Vitrine de Links'
  const result = stripUrlsFromText(text, ['https://s.shopee.com.br/40eQK1or1O'])
  assert.ok(!result.includes('40eQK1or1O'), 'URL de cupom deve ser removida')
  assert.ok(result.includes('6Aiuu0cLP2'), 'URL de produto deve ser preservada')
  assert.ok(!result.includes('\n\n\n'), 'não deve sobrar linhas em branco excessivas')
})

test('stripUrlsFromText não altera texto quando lista de URLs for vazia', () => {
  const text = 'texto sem mudança'
  assert.equal(stripUrlsFromText(text, []), text)
  assert.equal(stripUrlsFromText(text, null), text)
})
