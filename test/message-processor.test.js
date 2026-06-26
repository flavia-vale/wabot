import test from 'node:test'
import assert from 'node:assert/strict'

import { applyConversionsAndBranding, appendBrandingFooter, buildProcessedMessage, DEFAULT_BRANDING_CTA_TEXT, extractKeywordTokens, hasSignificantTokenOverlap, isCouponAnnouncement, isValidBrandingLink, looksLikeGenericCoupon, normalizeBrandingCtaText, normalizeBrandingLink, sanitizeInviteLinks, stripUrlsFromText } from '../src/messageProcessor.js'

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

test('isCouponAnnouncement detecta mensagens de cupom genérico (casos reais dos prints)', () => {
  assert.equal(
    isCouponAnnouncement('🛒 *NOVO CUPOM AMAZON* 🛒 ➡ _10% OFF acima de R$200, limitado a R$50_ 🎟 CUPOM: *ALOCUPOM*...'),
    true,
    'Amazon coupon com código ALOCUPOM'
  )
  assert.equal(
    isCouponAnnouncement('🎟 *NOVO CUPOM ML* 🎟 ➡ _10% OFF em R$79, limitado a R$40 OFF_ 🎟 cupom: *GRAMADOVERDE*'),
    true,
    'Mercado Livre coupon com código GRAMADOVERDE'
  )
  assert.equal(
    isCouponAnnouncement('NOVO CUPOM NO ML\n\nUse o Cupom: TORCIDAO\n10% OFF, mínimo de R$ 99\nLimite de R$ 40'),
    true,
    'Outro padrão de ML com código TORCIDAO'
  )
})

test('isCouponAnnouncement não confunde oferta de produto com cupom', () => {
  assert.equal(
    isCouponAnnouncement('Camiseta Adidas Branca 30% OFF - R$99'),
    false,
    'oferta de produto sem cupom'
  )
  assert.equal(
    isCouponAnnouncement('Tênis Nike Air Max imperdível hoje'),
    false,
    'oferta sem cupom nem código'
  )
  assert.equal(
    isCouponAnnouncement('Frete grátis em compras acima de R$50 na Amazon'),
    false,
    'promoção de frete sem cupom'
  )
})

test('isCouponAnnouncement retorna false para texto vazio ou sem cupom', () => {
  assert.equal(isCouponAnnouncement(''), false)
  assert.equal(isCouponAnnouncement('   '), false)
  assert.equal(isCouponAnnouncement('Produto incrível ADIDAS disponível'), false, 'palavra maiúscula sem cupom')
})

// looksLikeGenericCoupon — decide a imagem de cupons quando o título do link não
// pôde ser raspado (titleOverlap='unknown'). Caso real da regressão 2026-06: um
// cupom store-wide do ML mostrava uma camiseta branca aleatória em hi-res.
test('looksLikeGenericCoupon detecta cupom store-wide (caso real da camiseta branca)', () => {
  assert.equal(
    looksLikeGenericCoupon('NOVO CUPOM NO ML\nCupom: OFFMELI\n10% OFF em compras a partir de R$ 79\nLimite de R$ 60\nAtive e pesquise pelo produto desejado: https://meli.la/1cUFh49'),
    true,
  )
  assert.equal(looksLikeGenericCoupon('10% OFF em compras a partir de R$ 200'), true, 'limite mínimo de carrinho')
  assert.equal(looksLikeGenericCoupon('pesquise pelo produto desejado'), true)
  assert.equal(looksLikeGenericCoupon('válido para qualquer produto da loja'), true)
})

test('looksLikeGenericCoupon NÃO marca oferta de produto específico (preserva produto+cupom)', () => {
  // Produto + cupom nomeia o produto; não usa frases de cupom de loja.
  assert.equal(
    looksLikeGenericCoupon('Tênis Polo Wear Masculino Casual por R$ 89,90\nUse o Cupom: VEMAPROVEITAR'),
    false,
  )
  assert.equal(looksLikeGenericCoupon('Camiseta Adidas Branca 30% OFF - R$99 Cupom: TORCIDAO'), false)
  assert.equal(looksLikeGenericCoupon(''), false)
})

// Regressão — bug introduzido em PR #1061: stripUrlsFromText removia a linha
// inteira quando a URL do produto (já convertida para afiliado) e a URL de
// cupom estavam na MESMA LINHA, matando o link do produto e deixando a
// mensagem vazia → espelhamento parava para mensagens nesse formato.
test('stripUrlsFromText preserva link do produto quando na mesma linha do cupom', () => {
  const productAffiliate = 'https://shopee.prf.hn/affiliate/produto123'
  const couponUrl = 'https://s.shopee.com.br/couponXYZ'
  const text = `OFERTA! ${productAffiliate} 🏷️ Cupons: ${couponUrl}`

  const result = stripUrlsFromText(text, [couponUrl])

  assert.ok(result.includes(productAffiliate), 'link do produto afiliado deve ser preservado')
  assert.equal(result.includes(couponUrl), false, 'URL do cupom deve ser removida')
})

test('stripUrlsFromText remove a linha inteira quando só tem URL de cupom (CTA órfão)', () => {
  const couponUrl = 'https://s.shopee.com.br/couponXYZ'
  const text = `OFERTA incrível!\n🏷️ Cupons disponíveis aqui: ${couponUrl}`

  const result = stripUrlsFromText(text, [couponUrl])

  assert.ok(result.includes('OFERTA incrível'), 'texto do produto deve ser preservado')
  assert.equal(result.includes(couponUrl), false, 'URL do cupom deve ser removida')
  assert.equal(result.includes('Cupons disponíveis aqui'), false, 'CTA órfão deve ser removido')
})

test('stripUrlsFromText: mensagem com produto + cupom na mesma linha não fica vazia', () => {
  const productAffiliate = 'https://shopee.prf.hn/affiliate/abc'
  const couponUrl = 'https://s.shopee.com.br/cupomABC'
  const text = `Produto TOP ${productAffiliate} | Cupom: ${couponUrl}`

  const result = stripUrlsFromText(text, [couponUrl])

  assert.ok(result.trim().length > 0, 'mensagem não pode ficar vazia')
  assert.ok(result.includes(productAffiliate), 'produto afiliado preservado')
})
