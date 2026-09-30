// RCA 2026-09-30: nome e preço da SHEIN pela landing de afiliada `ark/7287`
// (única página que a SHEIN serve renderizada no servidor). O preço é lido SÓ
// do bloco JSON do goods_id pedido — a página traz 130+ preços de outros
// produtos (recomendações), e o primeiro "R$" da página é de outro produto.
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSheinArkHtml, buildSheinArkUrl, fetchSheinProductInfoByGoodsId, sheinGoodsIdFromUrl } from '../src/converters/sheinProductInfo.js'
import { fetchProductInfo } from '../src/converters/productInfoScraper.js'

// Recorte real (estrutura) da página medida em 30/09: JSON escapado com
// OUTRO produto antes e o produto pedido depois.
const ARK_HTML = [
  '<html><head><title>SHEIN</title></head><body>',
  '<div class="goods-name" data-v-9f47dbaa>1 Peça Bolsa de Ombro Retrô Minimalista Casual de Couro Sintético Vermelho Angora &amp; Trançada</div>',
  '<script>window.__x = "{\\"goods_vo_list\\":[{\\"goods_id\\":99999,\\"goods_name\\":\\"DAZY Bolsa de Ombro de Couro PU\\",\\"sale_price\\":{\\"amount\\":\\"73.46\\",\\"amountWithSymbol\\":\\"R$73,46\\"},\\"retail_price\\":{\\"amount\\":\\"97.95\\",\\"amountWithSymbol\\":\\"R$97,95\\"},\\"unit_discount\\":25}]}"</script>',
  '<span>R$16,98</span>',
  '<script>window.__y = "{\\"goods_id\\":45902840,\\"mall_code\\":\\"1\\",\\"skc\\":\\"sg2409192152028854\\",\\"goods_name\\":\\"1 Peça Bolsa de Ombro Retrô Minimalista\\",\\"goods_img\\":\\"//img.ltwebstatic.com/x/bolsa.jpg\\",\\"retail_price\\":{\\"amount\\":\\"75.95\\",\\"amountWithSymbol\\":\\"R$75,95\\"},\\"sale_price\\":{\\"amount\\":\\"68.36\\",\\"amountWithSymbol\\":\\"R$68,36\\"},\\"unit_discount\\":\\"10\\"}"</script>',
  '</body></html>',
].join('')

test('parseSheinArkHtml lê o nome do div e o preço do bloco do goods_id pedido (não o primeiro R$ da página)', () => {
  const info = parseSheinArkHtml(ARK_HTML, '45902840')
  assert.equal(info.title, '1 Peça Bolsa de Ombro Retrô Minimalista Casual de Couro Sintético Vermelho Angora & Trançada')
  assert.equal(info.newPrice, 'R$68,36')
  assert.equal(info.oldPrice, 'R$75,95')
  assert.equal(info.discountPct, 10)
  assert.equal(info.imageUrl, 'https://img.ltwebstatic.com/x/bolsa.jpg')
})

test('parseSheinArkHtml devolve null para id que não está na página e para página de captcha', () => {
  assert.equal(parseSheinArkHtml(ARK_HTML.replace('class="goods-name"', 'class="x"'), '123'), null)
  assert.equal(parseSheinArkHtml('<html><head><title>SHEIN.com is mainly design</title></head><body>/risk/challenge</body></html>', '45902840'), null)
})

test('buildSheinArkUrl leva os parâmetros de campanha (sem eles a página cai no captcha)', () => {
  const url = buildSheinArkUrl('45902840')
  assert.match(url, /^https:\/\/m\.shein\.com\/br\/ark\/\d+\?goods_id=45902840&test=5051&scene=1&ad_type=KOC&language=pt-br&siteuid=mbr$/)
  assert.equal(buildSheinArkUrl(''), null)
})

test('sheinGoodsIdFromUrl só aceita host da SHEIN', () => {
  assert.equal(sheinGoodsIdFromUrl('https://m.shein.com/br/ark/default?goods_id=45902840&scene=1'), '45902840')
  assert.equal(sheinGoodsIdFromUrl('https://br.shein.com/x-p-529469487.html'), '529469487')
  assert.equal(sheinGoodsIdFromUrl('https://evil.net/?goods_id=1'), null)
})

test('fetchSheinProductInfoByGoodsId devolve null quando a SHEIN manda para /risk/', async () => {
  const fetchImpl = async () => ({ ok: true, url: 'https://m.shein.com/br/risk/challenge?captcha_type=903', body: null, text: async () => '<html></html>' })
  assert.equal(await fetchSheinProductInfoByGoodsId('45902840', { fetchImpl }), null)
})

test('fetchProductInfo (oneLink da SHEIN) usa a landing ark e devolve nome + preço', async (t) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const alvo = typeof input === 'string' ? input : input.url
    if (/onelink\.shein\.com/.test(alvo)) {
      const html = '<html><body><input id="url" value="https://m.shein.com/br/ark/default?onelink=54/x&amp;goods_id=45902840&amp;scene=1"/></body></html>'
      return { ok: true, status: 200, url: alvo, headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'text/html' : k.toLowerCase() === 'location' ? null : null), getSetCookie: () => [] }, text: async () => html, body: null }
    }
    if (/m\.shein\.com\/br\/ark\/\d+\?goods_id=45902840/.test(alvo)) {
      return { ok: true, status: 200, url: alvo, headers: { get: () => 'text/html' }, text: async () => ARK_HTML, body: null }
    }
    throw new Error(`fetch inesperado: ${alvo}`)
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const info = await fetchProductInfo('https://onelink.shein.com/54/63iz5s0klnwa?ismg_ol=X')
  assert.equal(info.title, '1 Peça Bolsa de Ombro Retrô Minimalista Casual de Couro Sintético Vermelho Angora & Trançada')
  assert.equal(info.newPrice, 'R$68,36')
  assert.equal(info.oldPrice, 'R$75,95')
})
