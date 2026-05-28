import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TEMPLATE_OPTIONS,
  buildMobileOfferText,
  normalizeMobileOfferProduct,
} from '../dashboard/lib/mobileOfferComposer.js'

test('normaliza preço raspado quando a API retorna newPrice em vez de price', () => {
  const product = normalizeMobileOfferProduct({ title: 'Tênis leve', newPrice: 'R$ 129,90', oldPrice: 'R$ 199,90' })

  assert.deepEqual(product, {
    title: 'Tênis leve',
    price: 'R$ 129,90',
    oldPrice: 'R$ 199,90',
  })
})

test('todos os templates preveem lugar para preço quando produto ainda não tem preço', () => {
  for (const template of TEMPLATE_OPTIONS) {
    assert.match(template.preview, /R\$/i, `preview sem preço: ${template.key}`)
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
  })

  assert.match(withLinks, /💜 Entre no grupo:\nhttps:\/\/chat\.whatsapp\.com\/grupo/)
  assert.match(withLinks, /🎟 Cupons da Shopee:\nhttps:\/\/cupom\.test\/shopee/)
})
