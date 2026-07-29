import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLinks } from '../src/detector.js'

test('detecta produto.mercadolivre.com.br (subdomínio, link de recomendação com #fragment)', () => {
  const text = 'olha essa oferta https://produto.mercadolivre.com.br/MLB-4049246221-secadora-roupas-portatil-110v-mini-eletrica-cortina-pendurar-_JM?searchVariation=188766696371#polycard_client=recommendations_home_navigation-recommendations&reco_backend=x&c_id=/home/element fim'
  const links = detectLinks(text)
  assert.equal(links.length, 1)
  assert.equal(links[0].platform, 'mercadolivre')
  assert.ok(links[0].url.startsWith('https://produto.mercadolivre.com.br/MLB-4049246221'))
})

test('detecta www. e domínio nu de mercadolivre', () => {
  assert.equal(detectLinks('https://www.mercadolivre.com.br/p/MLB123456').length, 1)
  assert.equal(detectLinks('https://mercadolivre.com.br/p/MLB123456').length, 1)
})

test('detecta host nu mercadolivre.com (links /sec/ de compartilhamento)', () => {
  const links = detectLinks('https://mercadolivre.com/sec/16tPGB4')
  assert.equal(links.length, 1)
  assert.equal(links[0].platform, 'mercadolivre')
  assert.equal(links[0].url, 'https://mercadolivre.com/sec/16tPGB4')
})

test('detecta s.shopee.com.br e shopee.com.br via subdomínio genérico', () => {
  assert.equal(detectLinks('https://s.shopee.com.br/abc123').length, 1)
  assert.equal(detectLinks('https://shopee.com.br/product/1/2').length, 1)
  assert.equal(detectLinks('https://shope.ee/abc').length, 1)
})

test('detecta subdomínios de amazon e magazine', () => {
  assert.equal(detectLinks('https://www.amazon.com.br/dp/B09VQ39F41').length, 1)
  assert.equal(detectLinks('https://amzn.to/abc').length, 1)
  assert.equal(detectLinks('https://www.magazinevoce.com.br/magazinex/p/123').length, 1)
})

// Regressão: short link amzn.la (encurtador Amazon usado por afiliados BR) não
// era reconhecido, então a oferta caía como "nolink" e a política LINK_ONLY do
// grupo ignorava ("Mensagem fora das regras de encaminhamento").
test('detecta short link amzn.la como amazon', () => {
  const links = detectLinks('promoção imperdível https://amzn.la/d/abc123 corre')
  assert.equal(links.length, 1)
  assert.equal(links[0].platform, 'amazon')
  assert.equal(links[0].url, 'https://amzn.la/d/abc123')
})

test('detecta short link link.amazon como amazon', () => {
  const links = detectLinks('promoção imperdível https://link.amazon/B00WDbu4a corre')
  assert.equal(links.length, 1)
  assert.equal(links[0].platform, 'amazon')
  assert.equal(links[0].url, 'https://link.amazon/B00WDbu4a')
})

// Encurtador de plataforma de divulgação (2026-07): o link não era detectado,
// então a oferta passava batida e a comissão ficava com o afiliado de origem.
// Nome parecido com `amzn.divulgador.link`, mas é outro serviço/domínio.
test('detecta short link amzn.divulguei.app como amazon', () => {
  const links = detectLinks('corre que acaba https://amzn.divulguei.app/ypAVjz agora')
  assert.equal(links.length, 1)
  assert.equal(links[0].platform, 'amazon')
  assert.equal(links[0].url, 'https://amzn.divulguei.app/ypAVjz')
})

// A entrada é `amzn.` de propósito: `divulguei.app` serve várias lojas, então
// casar o domínio nu classificaria link de outra loja como amazon.
test('não casa outro subdomínio de divulguei.app como amazon', () => {
  assert.equal(detectLinks('https://shopee.divulguei.app/abc123').length, 0)
})

test('não casa host colado (notmercadolivre.com.br)', () => {
  assert.equal(detectLinks('https://notmercadolivre.com.br/p/MLB123').length, 0)
})

// Regressão (incidente 2026-06-23): "último link" deve significar "último link
// DE LOJA". Numa mensagem espelhada com link de produto + link de cupom (ambos
// de loja) + link de vitrine de afiliado (iadivu.link, NÃO-loja) + grupo de
// WhatsApp, só os links de loja podem entrar na seleção primeiro/último. O
// iadivu.link e o convite de grupo NÃO podem ser detectados como link de oferta.
test('detecta só links de LOJA na mensagem (exclui vitrine iadivu e convite de grupo) e preserva a ordem', () => {
  const text = [
    '> apa e Painel Festivo Decoração Sublimada',
    '🔗 Compre aqui: https://s.shopee.com.br/5VTC0c5D8e',
    '🏷️ Confira os Cupons disponíveis aqui: https://s.shopee.com.br/6L2J0922Rn',
    '🛍️ Confira nossa Vitrine de Links: https://iadivu.link/l/vitrinedadecor',
    'Conheça nossos grupos👇 https://chat.whatsapp.com/EID15uqofIa45DlD8ufj0L',
  ].join('\n')
  const links = detectLinks(text)
  assert.equal(links.length, 2, 'só os 2 links de loja (Shopee) entram')
  assert.deepEqual(links.map(l => l.url), [
    'https://s.shopee.com.br/5VTC0c5D8e',
    'https://s.shopee.com.br/6L2J0922Rn',
  ])
  // o "último link de loja" é o último da lista detectada (nunca o iadivu)
  assert.equal(links[links.length - 1].url, 'https://s.shopee.com.br/6L2J0922Rn')
  assert.ok(!links.some(l => /iadivu\.link|chat\.whatsapp\.com/.test(l.url)), 'vitrine/convite nunca entram')
})
