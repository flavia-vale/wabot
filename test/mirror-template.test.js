import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMirrorTemplate, resolveMirrorOfferFromLink } from '../src/core/mirrorTemplate.js'

test('resolveMirrorOfferFromLink lê o link ORIGINAL do produto e emite o link convertido', async () => {
  const scraped = []
  const fields = await resolveMirrorOfferFromLink({
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/sec/abc123',
    platform: 'amazon',
    credentialsMap: { amazon: { tag: 'afiliado' }, mercadolivre: { ssid: 'x' } },
    fetchInfo: async (url, opts) => {
      scraped.push({ url, opts })
      return { title: 'Título do produto', oldPrice: 'R$ 199,90', newPrice: 'R$ 99,90', finalUrl: 'https://loja.test/produto-canonico' }
    },
  })

  // Raspa o ORIGINAL (alvo confiável), não o convertido /sec/ de vitrine.
  assert.equal(scraped.length, 1)
  assert.equal(scraped[0].url, 'https://loja.test/produto')
  // Credenciais do ML repassadas ao scraper para evitar anti-bot.
  assert.equal(scraped[0].opts.mlCredentials.ssid, 'x')
  assert.deepEqual(fields, {
    title: 'Título do produto',
    oldPrice: 'R$ 199,90',
    price: 'R$ 99,90',
    // O link emitido é SEMPRE o convertido (afiliado), nunca o finalUrl canônico.
    link: 'https://loja.test/sec/abc123',
    storeName: 'Amazon',
  })
})

test('resolveMirrorOfferFromLink usa o convertido como último recurso quando o original não traz nada', async () => {
  const scraped = []
  const fields = await resolveMirrorOfferFromLink({
    originalUrl: 'https://loja.test/original',
    convertedUrl: 'https://loja.test/convertido',
    platform: 'mercadolivre',
    fetchInfo: async (url) => {
      scraped.push(url)
      if (url === 'https://loja.test/original') return { title: '', oldPrice: '', newPrice: '' }
      return { title: 'Produto real', oldPrice: '', newPrice: 'R$ 50,00' }
    },
  })

  assert.deepEqual(scraped, ['https://loja.test/original', 'https://loja.test/convertido'])
  assert.equal(fields.title, 'Produto real')
  assert.equal(fields.price, 'R$ 50,00')
  assert.equal(fields.link, 'https://loja.test/convertido')
})

test('resolveMirrorOfferFromLink NUNCA emite o link do terceiro: sem convertido, devolve null', async () => {
  // No espelhamento o originalUrl é o link de OUTRO afiliado. Sem link
  // convertido do nosso cliente, não pode sair oferta (evita vazar comissão).
  const fields = await resolveMirrorOfferFromLink({
    originalUrl: 'https://loja.test/terceiro?tag=concorrente',
    convertedUrl: '',
    platform: 'amazon',
    fetchInfo: async () => ({ title: 'Produto', oldPrice: '', newPrice: 'R$ 10,00' }),
  })
  assert.equal(fields, null)
})

test('applyMirrorTemplate renderiza com título/preço vindos do scraper, não do texto espelhado', async () => {
  const text = await applyMirrorTemplate('🔥 Oferta imperdível\nCaption upstream errado\nR$ 1,00\nhttps://loja.test/produto', {
    templateKey: 'tpl_mirror',
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/produto?tag=afiliado',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '🔥 {produto}\n💰 {preço}\n👉 {link}' }] }) },
    fetchInfo: async () => ({ title: 'Título real do link', oldPrice: '', newPrice: 'R$ 99,90' }),
  })

  assert.equal(text, '🔥 Título real do link\n💰 R$ 99,90\n👉 https://loja.test/produto?tag=afiliado')
  assert.doesNotMatch(text, /Caption upstream errado|R\$ 1,00/)
})

test('applyMirrorTemplate preserva texto original quando não há template válido ou link', async () => {
  assert.equal(await applyMirrorTemplate('original', { templateKey: 'missing', botConfig: {} }), 'original')
  assert.equal(await applyMirrorTemplate('Só um aviso sem link', {
    templateKey: 'tpl_mirror',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '🔥 {produto}\n👉 {link}' }] }) },
  }), 'Só um aviso sem link')
})

test('applyMirrorTemplate não vaza placeholders vazios e mantém branding do grupo', async () => {
  const text = await applyMirrorTemplate('Texto upstream sem preço\nhttps://ex.com/a', {
    templateKey: 'simples',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    botConfig: {
      mobileTemplatesJson: '{}',
      brandingGroupLink: 'https://chat.whatsapp.com/grupo',
      brandingCtaText: 'Entre no grupo VIP:',
    },
    fetchInfo: async () => ({ title: 'Fone Bluetooth XPTO', oldPrice: '', newPrice: '' }),
  })
  assert.doesNotMatch(text, /\{(?:preço|preço_de|desconto|rating|vendas)\}/)
  assert.match(text, /Fone Bluetooth XPTO/)
  assert.match(text, /https:\/\/ex\.com\/a\?tag=ok/)
  assert.match(text, /Entre no grupo VIP:/)
  assert.match(text, /https:\/\/chat\.whatsapp\.com\/grupo/)
})

test('applyMirrorTemplate preserva texto original quando o scraper lança erro inesperado', async () => {
  const warnings = []
  const original = 'Oferta original https://ex.com/a?tag=ok'
  const text = await applyMirrorTemplate(original, {
    templateKey: 'tpl_mirror',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '{produto}\n{link}' }] }) },
    fetchInfo: async () => { throw new Error('scraper indisponível') },
    logger: { warn: (payload, message) => warnings.push({ payload, message }) },
  })
  // Erro em ambos os candidatos => sem info útil => cai no relay (sem título/preço).
  assert.equal(text, original)
  assert.ok(warnings.length >= 1)
})

test('applyMirrorTemplate cai no relay quando o scrape não traz título nem preço', async () => {
  const original = 'Promo boa demais\nhttps://ex.com/a'
  const text = await applyMirrorTemplate(original, {
    templateKey: 'tpl_mirror',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '🔥 {produto}\n💰 {preço}\n👉 {link}' }] }) },
    fetchInfo: async () => ({ title: '', oldPrice: '', newPrice: '' }),
  })
  assert.equal(text, original)
})

test('applyMirrorTemplate cai no relay quando o scrape estoura o orçamento de tempo', async () => {
  const warnings = []
  const original = 'Oferta original https://ex.com/a?tag=ok'
  const text = await applyMirrorTemplate(original, {
    templateKey: 'tpl_mirror',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    scrapeBudgetMs: 20,
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '{produto}\n{link}' }] }) },
    fetchInfo: () => new Promise(() => {}), // nunca resolve — simula loja lenta
    logger: { warn: (payload, message) => warnings.push({ payload, message }) },
  })
  assert.equal(text, original)
  assert.equal(warnings.length, 1)
})
