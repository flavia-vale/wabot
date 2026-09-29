// Link rastreado no texto da oferta (src/core/trackedLinks.js).
// Garante: desligado = texto idêntico ao de hoje; ligado = só link convertido
// de loja vira shortlink, com o link de afiliado preservado byte a byte; a
// trava do espelhamento continua valendo; o card continua no link real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  applyTrackedLinks,
  anchorFor,
  isTrackableAffiliateUrl,
  normalizeShortlinkBaseUrl,
  resolveTrackedLinkSettings,
  MAX_TRACKED_LINKS_PER_MESSAGE,
} from '../../src/core/trackedLinks.js'
import { findUnconvertedStoreLinks } from '../../src/core/mirrorLinkGuard.js'

const AMAZON = 'https://www.amazon.com.br/dp/B0CX123456?tag=cliente-20&linkCode=ogi&th=1&psc=1'
const SHOPEE = 'https://s.shopee.com.br/7AbCdEfGh'
const ML = 'https://meli.la/2xYz9Ab'

function fakeCreateLink() {
  const calls = []
  let n = 0
  const createLink = async (url) => {
    calls.push(url)
    n += 1
    return { shortUrl: `https://espelhagrupos.com.br/r/hash000${n}` }
  }
  return { calls, createLink }
}

// ---------- configuração (padrão desligado) ----------

test('resolveTrackedLinkSettings: desligado por padrão e em qualquer peça faltando', () => {
  const base = 'https://espelhagrupos.com.br'
  assert.equal(resolveTrackedLinkSettings().enabled, false)
  assert.equal(resolveTrackedLinkSettings({ botConfig: {}, planAllows: true, baseUrl: base }).reason, 'flag_off')
  assert.equal(resolveTrackedLinkSettings({ botConfig: { clickTrackingEnabled: 'true' }, planAllows: true, baseUrl: base }).enabled, false)
  assert.equal(resolveTrackedLinkSettings({ botConfig: { clickTrackingEnabled: true }, planAllows: false, baseUrl: base }).reason, 'plan')
  assert.equal(resolveTrackedLinkSettings({ botConfig: { clickTrackingEnabled: true }, planAllows: true, baseUrl: '' }).reason, 'no_base_url')
  assert.equal(resolveTrackedLinkSettings({ botConfig: { clickTrackingEnabled: true }, planAllows: true, baseUrl: 'ftp://x.com' }).reason, 'no_base_url')
  const on = resolveTrackedLinkSettings({ botConfig: { clickTrackingEnabled: true }, planAllows: true, baseUrl: `${base}/` })
  assert.deepEqual(on, { enabled: true, baseUrl: base, reason: null })
})

test('normalizeShortlinkBaseUrl aceita http(s) sem query e tira a barra final', () => {
  assert.equal(normalizeShortlinkBaseUrl('http://178.105.54.0:3006/'), 'http://178.105.54.0:3006')
  assert.equal(normalizeShortlinkBaseUrl('https://espelhagrupos.com.br'), 'https://espelhagrupos.com.br')
  assert.equal(normalizeShortlinkBaseUrl('https://x.com/?a=1'), '')
  assert.equal(normalizeShortlinkBaseUrl('javascript:alert(1)'), '')
  assert.equal(normalizeShortlinkBaseUrl(undefined), '')
})

test('isTrackableAffiliateUrl: só loja oficial, host ancorado, público', () => {
  for (const url of [AMAZON, SHOPEE, ML, 'https://amzn.to/3abc', 'https://s.click.aliexpress.com/e/_abc', 'https://onelink.shein.com/1/abc', 'https://www.magazinevoce.com.br/magazinecliente/p/123']) {
    assert.equal(isTrackableAffiliateUrl(url), true, url)
  }
  for (const url of ['https://example.com/x', 'https://amazon.com.br.evil.net/dp/1', 'https://amzn.divulgador.link/abc', 'http://127.0.0.1/x', 'javascript:alert(1)', 'https://user:pw@amzn.to/x', '', null]) {
    assert.equal(isTrackableAffiliateUrl(url), false, String(url))
  }
})

// ---------- desligado = byte a byte igual a hoje ----------

test('desligado: devolve o MESMO texto e não cria link nenhum', async () => {
  const { calls, createLink } = fakeCreateLink()
  const text = `🔥 Oferta\n${AMAZON}\nCupom: ${SHOPEE}`
  const conversions = [{ platform: 'amazon', url: 'https://amzn.to/concorrente', converted: AMAZON }, { platform: 'shopee', url: 'x', converted: SHOPEE }]
  for (const opts of [{ enabled: false, createLink }, {}, undefined]) {
    const out = await applyTrackedLinks(text, conversions, opts)
    assert.equal(out.text, text)
    assert.equal(out.anchors.size, 0)
  }
  assert.equal(calls.length, 0)
  assert.equal(anchorFor(new Map(), AMAZON), undefined)
})

// ---------- ligado ----------

test('ligado: troca só os links convertidos e guarda o link de afiliado exato', async () => {
  const { calls, createLink } = fakeCreateLink()
  const text = `*Fone* por R$ 99\n👉 ${AMAZON}\n\nCupom: ${SHOPEE}.`
  const conversions = [
    { platform: 'amazon', url: 'https://amzn.to/concorrente', converted: AMAZON },
    { platform: 'shopee', url: 'https://s.shopee.com.br/concorrente', converted: SHOPEE },
  ]
  const out = await applyTrackedLinks(text, conversions, { enabled: true, createLink })
  // o shortlink guarda o link convertido SEM nenhuma alteração
  assert.deepEqual(new Set(calls), new Set([AMAZON, SHOPEE]))
  assert.equal(out.text.includes(AMAZON), false)
  assert.equal(out.text.includes(SHOPEE), false)
  assert.equal(out.text.includes(out.anchors.get(AMAZON)), true)
  // pontuação depois do link fica no lugar
  assert.equal(out.text.endsWith(`${out.anchors.get(SHOPEE)}.`), true)
  // o resto do texto não muda
  assert.equal(out.text.replace(out.anchors.get(AMAZON), AMAZON).replace(out.anchors.get(SHOPEE), SHOPEE), text)
  assert.equal(anchorFor(out.anchors, AMAZON), out.anchors.get(AMAZON))
})

test('ligado: nunca troca passthrough, link de fora de loja ou link que não está no texto', async () => {
  const { calls, createLink } = fakeCreateLink()
  const text = `Veja ${AMAZON} e https://example.com/x`
  const conversions = [
    { platform: 'amazon', url: AMAZON, converted: AMAZON, passthrough: true },
    { platform: 'nolink', converted: 'https://example.com/x' },
    { platform: 'mercadolivre', converted: ML }, // não aparece no texto
  ]
  const out = await applyTrackedLinks(text, conversions, { enabled: true, createLink })
  assert.equal(out.text, text)
  assert.equal(calls.length, 0)
})

test('ligado: link que é prefixo de outro não corrompe o maior', async () => {
  const { createLink } = fakeCreateLink()
  const curto = 'https://amzn.to/abc'
  const longo = 'https://amzn.to/abcd'
  const text = `A ${longo}\nB ${curto}`
  const out = await applyTrackedLinks(text, [{ converted: curto }, { converted: longo }], { enabled: true, createLink })
  const lines = out.text.split('\n')
  assert.equal(lines[0], `A ${out.anchors.get(longo)}`)
  assert.equal(lines[1], `B ${out.anchors.get(curto)}`)
})

test('ligado: falha ao criar o shortlink = aquele link sai direto (oferta não cai)', async () => {
  const erros = []
  const createLink = async (url) => {
    if (url === AMAZON) throw new Error('db fora')
    return { shortUrl: 'https://espelhagrupos.com.br/r/okokokok' }
  }
  const text = `${AMAZON}\n${SHOPEE}`
  const out = await applyTrackedLinks(text, [{ converted: AMAZON }, { converted: SHOPEE }], {
    enabled: true, createLink, onError: (err, url) => erros.push([err.message, url]),
  })
  assert.equal(out.text, `${AMAZON}\nhttps://espelhagrupos.com.br/r/okokokok`)
  assert.deepEqual(erros, [['db fora', AMAZON]])
  assert.equal(out.anchors.has(AMAZON), false)

  const tudoFalha = await applyTrackedLinks(text, [{ converted: AMAZON }], { enabled: true, createLink: async () => { throw new Error('x') } })
  assert.equal(tudoFalha.text, text)
  const semHttp = await applyTrackedLinks(text, [{ converted: AMAZON }], { enabled: true, createLink: async () => ({ shortUrl: '/r/relativo' }) })
  assert.equal(semHttp.text, text)
})

test('ligado: teto de links por mensagem', async () => {
  const { calls, createLink } = fakeCreateLink()
  const urls = Array.from({ length: MAX_TRACKED_LINKS_PER_MESSAGE + 3 }, (_, i) => `https://amzn.to/link${i}x`)
  await applyTrackedLinks(urls.join('\n'), urls.map(converted => ({ converted })), { enabled: true, createLink })
  assert.equal(calls.length, MAX_TRACKED_LINKS_PER_MESSAGE)
})

// ---------- trava do espelhamento continua valendo ----------

test('trava do espelhamento: link do concorrente que sobrou no texto NÃO é embrulhado e continua sendo pego', async () => {
  const { createLink } = fakeCreateLink()
  const concorrente = 'https://s.shopee.com.br/concorrente1'
  const text = `${AMAZON}\n${concorrente}`
  const conversions = [{ platform: 'amazon', url: 'https://amzn.to/x', converted: AMAZON }]
  const out = await applyTrackedLinks(text, conversions, { enabled: true, createLink })
  // o link do concorrente fica visível (nunca escondido atrás do nosso shortlink)
  assert.equal(out.text.includes(concorrente), true)
  assert.deepEqual(findUnconvertedStoreLinks(out.text, conversions), [concorrente])
})

test('trava do espelhamento: texto aprovado pela trava continua aprovado depois da troca', async () => {
  const { createLink } = fakeCreateLink()
  const text = `Oferta ${AMAZON}`
  const conversions = [{ platform: 'amazon', url: 'https://amzn.to/concorrente', converted: AMAZON }]
  assert.deepEqual(findUnconvertedStoreLinks(text, conversions), [])
  const out = await applyTrackedLinks(text, conversions, { enabled: true, createLink })
  assert.deepEqual(findUnconvertedStoreLinks(out.text, conversions), [])
  assert.equal(out.text.includes('concorrente'), false)
})

// ---------- fiação no robô (src/bot-worker.js) ----------

const worker = readFileSync(new URL('../../src/bot-worker.js', import.meta.url), 'utf8')

test('robô: troca acontece DEPOIS da trava do espelhamento, no buildPayload do envio', () => {
  const trava = worker.indexOf('const leakedLinks = findUnconvertedStoreLinks(finalText, conversions')
  const troca = worker.indexOf('const tracked = await trackLinksForSend({ text: variantText, conversions, destJid, messageLogId: log.id, settings: cfg.trackedLinks })')
  assert.ok(trava > 0 && troca > trava, 'trackLinksForSend precisa rodar depois da trava')
  // todo o payload do espelhamento usa o texto já com (ou sem) rastreio
  const bloco = worker.slice(troca, worker.indexOf("type: 'converted',", troca))
  assert.equal(/\bvariantText\b/.test(bloco.slice(bloco.indexOf('\n'))), false, 'nenhum ramo do payload pode usar variantText cru')
  assert.equal((bloco.match(/anchorUrl: primaryAnchor/g) || []).length, 2, 'os dois cards recebem a âncora')
})

test('robô: desligado não toca no banco e devolve o mesmo texto', () => {
  const fn = worker.slice(worker.indexOf('async function trackLinksForSend('), worker.indexOf('async function buildManualLinkPreview('))
  assert.match(fn, /const semRastreio = \{ text, anchors: new Map\(\) \}\n  if \(!settings\?\.enabled\) return semRastreio/)
})

test('robô: card usa o link REAL para foto/título; shortlink só como âncora de texto', () => {
  const fn = worker.slice(worker.indexOf('async function buildManualLinkPreview('), worker.indexOf('const STORE_PREVIEW_TITLES'))
  assert.match(fn, /const matchedText = isHttpUrl\(anchorUrl\) \? anchorUrl : realUrl/)
  assert.match(fn, /const sourceUrl = isHttpUrl\(primary\?\.url\) \? primary\.url : realUrl/)
  assert.match(fn, /resolvedUrl: primary\?\.converted \|\| primary\?\.url/)
  assert.match(fn, /title: storePreviewTitle\(primary\?\.platform, realUrl, useCouponBrandCard\)/)
  assert.match(fn, /'matched-text': matchedText/)
  // o shortlink nunca é buscado pelo card (senão o robô contaria clique)
  assert.equal(/fetch\w*\([^)]*anchorUrl/.test(fn), false)
})

test('robô: plano PRO/Trial + flag + SHORTLINK_BASE_URL decidem na carga da config', () => {
  assert.match(worker, /resolveTrackedLinkSettings\(\{\n\s+botConfig,\n\s+planAllows: Boolean\(preservation\?\.active\),\n\s+baseUrl: process\.env\.SHORTLINK_BASE_URL,/)
})
