import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMirrorTemplate, resolveMirrorOfferFromLink } from '../src/core/mirrorTemplate.js'

test('resolveMirrorOfferFromLink busca dados pelo motor de oferta usando o link convertido', async () => {
  const calls = []
  const fields = await resolveMirrorOfferFromLink({
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/produto?tag=afiliado',
    platform: 'amazon',
    credentialsMap: { amazon: { tag: 'afiliado' } },
    buildOffer: async (args) => {
      calls.push(args)
      const converted = await args.convertLink('amazon', 'https://loja.test/produto', args.credentialsMap)
      assert.equal(converted.url, 'https://loja.test/produto?tag=afiliado')
      return { title: 'Título do scraper', oldPrice: 'R$ 199,90', newPrice: 'R$ 99,90', displayUrl: converted.url }
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].keepOriginalLink, false)
  assert.equal(calls[0].url, 'https://loja.test/produto')
  assert.deepEqual(fields, {
    title: 'Título do scraper',
    oldPrice: 'R$ 199,90',
    price: 'R$ 99,90',
    link: 'https://loja.test/produto?tag=afiliado',
    storeName: 'amazon',
  })
})

test('applyMirrorTemplate renderiza com título/preço vindos do scraper, não do texto espelhado', async () => {
  const text = await applyMirrorTemplate('🔥 Oferta imperdível\nCaption upstream errado\nR$ 1,00\nhttps://loja.test/produto', {
    templateKey: 'tpl_mirror',
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/produto?tag=afiliado',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '🔥 {produto}\n💰 {preço}\n👉 {link}' }] }) },
    buildOffer: async () => ({ title: 'Título real do link', oldPrice: '', newPrice: 'R$ 99,90', displayUrl: 'https://loja.test/produto?tag=afiliado' }),
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
    buildOffer: async () => ({ title: 'Fone Bluetooth XPTO', oldPrice: '', newPrice: '', displayUrl: 'https://ex.com/a?tag=ok' }),
  })
  assert.doesNotMatch(text, /\{(?:preço|preço_de|desconto|rating|vendas)\}/)
  assert.match(text, /Fone Bluetooth XPTO/)
  assert.match(text, /https:\/\/ex\.com\/a\?tag=ok/)
  assert.match(text, /Entre no grupo VIP:/)
  assert.match(text, /https:\/\/chat\.whatsapp\.com\/grupo/)
})
