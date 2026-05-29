import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TEMPLATE_OPTIONS,
  buildMobileOfferText,
  countMobileOfferHttpLinks,
  detectMobileOfferStoreKey,
  getMobileOfferSingleLinkWarning,
  normalizeMobileOfferProduct,
} from '../dashboard/lib/mobileOfferComposer.js'
import { PRESET_TEMPLATE_BODIES } from '../dashboard/lib/mobileTemplateStore.js'

test('normaliza preço raspado quando a API retorna newPrice em vez de price', () => {
  const product = normalizeMobileOfferProduct({ title: 'Tênis leve', newPrice: 'R$ 129,90', oldPrice: 'R$ 199,90' })

  assert.deepEqual(product, {
    title: 'Tênis leve',
    price: 'R$ 129,90',
    oldPrice: 'R$ 199,90',
  })
})


test('template padrão Simples usa tags e preenche produto, preços e link', () => {
  assert.match(PRESET_TEMPLATE_BODIES.simples, /\{produto\}/)
  assert.match(PRESET_TEMPLATE_BODIES.simples, /\{preço_de\}/)
  assert.match(PRESET_TEMPLATE_BODIES.simples, /\{preço\}/)
  assert.match(PRESET_TEMPLATE_BODIES.simples, /\{link\}/)

  const text = buildMobileOfferText({
    product: { title: 'Cafeteira inox', price: 'R$ 398', oldPrice: 'R$ 499' },
    link: 'https://afiliado.test/cafeteira',
    template: 'simples',
    templateBody: PRESET_TEMPLATE_BODIES.simples,
  })

  assert.match(text, /🛍️ Cafeteira inox/)
  assert.match(text, /~De R\$ 499~/)
  assert.match(text, /💥 \*Por R\$ 398\*/)
  assert.match(text, /🛒 Compre aqui 👉 https:\/\/afiliado\.test\/cafeteira/)
  assert.doesNotMatch(text, /\{produto\}|\{preço_de\}|\{preço\}|\{link\}/)
})

test('template Simples remove a linha de preço antigo quando ele não vem do scrape', () => {
  const text = buildMobileOfferText({
    product: { title: 'Produto novo', price: 'R$ 39,90' },
    link: 'https://afiliado.test/produto',
    template: 'simples',
    templateBody: PRESET_TEMPLATE_BODIES.simples,
  })

  assert.match(text, /🛍️ Produto novo/)
  assert.match(text, /💥 \*Por R\$ 39,90\*/)
  assert.doesNotMatch(text, /^\s*~?De\s*~?$/m)
  assert.doesNotMatch(text, /~De ~/)
  assert.doesNotMatch(text, /\{preço_de\}/)
})

test('todos os templates preveem lugar para preço quando produto ainda não tem preço', () => {
  for (const template of TEMPLATE_OPTIONS) {
    assert.match(template.preview, /R\$|\{preço\}/i, `preview sem preço: ${template.key}`)
    const text = buildMobileOfferText({
      product: { title: 'Produto sem preço' },
      link: 'https://exemplo.test/oferta',
      template: template.key,
    })

    assert.match(text, /\{preço_de\}/, `template ${template.key} deve reservar preço_de`)
    assert.match(text, /\{preço\}/, `template ${template.key} deve reservar preço`)
  }
})

test('monta mensagem com preço novo, preço antigo e link convertido', () => {
  const text = buildMobileOfferText({
    product: { title: 'Fone bluetooth', newPrice: 'R$ 89,90', oldPrice: 'R$ 149,90' },
    link: 'https://afiliado.test/fone',
    template: 'tech',
  })

  assert.match(text, /Fone bluetooth/)
  assert.match(text, /De R\$ 149,90 por \*R\$ 89,90\*/)
  assert.match(text, /https:\/\/afiliado\.test\/fone/)
})

test('bonus de grupo e cupom só entram quando têm links reais preenchidos', () => {
  const withoutLinks = buildMobileOfferText({
    product: { title: 'Produto', price: 'R$ 39,90' },
    link: 'https://afiliado.test/produto',
    bonusMode: 'both',
    groupBonus: { cta: '💜 Entre no grupo:', link: '' },
    couponLinks: { shopee: '' },
    selectedCouponStores: ['shopee'],
  })

  assert.doesNotMatch(withoutLinks, /Entre no grupo/)
  assert.doesNotMatch(withoutLinks, /Mais cupons/)

  const withLinks = buildMobileOfferText({
    product: { title: 'Produto', price: 'R$ 39,90' },
    link: 'https://afiliado.test/produto',
    bonusMode: 'both',
    groupBonus: { cta: '💜 Entre no grupo:', link: 'https://chat.whatsapp.com/grupo' },
    couponCta: '🎟 Cupons da {loja}:',
    couponLinks: { shopee: 'https://cupom.test/shopee' },
    selectedCouponStores: ['shopee'],
    offerStoreKey: 'shopee',
  })

  assert.match(withLinks, /💜 Entre no grupo:\nhttps:\/\/chat\.whatsapp\.com\/grupo/)
  assert.match(withLinks, /🎟 Cupons da Shopee:\nhttps:\/\/cupom\.test\/shopee/)
})

test('oferta manual aceita apenas um link http por vez', () => {
  assert.equal(countMobileOfferHttpLinks('https://loja.test/produto'), 1)
  assert.equal(countMobileOfferHttpLinks('um https://loja.test/a e outro http://loja.test/b'), 2)
  assert.match(getMobileOfferSingleLinkWarning('https://a.test/1 https://b.test/2'), /apenas um link/i)
})

test('links inválidos de grupo e cupom não entram na mensagem', () => {
  const text = buildMobileOfferText({
    product: { title: 'Produto', price: 'R$ 39,90', platform: 'shopee' },
    link: 'https://afiliado.test/produto',
    bonusMode: 'both',
    groupBonus: { cta: '💜 Entre no grupo:', link: 'chat.whatsapp.com/grupo-sem-protocolo' },
    couponCta: '🎟 Cupons da {loja}:',
    couponLinks: { shopee: 'cupom.test/shopee' },
    selectedCouponStores: ['shopee'],
    offerStoreKey: 'shopee',
  })

  assert.doesNotMatch(text, /grupo-sem-protocolo/)
  assert.doesNotMatch(text, /cupom\.test/)
})

test('cupom usa apenas o link da loja correspondente à oferta', () => {
  const text = buildMobileOfferText({
    product: { title: 'Produto', price: 'R$ 39,90', platform: 'amazon' },
    link: 'https://amazon.com.br/produto',
    bonusMode: 'coupons',
    couponCta: '🎟 Cupons da {loja}:',
    couponLinks: {
      shopee: 'https://cupom.test/shopee',
      amazon: 'https://cupom.test/amazon',
    },
    selectedCouponStores: ['shopee', 'amazon'],
    offerStoreKey: 'amazon',
  })

  assert.match(text, /🎟 Cupons da Amazon:\nhttps:\/\/cupom\.test\/amazon/)
  assert.doesNotMatch(text, /cupom\.test\/shopee/)
})

test('detecta loja da oferta por dados do scrape, conversão ou hostname', () => {
  assert.equal(detectMobileOfferStoreKey({ product: { conversion: { platform: 'mercadolivre' } }, link: '' }), 'mercadolivre')
  assert.equal(detectMobileOfferStoreKey({ product: { platform: 'amazon' }, link: '' }), 'amazon')
  assert.equal(detectMobileOfferStoreKey({ product: {}, link: 'https://www.magazineluiza.com.br/produto' }), 'magazineluiza')
})
