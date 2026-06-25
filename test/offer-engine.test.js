import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapedOffer } from '../src/converters/offerEngine.js'

// Credenciais mínimas que passam em validateCredentialData para cada loja.
const amazonCreds = {
  amazon: { tag: 'botinho-20', 'ubid-acbbr': 'ubid-cookie-value', 'at-acbbr': 'at-cookie-value', 'x-acbbr': 'x-cookie-value' },
}
const mlCreds = { mercadolivre: { tag: 'botinho', ssid: 'ssid-value', csrf: 'csrf-value' } }

test('buildScrapedOffer: painel usa link convertido como displayUrl (keepOriginalLink=false)', async () => {
  const original = 'https://www.amazon.com.br/dp/B09VQ39F41'
  const converted = 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20'

  const offer = await buildScrapedOffer({
    url: original,
    credentialsMap: amazonCreds,
    keepOriginalLink: false,
    convertLink: async () => ({ url: converted }),
    fetchProductInfo: async (url) => ({ title: 'Mixer', oldPrice: '199', newPrice: '149', finalUrl: url }),
  })

  assert.equal(offer.offerUrl, converted)
  assert.equal(offer.displayUrl, converted)
  assert.equal(offer.title, 'Mixer')
  assert.equal(offer.newPrice, '149')
  assert.equal(offer.conversion.success, true)
})

test('buildScrapedOffer: busca pelo convertido mas devolve link original (keepOriginalLink=true)', async () => {
  const original = 'https://www.amazon.com.br/dp/B09VQ39F41'
  const converted = 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20'
  const scraped = []

  const offer = await buildScrapedOffer({
    url: original,
    credentialsMap: amazonCreds,
    keepOriginalLink: true,
    convertLink: async () => ({ url: converted }),
    fetchProductInfo: async (url) => {
      scraped.push(url)
      return { title: 'Mixer', oldPrice: '199', newPrice: '149', finalUrl: url }
    },
  })

  // Buscou os dados pelo link CONVERTIDO (ganha cookie/afiliado)...
  assert.deepEqual(scraped, [converted])
  // ...mas o link mostrado ao usuário é o ORIGINAL colado.
  assert.equal(offer.displayUrl, original)
  assert.equal(offer.offerUrl, converted)
  assert.equal(offer.title, 'Mixer')
  assert.equal(offer.newPrice, '149')
})

test('buildScrapedOffer: sem credenciais não converte e scrapa o link cru', async () => {
  const original = 'https://www.amazon.com.br/dp/B09VQ39F41'
  let converterCalls = 0
  const scraped = []

  const offer = await buildScrapedOffer({
    url: original,
    credentialsMap: {},
    keepOriginalLink: true,
    convertLink: async () => { converterCalls += 1; return { url: 'nao-deveria' } },
    fetchProductInfo: async (url) => { scraped.push(url); return { title: 'Mixer', newPrice: '149', finalUrl: url } },
  })

  assert.equal(converterCalls, 0)
  assert.deepEqual(scraped, [original])
  assert.equal(offer.offerUrl, original)
  assert.equal(offer.displayUrl, original)
  assert.equal(offer.conversion.success, false)
  assert.equal(offer.conversion.reasonCode, 'MISSING_CREDENTIALS')
})

test('buildScrapedOffer: completa preço pelo original quando convertido traz só título', async () => {
  const original = 'https://www.amazon.com.br/Mixer/dp/B09VQ39F41'
  const converted = 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20'
  const scraped = []

  const offer = await buildScrapedOffer({
    url: original,
    credentialsMap: amazonCreds,
    keepOriginalLink: true,
    convertLink: async () => ({ url: converted }),
    fetchProductInfo: async (url) => {
      scraped.push(url)
      if (url === converted) return { title: 'Mixer Turbo', oldPrice: '', newPrice: '', finalUrl: converted }
      return { title: 'Mixer Original', oldPrice: '199', newPrice: '149', finalUrl: original }
    },
  })

  assert.deepEqual(scraped, [converted, original])
  assert.equal(offer.title, 'Mixer Turbo')
  assert.equal(offer.newPrice, '149')
  assert.equal(offer.oldPrice, '199')
  // Mesmo no fallback de dados, keepOriginalLink mantém o link original.
  assert.equal(offer.displayUrl, original)
})

test('buildScrapedOffer: scraper lançando degrada para fallback mínimo sem propagar erro', async () => {
  const original = 'https://www.amazon.com.br/Creme-de-Pentear-Lola/dp/B074LVYZDJ'

  const offer = await buildScrapedOffer({
    url: original,
    credentialsMap: {},
    keepOriginalLink: true,
    fetchProductInfo: async () => { throw new Error('anti-bot') },
  })

  // Não lança; infere título do slug da URL.
  assert.equal(offer.title, 'Creme de Pentear Lola')
  assert.equal(offer.newPrice, '')
  assert.equal(offer.displayUrl, original)
  assert.equal(offer.scrapeWarning.code, 'SCRAPE_OFFER_FETCH_FAILED')
})

test('buildScrapedOffer: propaga conversionWarning do conversor', async () => {
  const offer = await buildScrapedOffer({
    url: 'https://www.mercadolivre.com.br/p/MLB123',
    credentialsMap: mlCreds,
    keepOriginalLink: false,
    convertLink: async () => ({ url: 'https://produto.mercadolivre.com.br/MLB123-x-_JM?partner_id=botinho', warning: 'ml_ssid_expired' }),
    fetchProductInfo: async (url) => ({ title: 'Produto ML', newPrice: '99,90', finalUrl: url }),
  })

  assert.equal(offer.conversionWarning, 'ml_ssid_expired')
  assert.equal(offer.conversion.success, true)
})

test('buildScrapedOffer: keepOriginalLink substitui partner_id de terceiro pelo tag do usuário', async () => {
  const url = 'https://www.mercadolivre.com.br/social/xetdaspromocoes?partner_id=475630078'
  const converted = 'https://produto.mercadolivre.com.br/MLB123-x-_JM?partner_id=botinho'

  const offer = await buildScrapedOffer({
    url,
    credentialsMap: mlCreds,
    keepOriginalLink: true,
    convertLink: async () => ({ url: converted }),
    fetchProductInfo: async (u) => ({ title: 'Top Selene', newPrice: '35', finalUrl: u }),
  })

  assert.equal(offer.displayUrl, 'https://www.mercadolivre.com.br/social/xetdaspromocoes?partner_id=botinho')
  assert.notEqual(offer.displayUrl, url, 'partner_id de terceiro não deve aparecer na oferta')
})

test('buildScrapedOffer: keepOriginalLink mantém link sem partner_id intacto', async () => {
  const url = 'https://www.mercadolivre.com.br/social/xetdaspromocoes'

  const offer = await buildScrapedOffer({
    url,
    credentialsMap: mlCreds,
    keepOriginalLink: true,
    convertLink: async () => ({ url: 'https://produto.mercadolivre.com.br/MLB123-x-_JM?partner_id=botinho' }),
    fetchProductInfo: async (u) => ({ title: 'Top Selene', newPrice: '35', finalUrl: u }),
  })

  assert.equal(offer.displayUrl, url)
})

test('buildScrapedOffer: keepOriginalLink sem credenciais mantém link original intacto', async () => {
  const url = 'https://www.mercadolivre.com.br/social/xetdaspromocoes?partner_id=475630078'

  const offer = await buildScrapedOffer({
    url,
    credentialsMap: {},
    keepOriginalLink: true,
    fetchProductInfo: async (u) => ({ title: 'Top Selene', newPrice: '35', finalUrl: u }),
  })

  assert.equal(offer.displayUrl, url)
})
