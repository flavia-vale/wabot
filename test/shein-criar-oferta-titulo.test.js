// RCA 2026-09-30 (conta promosdaella): "Criar oferta" com oneLink da SHEIN
// vinha sem nome. A SHEIN responde captcha (`/risk/challenge`) para IP de
// servidor; a página do captcha tem <title> próprio ("SHEIN.com is mainly
// design and produce…") que passava pelo filtro de títulos genéricos, vazava
// como nome e, por ser truthy, impedia o fallback pelo link original — o
// oneLink serve og:title com o nome real, sem captcha.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchProductInfo } from '../src/converters/productInfoScraper.js'
import { SHEIN_SEM_PRECO_TITULO, SHEIN_SEM_PRECO_TEXTO, SHEIN_SEM_NOME, SHEIN_SEM_NOME_E_PRECO } from '../dashboard/lib/painel/criarOfertaCopy.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const CAPTCHA_HTML = '<html><head><title>SHEIN.com is mainly design and produce fashion clothing for women all over the world for about 5 years.</title><meta property="og:title" content="SHEIN.com is mainly design and produce fashion clothing for women all over the world for about 5 years."/></head><body>captcha</body></html>'
const ONELINK_HTML = '<html><head><title>SHEIN Glamour Top Feminina Casual Estilo Street</title><meta property="og:title" content="SHEIN Glamour Top Feminina Casual Estilo Street"/><meta property="og:image" content="https://img.ltwebstatic.com/x.jpg"/></head><body><input id="url" value="https://m.shein.com/br/ark/default?goods_id=529469487"/></body></html>'

function resposta(html, url) {
  return {
    ok: true, status: 200, url,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
    text: async () => html,
    arrayBuffer: async () => new TextEncoder().encode(html).buffer,
    json: async () => { throw new Error('não é json') },
  }
}

test('vitrine/produto da SHEIN que cai no captcha NÃO devolve o título da página de risco', async (t) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const alvo = typeof input === 'string' ? input : input.url
    if (/m\.shein\.com\/br\/ark\/default/.test(alvo)) {
      // fetch(redirect:'follow') termina na página de risco
      return resposta(CAPTCHA_HTML, 'https://m.shein.com/br/risk/challenge?captcha_type=909&redirection=x')
    }
    return resposta('<html><head><title>x</title></head></html>', alvo)
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const info = await fetchProductInfo('https://m.shein.com/br/ark/default?goods_id=529469487&scene=1')
  assert.equal(info?.title || '', '', 'título do captcha não pode virar nome de produto')
  assert.equal(info?.newPrice || '', '')
})

test('página do oneLink da SHEIN entrega o nome real pelo og:title (sem captcha)', async (t) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const alvo = typeof input === 'string' ? input : input.url
    if (/onelink\.shein\.com/.test(alvo)) return resposta(ONELINK_HTML, alvo)
    return resposta(CAPTCHA_HTML, 'https://m.shein.com/br/risk/challenge?captcha_type=909')
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const info = await fetchProductInfo('https://onelink.shein.com/54/63miaq0jlo3g?ismg_ol=Df')
  assert.equal(info?.title, 'SHEIN Glamour Top Feminina Casual Estilo Street')
})

test('Criar oferta usa o aviso próprio da SHEIN (sem mandar conferir link/cadastro)', () => {
  const page = fs.readFileSync(path.join(rootDir, 'dashboard/app/painel/criar-oferta/page.js'), 'utf8')
  assert.match(page, /SHEIN_SEM_PRECO_TITULO/)
  assert.match(page, /SHEIN_SEM_NOME_E_PRECO/)
  assert.match(page, /store\?\.platform === 'shein'/)
  for (const copy of [SHEIN_SEM_PRECO_TITULO, SHEIN_SEM_PRECO_TEXTO, SHEIN_SEM_NOME, SHEIN_SEM_NOME_E_PRECO]) {
    assert.match(copy, /SHEIN/, 'o aviso precisa nomear a loja')
    assert.doesNotMatch(copy, /confira (se )?o link|cadastro est[áa] (certo|errado)/i)
  }
})
