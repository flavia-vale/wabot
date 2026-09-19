import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TEMPLATE_OPTIONS,
  OFFER_TEMPLATE_VARIABLE_GROUPS,
  OFFER_TEMPLATE_VARIABLES,
  buildMobileOfferText,
  countMobileOfferHttpLinks,
  detectMobileOfferStoreKey,
  getMobileOfferSingleLinkWarning,
  normalizeMobileOfferProduct,
  COUPON_STORES,
  applyTemplateVariables,
} from '../dashboard/lib/mobileOfferComposer.js'
import {
  PRESET_TEMPLATE_BODIES,
  composeTemplates,
  withNewCustomTemplate,
  withPresetBody,
  withUpdatedCustomTemplate,
} from '../dashboard/lib/mobileTemplateStore.js'

test('normaliza preço raspado quando a API retorna newPrice em vez de price', () => {
  const product = normalizeMobileOfferProduct({ title: 'Tênis leve', newPrice: 'R$ 129,90', oldPrice: 'R$ 199,90' })

  assert.deepEqual(product, {
    title: 'Tênis leve',
    price: 'R$ 129,90',
    oldPrice: 'R$ 199,90',
  })
})


test('lista apenas os presets Automático clássico e Simples', () => {
  assert.deepEqual(TEMPLATE_OPTIONS.map((template) => template.key), ['automatico_classico', 'simples'])
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


test('templates com campos globais não vazam placeholders no Gerar oferta manual', () => {
  const text = buildMobileOfferText({
    product: { title: 'Produto manual', price: 'R$ 49,90' },
    link: 'https://afiliado.test/manual',
    template: 'simples',
    templateBody: PRESET_TEMPLATE_BODIES.simples,
  })

  assert.doesNotMatch(text, /\{\{gancho\}\}|\{\{cta\}\}|\{\{convitegrupo\}\}/)
  assert.match(text, /Produto manual/)
  assert.match(text, /https:\/\/afiliado\.test\/manual/)
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

// specs/012-shein-store-support (D6/D7/T058)
test('detecta SHEIN por platform explícito e por hostname', () => {
  assert.equal(detectMobileOfferStoreKey({ product: { platform: 'shein' }, link: '' }), 'shein')
  assert.equal(detectMobileOfferStoreKey({ product: {}, link: 'https://br.shein.com/vestido-p-123.html' }), 'shein')
  assert.equal(detectMobileOfferStoreKey({ product: {}, link: 'https://onelink.shein.com/14/abc' }), 'shein')
})

test('COUPON_STORES inclui a SHEIN', () => {
  const shein = COUPON_STORES.find((s) => s.key === 'shein')
  assert.ok(shein)
  assert.equal(shein.nome, 'SHEIN')
})



test('store de templates canonicaliza variáveis históricas ao carregar e editar', () => {
  const legacyBody = '{{' + 'greeting}} oferta {{' + 'trailer}}'
  const canonicalBody = '{{gancho}} oferta {{convitegrupo}}'
  const loaded = composeTemplates({
    overrides: { simples: legacyBody },
    custom: [{ key: 'tpl_1', name: 'Legado', body: legacyBody }],
  })

  assert.equal(loaded.find((template) => template.key === 'simples').body, canonicalBody)
  assert.equal(loaded.find((template) => template.key === 'tpl_1').body, canonicalBody)
  assert.equal(withPresetBody({}, 'simples', legacyBody).overrides.simples, canonicalBody)

  const created = withNewCustomTemplate({}, { name: 'Novo', body: legacyBody })
  assert.equal(created.store.custom[0].body, canonicalBody)
  assert.equal(
    withUpdatedCustomTemplate(created.store, created.key, { name: 'Editado', body: legacyBody }).custom[0].body,
    canonicalBody,
  )
})

test('preset Automático clássico mostra onde gancho, CTA e convite do grupo entram na copy', () => {
  assert.equal(PRESET_TEMPLATE_BODIES.automatico_classico, [
    '{{gancho}}',
    '',
    '🏷️ *{produto}*',
    '',
    '💰 ~{preço_de}~ → *{preço}* (*{desconto}*)',
    '{rating} | {vendas}',
    '',
    '{{cta}}',
    '👉 {link}',
    '',
    '{{convitegrupo}}',
  ].join('\n'))
})

test('template Automático clássico preenche desconto, rating e vendas', () => {
  const text = buildMobileOfferText({
    product: {
      title: 'Liquidificador turbo',
      price: 'R$ 89,90',
      oldPrice: 'R$ 129,90',
      discount: '-31% OFF',
      rating: '⭐ 4.8',
      sales: '🛒 1.200+ vendidos',
      storeName: 'Shopee',
    },
    link: 'https://shope.ee/abc',
    template: 'automatico_classico',
    templateBody: PRESET_TEMPLATE_BODIES.automatico_classico,
  })

  assert.match(text, /🏷️ \*Liquidificador turbo\*/)
  assert.match(text, /💰 ~R\$ 129,90~ → \*R\$ 89,90\* \(\*-31% OFF\*\)/)
  assert.match(text, /⭐ 4\.8 \| 🛒 1\.200\+ vendidos/)
  assert.match(text, /👉 https:\/\/shope\.ee\/abc/)
  assert.doesNotMatch(text, /\{produto\}|\{preço\}|\{preço_de\}|\{desconto\}|\{rating\}|\{vendas\}|\{link\}/)
})

test('template remove linha de metadata vazia quando rating e vendas faltam', () => {
  const text = buildMobileOfferText({
    product: {
      title: 'Produto simples',
      price: 'R$ 39,90',
      oldPrice: '',
      discount: '',
      rating: '',
      sales: '',
    },
    link: 'https://shope.ee/sem-meta',
    template: 'automatico_classico',
    templateBody: PRESET_TEMPLATE_BODIES.automatico_classico,
  })

  assert.match(text, /🏷️ \*Produto simples\*/)
  assert.match(text, /💰 \*R\$ 39,90\*/)
  assert.doesNotMatch(text, /^\s*\|\s*$/m)
  assert.doesNotMatch(text, /vendidos/)
  assert.doesNotMatch(text, /⭐/)
})


test('variáveis de template incluem dados da oferta e automação', () => {
  const tokens = OFFER_TEMPLATE_VARIABLES.map((variable) => variable.token)
  assert.ok(OFFER_TEMPLATE_VARIABLE_GROUPS.some((group) => group.key === 'offer'))
  assert.ok(OFFER_TEMPLATE_VARIABLE_GROUPS.some((group) => group.key === 'automation'))
  for (const token of ['{produto}', '{preço}', '{preço_de}', '{desconto}', '{rating}', '{vendas}', '{link}', '{loja}', '{linhaDeCupom}', '{preçoDoTexto}', '{cupom}', '{{gancho}}', '{{cta}}', '{{convitegrupo}}', '{{grupoLink}}', '{{cupomLink}}']) {
    assert.ok(tokens.includes(token), `variável ausente: ${token}`)
  }
})

// specs/017-client-coupon-catalog (T022, FR-016): {cupom} aparece na lista com
// rótulo e exemplo em português — a resolução em si acontece só no envio
// (bot-worker.js), então applyTemplateVariables/buildMobileOfferText devem
// preservar o token intacto (nunca substituí-lo aqui).
test('{cupom} tem rótulo e exemplo em português na lista de variáveis (FR-016)', () => {
  const variable = OFFER_TEMPLATE_VARIABLES.find((v) => v.token === '{cupom}')
  assert.ok(variable, '{cupom} precisa estar na lista de variáveis')
  assert.equal(typeof variable.label, 'string')
  assert.ok(variable.label.length > 0)
  assert.doesNotMatch(variable.label, /\{|\}/, 'rótulo não pode conter chaves de template')
  assert.equal(typeof variable.example, 'string')
  assert.match(variable.example, /cupom/i)
})

test('{cupom} sobrevive intacto a applyTemplateVariables (resolvido só no envio)', () => {
  const result = applyTemplateVariables('Oferta: {produto}\n{cupom}\n{link}', {
    title: 'Produto X',
    link: 'https://loja.test/produto',
  })
  assert.match(result, /\{cupom\}/, 'applyTemplateVariables não deve resolver {cupom} — isso acontece só no envio')
})

test('{cupom} sobrevive a buildMobileOfferText sem virar linha vazia/emoji solto/asterisco órfão', () => {
  const text = buildMobileOfferText({
    product: { title: 'Produto X' },
    link: 'https://loja.test/produto',
    templateBody: '🏷️ {produto}\n{cupom}\n👉 {link}',
  })
  assert.match(text, /\{cupom\}/)
  assert.doesNotMatch(text, /\(\s*\)/)
  assert.doesNotMatch(text, /\*\s*\*/)
  assert.doesNotMatch(text, /\n{3,}/)
})
