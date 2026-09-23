// specs/017-client-coupon-catalog — o marcador {cupom} só é trocado pelo robô,
// NA HORA DO ENVIO. Colisão encontrada ao juntar com o develop: o guarda do RCA
// de 19/09 ("nenhuma variável vaza crua") pegou que o painel "Criar oferta"
// mostrava e COPIAVA o texto com "{cupom}" cru — e copiar é o único caminho que
// não passa pelo robô, então o marcador chegaria ao grupo colado à mão.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyTemplateVariables,
  buildMobileOfferText,
  stripCouponToken,
  showCouponStandIn,
  COUPON_PREVIEW_STAND_IN,
} from '../dashboard/lib/mobileOfferComposer.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(rootDir, rel), 'utf8')

const TEMPLATE = ['🛍️ {produto}', '{cupom}', '💰 Por {preço}', '🔗 {link}'].join('\n')

test('por padrão a montagem apaga {cupom} sem deixar linha vazia', () => {
  const texto = applyTemplateVariables(TEMPLATE, { title: 'Fone', price: 'R$ 50,00', link: 'https://x.y' })
  assert.ok(!texto.includes('{cupom}'))
  assert.equal(texto, '🛍️ Fone\n💰 Por R$ 50,00\n🔗 https://x.y')
})

test('quem passa pelo robô mantém o marcador para ele trocar na hora do envio', () => {
  const texto = buildMobileOfferText({ product: { title: 'Fone', price: 'R$ 50,00' }, link: 'https://x.y', templateBody: TEMPLATE, keepCouponToken: true })
  assert.ok(texto.includes('{cupom}'))
})

test('apagar o marcador no meio da linha não deixa espaço sobrando', () => {
  assert.equal(stripCouponToken('Aproveite {cupom} hoje'), 'Aproveite hoje')
  assert.equal(stripCouponToken('a\n{cupom}\nb'), 'a\nb')
})

test('a prévia explica onde o cupom entra, sem inventar um código', () => {
  const previa = showCouponStandIn('x\n{cupom}\ny')
  assert.ok(!previa.includes('{cupom}'))
  assert.ok(previa.includes(COUPON_PREVIEW_STAND_IN))
  // Um código de exemplo seria lido pela cliente como se fosse o cupom dela.
  assert.ok(!/[A-Z]{3,}\d+/.test(COUPON_PREVIEW_STAND_IN))
})

test('os três caminhos que passam pelo robô pedem para manter o marcador', () => {
  for (const rel of ['src/core/mirrorTemplate.js', 'src/offerAutomation/dispatcher.js', 'dashboard/app/painel/criar-oferta/page.js']) {
    assert.match(read(rel), /keepCouponToken:\s*true/, `${rel} deixou de manter o marcador — o cupom sumiria desse caminho`)
  }
})

test('copiar no Criar oferta nunca leva o marcador cru', () => {
  const page = read('dashboard/app/painel/criar-oferta/page.js')
  assert.match(page, /clipboard\.writeText\(stripCouponToken\(/)
  assert.match(page, /WhatsAppBubble text=\{showCouponStandIn\(/)
})
