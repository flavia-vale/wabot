import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapedOffer } from '../src/converters/offerEngine.js'
import { fetchProductInfo as realFetchProductInfo } from '../src/converters/productInfoScraper.js'

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

// ── T029 (005-ml-cookie-expiry, Phase 7 — achado de review) ─────────────────
//
// Cobre o caminho de PRODUÇÃO de ponta a ponta: buildScrapedOffer -> o
// próprio `fetchProductInfo` real (não um stub) -> fetchMercadoLivreItemInfo
// -> getMlUserToken, a partir de um `credentialsMap` com `__onCredentialPatch`
// anexado exatamente como `attachCredentialPatchHandler` (linkConversion.js)
// e o loadConfig do bot-worker fazem (Object.defineProperty não-enumerável no
// MAP inteiro, não na credencial mercadolivre isolada). Isso é deliberado:
// os testes de T006 (test/product-info-scraper.test.js) anexam o gancho
// manualmente ao objeto `mlCredentials` que passam direto para
// `getMlUserToken`/`fetchProductInfo`, o que NUNCA exercita a extração
// `credentialsMap.mercadolivre` de `offerEngine.js` que descartava a
// propriedade não-enumerável em produção (o bug de T028). Este teste FALHA
// sem o fix de T028 porque, sem o merge do gancho na extração, o
// `mlCredentials` que chega em `fetchMercadoLivreItemInfo` não tem
// `__onCredentialPatch` e `patched` nunca é preenchido.
test('T029: buildScrapedOffer com fetchProductInfo REAL persiste o refresh_token OAuth rotacionado via __onCredentialPatch (caminho real de produção)', async (t) => {
  const prevEnv = { ML_CLIENT_ID: process.env.ML_CLIENT_ID, ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET }
  process.env.ML_CLIENT_ID = 'client-id-test'
  process.env.ML_CLIENT_SECRET = 'client-secret-test'
  t.after(() => {
    process.env.ML_CLIENT_ID = prevEnv.ML_CLIENT_ID
    process.env.ML_CLIENT_SECRET = prevEnv.ML_CLIENT_SECRET
  })

  const url = 'https://www.mercadolivre.com.br/liquidificador-arno/MLB999888777'

  // credentialsMap montado como em produção: credencial ML "crua" (o que
  // sairia de `parseCredentialData`/`decryptCredential`) + access token OAuth
  // JÁ EXPIRADO (força o refresh) + refresh_token antigo (single-use).
  const credentialsMap = {
    mercadolivre: {
      tag: 'botinho',
      ssid: 'x'.repeat(20),
      oauthAccessToken: 'old-access-token',
      oauthTokenExpiry: Date.now() - 60_000,
      oauthRefreshToken: 'old-refresh-token',
    },
  }

  let patched = null
  // Mesmo padrão de `attachCredentialPatchHandler` (src/api/routes/linkConversion.js)
  // e de `loadConfig` (src/bot-worker.js): a prop é anexada ao MAP inteiro,
  // não a `credentialsMap.mercadolivre` isoladamente — é exatamente essa
  // distinção que a extração de `offerEngine.js` precisa preservar.
  Object.defineProperty(credentialsMap, '__onCredentialPatch', {
    enumerable: false,
    value: async (platform, patch) => { patched = { platform, patch } },
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const requestUrl = String(input)
    if (requestUrl.includes('api.mercadolibre.com/oauth/token')) {
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 21600,
        }),
      }
    }
    if (requestUrl.includes('api.mercadolibre.com/items/')) {
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ title: 'Liquidificador Arno', price: 149.9 }),
      }
    }
    if (requestUrl.includes('api.mercadolibre.com/products/')) {
      return { ok: false, headers: { get: () => null } }
    }
    // Fetch de HTML da própria página do produto: sem título/preço úteis,
    // para forçar o fallback via API de item (fetchMercadoLivreItemInfo).
    return {
      ok: true,
      url: requestUrl,
      headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'text/html' : null) },
      body: null,
      text: async () => '<!doctype html><html><head><title>Mercado Livre</title></head><body></body></html>',
    }
  }
  t.after(() => { globalThis.fetch = originalFetch })

  await buildScrapedOffer({
    url,
    credentialsMap,
    keepOriginalLink: true,
    convertLink: async () => ({ url }),
    fetchProductInfo: realFetchProductInfo,
  })

  assert.ok(patched, '__onCredentialPatch deveria ter sido invocado com o refresh_token novo — sem o fix de T028 o gancho some na extração de offerEngine.js e o refresh_token rotacionado é descartado')
  assert.equal(patched.platform, 'mercadolivre')
  assert.equal(patched.patch.oauthRefreshToken, 'new-refresh-token')
  assert.notEqual(patched.patch.oauthRefreshToken, 'old-refresh-token')
  assert.equal(patched.patch.oauthAccessToken, 'new-access-token')
})
