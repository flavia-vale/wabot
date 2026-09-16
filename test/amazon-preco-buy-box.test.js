// Guarda do RCA 2026-09-16: "a oferta da Amazon saiu com preço diferente do
// que está na loja". Cada caso abaixo é uma marcação real da Amazon que fazia
// o robô publicar um número errado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { extractAmazonBuyBoxPrice, amountToNumber } from '../src/converters/amazonPrice.js'

test('o preço de tabela riscado NUNCA vira o preço da oferta, mesmo vindo antes', () => {
  const html = `<div id="apex_desktop">
    <span class="a-price a-text-price" data-a-strike="true"><span class="a-offscreen">R$299,00</span></span>
    <span class="a-price priceToPay"><span class="a-offscreen">R$199,90</span></span>
  </div>`
  assert.deepEqual(extractAmazonBuyBoxPrice(html), { newPrice: '199,90', oldPrice: '299,00' })
})

test('parcela ("10x de") não vira o preço da oferta', () => {
  const html = `<div id="corePriceDisplay_desktop_feature_div">
    <span class="a-price priceToPay"><span class="a-offscreen">R$1.299,00</span></span>
    <span class="best-offer-name">em até 10x de <span class="a-price"><span class="a-offscreen">R$129,90</span></span></span>
  </div>`
  assert.equal(extractAmazonBuyBoxPrice(html).newPrice, '1.299,00')
})

// Melhor oferta sem preço do que oferta com preço que não existe: publicar o
// valor do vendedor de usado prometia um preço que ninguém consegue pagar.
test('preço de usado/outros vendedores não substitui buy box indisponível', () => {
  const html = `<div id="apex_desktop"><div id="corePriceDisplay_desktop_feature_div">
    <span class="a-color-price">Atualmente indisponível.</span>
  </div></div>
  <div id="usedbuyBox"><span class="a-price"><span class="a-offscreen">R$59,00</span></span></div>`
  assert.deepEqual(extractAmazonBuyBoxPrice(html), { newPrice: '', oldPrice: '' })
})

// A Amazon quebra o `a-price-whole` com um span de vírgula aninhado; o extrator
// antigo exigia só dígitos e ponto, então a oferta ficava sem preço.
test('lê o preço da marcação atual (a-price-whole com span de decimal aninhado)', () => {
  const html = `<div id="apex_desktop"><span class="a-price priceToPay" data-a-size="xl"><span aria-hidden="true">
    <span class="a-price-symbol">R$</span><span class="a-price-whole">1.299<span class="a-price-decimal">,</span></span><span class="a-price-fraction">90</span>
  </span></span></div>`
  assert.equal(extractAmazonBuyBoxPrice(html).newPrice, '1.299,90')
})

// Layout em que a Amazon combina as duas classes: o preço a pagar tem que
// ganhar de `a-text-price`, senão a oferta sai sem preço nenhum.
test('apexPriceToPay ganha de a-text-price quando não há data-a-strike', () => {
  const html = `<span class="a-price a-text-price a-size-medium apexPriceToPay">
    <span class="a-offscreen">R$319,90</span></span>`
  assert.equal(extractAmazonBuyBoxPrice(html).newPrice, '319,90')
})

test('"de" só sai quando é maior que o "por"', () => {
  const html = `<div id="apex_desktop">
    <span class="a-price priceToPay"><span class="a-offscreen">R$199,90</span></span>
    <span class="a-price a-text-price" data-a-strike="true"><span class="a-offscreen">R$150,00</span></span>
  </div>`
  assert.equal(extractAmazonBuyBoxPrice(html).oldPrice, '')
})

test('amountToNumber entende o formato brasileiro com milhar', () => {
  assert.equal(amountToNumber('1.299,90'), 1299.9)
  assert.equal(amountToNumber('199,90'), 199.9)
  assert.equal(amountToNumber(''), null)
})

test('HTML sem preço devolve vazio, nunca um chute', () => {
  assert.deepEqual(extractAmazonBuyBoxPrice('<span id="productTitle">Produto</span>'), { newPrice: '', oldPrice: '' })
  assert.deepEqual(extractAmazonBuyBoxPrice(''), { newPrice: '', oldPrice: '' })
})
