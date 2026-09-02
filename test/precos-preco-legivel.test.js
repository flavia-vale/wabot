// Guarda da ação 4 do PLANO_ACAO_SEO_IA_2026-09-01.
//
// Dois defeitos que a medição de citação por IA de 01/09 expôs na página de
// preço, e que este teste impede de voltar:
//
// 1. O ChatGPT sabia o preço do Pro e NÃO achava o do Basic. A descrição dizia
//    "Basic a partir de R$39" — "a partir de" não diz se R$39 É o preço do
//    Basic ou apenas o piso da tabela. A frase de abertura da página agora
//    nomeia cada plano junto do seu valor, montada a partir dos planos reais.
//
// 2. `priceValue` — o número que vai para o schema Offer, que é o que Google e
//    IA leem — vinha SEMPRE do default hardcoded nos dois caminhos de merge.
//    Trocar o preço no painel admin mudava o que a pessoa lê e não mudava o que
//    o robô lê: as duas pontas discordavam em silêncio.
//
// E o achado que motivou a instrumentação: `/precos` aparecia com 19 visitas e
// ZERO clique em CTA. Os botões "Assinar Basic"/"Assinar Pro" não tinham
// `data-seo-cta`, então o rastreador nunca os viu. Não era falta de conversão,
// era falta de medição — mesmo tipo de cegueira do `comparison_page_view`.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { parsePriceValue, DEFAULT_LANDING_PLANS } from '../dashboard/lib/marketing-content.js'

const raiz = new URL('..', import.meta.url)
const ler = (caminho) => fs.readFileSync(new URL(caminho, raiz), 'utf8')

// A frase é montada dentro de um módulo do Next (aliases `@/`), então é
// extraída do fonte em vez de importada — mesmo padrão dos outros testes
// estruturais do repo.
function carregarFraseDePreco() {
  const fonte = ler('dashboard/app/precos/page.js')
  const corpo = fonte.match(/export function formatPlanPricingSentence[\s\S]*?\n}/)
  assert.ok(corpo, 'formatPlanPricingSentence sumiu de dashboard/app/precos/page.js')
  // eslint-disable-next-line no-new-func
  return new Function(`${corpo[0].replace('export ', '')}; return formatPlanPricingSentence`)()
}

test('a frase de preço nomeia CADA plano junto do valor (era isso que faltava para a IA)', () => {
  const formatar = carregarFraseDePreco()
  const frase = formatar(DEFAULT_LANDING_PLANS)

  for (const plano of DEFAULT_LANDING_PLANS.filter((p) => Number(p.priceValue) > 0)) {
    assert.match(
      frase,
      new RegExp(`${plano.name}[^.]*${plano.price.replace('$', '\\$')}`),
      `a frase precisa dizer o nome do plano "${plano.name}" junto do preço "${plano.price}" — "a partir de R$X" deixou o preço do Basic ilegível para as IAs. Frase atual: "${frase}"`
    )
  }
  assert.doesNotMatch(frase, /a partir de/i, 'nada de "a partir de": é a construção que escondeu o preço do Basic')
})

test('a frase de preço nunca inventa valor quando não há plano pago resolvido', () => {
  const formatar = carregarFraseDePreco()
  assert.doesNotMatch(formatar([]), /R\$/, 'sem plano pago, a frase não pode conter cifra')
  assert.doesNotMatch(formatar(null), /R\$/, 'entrada nula não pode virar preço')
})

test('parsePriceValue acompanha o preço exibido, e recusa formato que não entende', () => {
  assert.equal(parsePriceValue('R$39'), 39)
  assert.equal(parsePriceValue('R$ 69'), 69)
  assert.equal(parsePriceValue('R$ 1.299,90'), 1299.9)
  // Formato inesperado devolve null para o chamador cair no default —
  // publicar preço inventado no schema seria pior que publicar o antigo.
  assert.equal(parsePriceValue('Sob consulta'), null)
  assert.equal(parsePriceValue(''), null)
  assert.equal(parsePriceValue(undefined), null)
  assert.equal(parsePriceValue(39), null)
})

test('os dois caminhos de merge derivam priceValue do preço exibido, não do default', () => {
  const alvos = [
    ['dashboard/lib/plans-server.js', 'remote.price'],
    ['dashboard/components/landing/Pricing.jsx', 'dynamicPlan?.price'],
  ]
  for (const [arquivo, origem] of alvos) {
    const fonte = ler(arquivo)
    assert.match(
      fonte,
      new RegExp(`priceValue:\\s*parsePriceValue\\(${origem.replace(/[.?]/g, '\\$&')}\\)`),
      `${arquivo}: priceValue precisa vir de parsePriceValue(${origem}). Congelado no default, o schema Offer passa a discordar do preço que a pessoa lê na tela.`
    )
  }
})

test('os botões de assinatura são rastreáveis — senão "zero clique em CTA" não significa nada', () => {
  const fonte = ler('dashboard/components/landing/Pricing.jsx')
  assert.match(
    fonte,
    /data-seo-cta=\{`plan-\$\{p\.id\}`\}/,
    'o CTA de cada plano precisa de data-seo-cta: o OrganicPageTracker só conta clique em elemento que carrega esse atributo, e sem ele /precos aparece com 0 conversão sem ter sido medida'
  )
})
