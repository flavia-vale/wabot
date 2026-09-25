// Checkbox "Inserir cupons cadastrados" do Criar oferta (specs/017, decisões da
// dona do produto em 2026-09-23). A regra de ONDE o cupom entra é pura; quem
// escolhe o cupom de verdade é o robô, na hora do envio.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureCouponSlot, hasCouponToken, currentCouponText, resolveCouponForDisplay } from '../dashboard/lib/criarOfertaCupom.js'
import { sanitizePriceCents } from '../src/core/clientCouponPolicy.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(rootDir, rel), 'utf8')

const shopee10 = { id: 'c1', code: 'PROMO10', platform: 'shopee', discountType: 'percent', discountValue: 10, enabled: true, validUntil: null, createdAt: '2026-09-01T00:00:00Z' }

test('template sem {cupom}: a linha entra logo abaixo da linha do preço', () => {
  assert.equal(
    ensureCouponSlot('🛍️ {produto}\n💰 De {preço_de} por {preço}\n🔗 {link}'),
    '🛍️ {produto}\n💰 De {preço_de} por {preço}\n{cupom}\n🔗 {link}',
  )
})

test('template que já tem {cupom}: nunca duplica', () => {
  const body = '{produto}\n{preço}\n{cupom}\n{link}'
  assert.equal(ensureCouponSlot(body), body)
  assert.equal((ensureCouponSlot(body).match(/\{cupom\}/g) || []).length, 1)
})

test('sem linha de preço: entra antes do link; sem link: no fim', () => {
  assert.equal(ensureCouponSlot('{produto}\n{link}'), '{produto}\n{cupom}\n{link}')
  assert.equal(ensureCouponSlot('{produto}'), '{produto}\n{cupom}')
  assert.equal(ensureCouponSlot(undefined), undefined)
})

test('prévia/cópia com preço: "de X por Y com o cupom" numa linha própria', () => {
  const texto = currentCouponText({ coupons: [shopee10], platform: 'shopee', priceCents: 25000, now: Date.parse('2026-09-23') })
  // O formatador de reais usa espaço não separável depois do "R$" (não quebra linha).
  assert.equal(texto.replace(/\u00a0/g, ' '), '🎟️ Use o cupom PROMO10 — de R$ 250,00 por *R$ 225,00* com o cupom (10% OFF)')
  assert.equal(resolveCouponForDisplay('A\n{cupom}\nB', texto), `A\n${texto}\nB`)
})

test('sem cupom da loja: o marcador some sem deixar linha vazia', () => {
  const texto = currentCouponText({ coupons: [shopee10], platform: 'amazon', priceCents: 25000 })
  assert.equal(texto, '')
  assert.equal(resolveCouponForDisplay('A\n{cupom}\nB', texto), 'A\nB')
  assert.equal(hasCouponToken('A\nB'), false)
})

test('preço vindo de fora só vale como inteiro positivo em centavos', () => {
  assert.equal(sanitizePriceCents(25000), 25000)
  assert.equal(sanitizePriceCents('25000'), 25000)
  for (const ruim of [null, undefined, 0, -1, 12.5, 'abc', '', NaN]) assert.equal(sanitizePriceCents(ruim), null)
})

test('o preço lido pela tela chega ao robô nos três botões', () => {
  const rota = read('src/api/routes/broadcast.js')
  assert.match(rota, /couponPriceCents: sanitizePriceCents\(req\.body\?\.offer\?\.priceCents\) \?\? undefined/, 'Enviar agora')
  assert.match(rota, /couponPriceCents: sanitizePriceCents\(req\.body\?\.offer\?\.priceCents\),/, 'Agendar')
  assert.match(read('src/offerQueue/dispatcher.js'), /couponPriceCents \}\)/, 'Inserir na fila')
  const worker = read('src/bot-worker.js')
  assert.match(worker, /couponContextFromText\(msg\.text, msg\.options\?\.couponPriceCents\)/)
  assert.match(worker, /couponContextFromText\(msg\.text, msg\.couponPriceCents\)/)
})

test('tela: checkbox marcado por padrão, link para o cadastro e sem duplicar', () => {
  const page = read('dashboard/app/painel/criar-oferta/page.js')
  assert.match(page, /const \[useCoupons, setUseCoupons\] = useState\(true\)/)
  assert.match(page, /Inserir cupons cadastrados/)
  assert.match(page, /href="\/painel\/cupons"[^>]*>Cadastre seus cupons</)
  assert.match(page, /templateBody: useCoupons \? ensureCouponSlot\(selectedTemplate\?\.body\) : selectedTemplate\?\.body/)
})
