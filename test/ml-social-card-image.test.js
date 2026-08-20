import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import {
  buildMlPictureUrl,
  extractFeaturedSocialImage,
  resolveSocialShareUrl,
} from '../src/converters/mercadolivre.js'

// RCA 2026-08-19/20: as ofertas de Mercado Livre passaram a sair SEM FOTO de um
// dia para o outro (Amazon e Shopee normais). Medido no próprio VPS: o ML passa
// a servir o muro anti-robô para o IP do servidor — a página do produto responde
// **200**, 39KB, SEM `og:image`, então o leitor de imagem não tinha o que ler.
// O muro é por IP, não por User-Agent (Chrome, iPhone, WhatsApp, Facebook e
// Googlebot receberam a mesma parede).
//
// A vitrine `/social/?ref=` continua acessível e já traz a foto do card
// destacado — é a fonte usada agora. Não regredir: se alguém voltar a depender
// só da página do produto, as ofertas de ML voltam a sair sem foto.

const html = readFileSync(new URL('./fixtures/ml-social-card-featured.html', import.meta.url), 'utf8')

test('lê a foto do card destacado no HTML real da vitrine', () => {
  assert.equal(
    extractFeaturedSocialImage(html),
    'https://http2.mlstatic.com/D_NQ_NP_2X_922571-MLB111294591822_052026-F.jpg',
  )
})

test('a variante escolhida é a grande (medido 1080x1080)', () => {
  // Sem `2X` a CDN entrega 500px, que o preview do WhatsApp mostra pixelizado
  // (o mínimo aceitável do card é 800px no maior eixo).
  assert.match(buildMlPictureUrl('922571-MLB111294591822_052026'), /D_NQ_NP_2X_.*-F\.jpg$/)
})

test('id de foto inválido não vira URL', () => {
  assert.equal(buildMlPictureUrl(''), null)
  assert.equal(buildMlPictureUrl(null), null)
  assert.equal(buildMlPictureUrl('../../etc/passwd'), null)
  assert.equal(buildMlPictureUrl('abc"onerror=x'), null)
})

test('página sem card destacado não devolve foto (vitrine/lista/cupom)', () => {
  assert.equal(extractFeaturedSocialImage('<html><body>perfil sem destaque</body></html>'), null)
  assert.equal(extractFeaturedSocialImage(''), null)
  assert.equal(extractFeaturedSocialImage(null), null)
})

test('só vitrine COM ref vira fonte de foto', async () => {
  const comRef = 'https://www.mercadolivre.com.br/social/gdecoracoes?ref=BLOB'
  assert.equal(await resolveSocialShareUrl(comRef), comRef)
  // Sem ref o ML serve um destaque qualquer do perfil — origem do bug histórico
  // da "foto errada". Nunca usar como fonte.
  assert.equal(await resolveSocialShareUrl('https://www.mercadolivre.com.br/social/gdecoracoes'), null)
  assert.equal(await resolveSocialShareUrl('https://www.mercadolivre.com.br/social/gdecoracoes/lists?ref=BLOB'), null)
  assert.equal(await resolveSocialShareUrl('https://produto.mercadolivre.com.br/MLB-1-x-_JM'), null)
  assert.equal(await resolveSocialShareUrl('https://exemplo.com/social/x?ref=BLOB'), null)
  assert.equal(await resolveSocialShareUrl(''), null)
})

// RCA 2026-08-20 (parte 2): as ofertas de ML de vitrine PARARAM DE SAIR sempre
// que a conversão precisava do plano B. O card de recomendação traz o `url`
// apontando para `/up/MLBU...` (outro namespace de id), o leitor recusava esse
// endereço e caíamos no endereço FABRICADO `MLB<id>-x-_JM` — que não existe no
// ML e, desde 15/08, é descartado no publicar. Com id + nome do produto que já
// vêm no card dá para montar o endereço REAL (`MLB-<id>-<nome>-_JM`, com hífen
// depois de MLB). Não regredir: voltar a fabricar faz a oferta sumir de novo.

test('monta o endereço REAL do anúncio a partir do card de recomendação', async () => {
  const { extractFeaturedSocialProduct } = await import('../src/converters/mercadolivre.js')
  assert.equal(
    extractFeaturedSocialProduct(html),
    'https://produto.mercadolivre.com.br/MLB-4715816813-kit-1-boleira-slim--2-mini-cake-2-band-20x13-2-sextavada-_JM',
  )
})

test('o endereço montado não é o formato fabricado que o ML recusa', async () => {
  const { extractFeaturedSocialProduct, isSyntheticListingUrl } = await import('../src/converters/mercadolivre.js')
  assert.equal(isSyntheticListingUrl(extractFeaturedSocialProduct(html)), false)
})
