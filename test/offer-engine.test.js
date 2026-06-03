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

test('buildScrapedOffer: Telegram busca pelo ORIGINAL (um hit) e devolve o link original', async () => {
  const original = 'https://www.amazon.com.br/dp/B09VQ39F41'
  let converterCalls = 0
  const scraped = []

  const offer = await buildScrapedOffer({
    url: original,
    credentialsMap: amazonCreds,
    keepOriginalLink: true,
    convertLink: async () => { converterCalls += 1; return { url: original + '?tag=botinho-20' } },
    fetchProductInfo: async (url) => {
      scraped.push(url)
      return { title: 'Mixer', oldPrice: '199', newPrice: '149', finalUrl: url }
    },
  })

  // Telegram: o original já trouxe preço → NÃO converte (evita 2º hit na loja).
  assert.equal(converterCalls, 0)
  assert.deepEqual(scraped, [original])
  assert.equal(offer.displayUrl, original)
  assert.equal(offer.offerUrl, original)
  assert.equal(offer.title, 'Mixer')
  assert.equal(offer.newPrice, '149')
})

test('buildScrapedOffer: sem credenciais não converte e scrapa o link original', async () => {
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
})

test('buildScrapedOffer: Telegram converte como FALLBACK quando o original não traz preço', async () => {
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
      // original: título sem preço → dispara conversão+scrape do convertido
      if (url === original) return { title: 'Mixer Original', oldPrice: '', newPrice: '', finalUrl: original }
      return { title: 'Mixer Turbo', oldPrice: '199', newPrice: '149', finalUrl: converted }
    },
  })

  // Ordem: original primeiro; só então o convertido (fallback de dados).
  assert.deepEqual(scraped, [original, converted])
  // Mantém título do original e completa o preço do convertido.
  assert.equal(offer.title, 'Mixer Original')
  assert.equal(offer.newPrice, '149')
  assert.equal(offer.oldPrice, '199')
  // Telegram mantém o link original na oferta, mesmo tendo convertido p/ dados.
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
