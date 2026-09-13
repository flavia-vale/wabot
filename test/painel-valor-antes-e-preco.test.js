// A2 e D5 do plano de ativação de 2026-09-08.
//
// A2 — 46 das 114 pessoas que não pagaram criaram a conta e nunca pediram a
// conexão. O produto pede o MÁXIMO ("entregue seu WhatsApp a um robô") antes de
// entregar o mínimo. O caminho curto já existia e ninguém apontava para ele.
//
// D5 — "R$ 69" é um número solto. "R$ 1,47 por oferta publicada" é o mesmo
// preço na conta que ela consegue refazer, com o número que é dela.
//
// Puro: sem banco, sem rede.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  VALUE_FIRST_BODY,
  VALUE_FIRST_HEADLINE,
  VALUE_FIRST_STEPS,
} from '../src/domain/painel/valueFirst.js'
import { buildPricePerOffer, parsePriceToCents } from '../src/domain/painel/pricePerOffer.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

// --- A2: prova antes do pedido ------------------------------------------------

test('o atalho promete ver funcionando SEM conectar o WhatsApp', () => {
  const texto = `${VALUE_FIRST_HEADLINE} ${VALUE_FIRST_BODY}`.toLowerCase()
  assert.ok(texto.includes('antes de conectar') || texto.includes('sem ligar'))
  assert.ok(texto.includes('afiliada'), 'não diz o que ela ganha no link')
})

test('o atalho tem DOIS passos, e a loja vem primeiro', () => {
  // Converter exige uma loja cadastrada: sem etiqueta não há para quem creditar
  // a comissão. Prometer um passo só seria mandar a cliente para um conversor
  // que vai falhar na cara dela.
  assert.equal(VALUE_FIRST_STEPS.length, 2)
  assert.equal(VALUE_FIRST_STEPS[0].href, '/painel/ids-afiliada')
  assert.equal(VALUE_FIRST_STEPS[1].href, '/painel/converte-links')
})

test('o conversor é apontado como coisa que não publica nada', () => {
  const passo = VALUE_FIRST_STEPS.find((p) => p.chave === 'converter')
  assert.match(passo.texto, /não .*publicado|nada é publicado/i)
})

test('o atalho some quando o robô conecta', () => {
  // Dali em diante ela não precisa mais de prova, precisa de configuração.
  const componente = read('../dashboard/components/ActivationChecklist.js')
  assert.match(componente, /\{!botActive && \(\s*<div[^>]*>\s*<ValueFirstCard \/>/)
})

test('o atalho NÃO virou um passo da checklist', () => {
  // A lista é dirigida pelo estado que vem do servidor, e o mesmo contador
  // governa a celebração e o modo de recuperação. Um passo sem estado no
  // servidor quebraria os três.
  const componente = read('../dashboard/components/ActivationChecklist.js')
  const bloco = componente.slice(componente.indexOf('const STEPS = ['), componente.indexOf('const TOTAL_STEPS'))
  assert.ok(!bloco.includes('converte-links'), 'o atalho entrou no contador da checklist')
})

test('o texto do atalho é leigo', () => {
  const texto = `${VALUE_FIRST_HEADLINE} ${VALUE_FIRST_BODY} ${VALUE_FIRST_STEPS.map((p) => p.texto).join(' ')}`.toLowerCase()
  for (const jargao of ['api', 'credential', 'tag', 'cookie', 'endpoint']) {
    assert.ok(!texto.includes(jargao), `"${jargao}" no atalho`)
  }
})

// --- D5: o preço no uso dela --------------------------------------------------

test('o preço vira conta por oferta', () => {
  const r = buildPricePerOffer({ priceCents: 6900, offersPublished: 47 })
  // O Intl usa espaço fino (não separável) entre "R$" e o número — comparar com
  // espaço comum falha por um caractere invisível.
  assert.equal(r.porOferta.replace(/\s/g, ' '), 'R$ 1,47')
  assert.match(r.texto, /47 ofertas/)
})

test('sem uso, a conta NÃO aparece', () => {
  // Sem ofertas publicadas isso viraria promessa de volume que a gente não fez.
  assert.equal(buildPricePerOffer({ priceCents: 6900, offersPublished: 0 }), null)
  assert.equal(buildPricePerOffer({ priceCents: 6900, offersPublished: null }), null)
  assert.equal(buildPricePerOffer({ priceCents: 6900 }), null)
})

test('preço ilegível não vira conta errada', () => {
  for (const preco of [null, 0, -1, NaN, 'grátis']) {
    assert.equal(buildPricePerOffer({ priceCents: preco, offersPublished: 47 }), null, String(preco))
  }
})

test('lê o mesmo preço que a tela mostra', () => {
  // Duplicar a tabela de preços num segundo lugar envelheceria errada no dia em
  // que o preço mudasse.
  assert.equal(parsePriceToCents('R$69'), 6900)
  assert.equal(parsePriceToCents('R$ 69,00'), 6900)
  assert.equal(parsePriceToCents('R$1.299,90'), 129990)
  for (const ruim of ['', null, undefined, 'grátis', 'R$0']) {
    assert.equal(parsePriceToCents(ruim), null, String(ruim))
  }
})

test('uma oferta só não vira "1 ofertas"', () => {
  assert.match(buildPricePerOffer({ priceCents: 6900, offersPublished: 1 }).texto, /1 oferta publicada/)
})

test('a tela de plano usa a conta e o painel expõe o número', () => {
  const page = read('../dashboard/app/painel/plano/page.js')
  assert.match(page, /buildPricePerOffer\(/)
  assert.match(page, /\{precoPorOferta\.texto\}/)
  const shell = read('../dashboard/app/painel/PainelShell.js')
  assert.match(shell, /offersPublished, refreshSession, setHeader \}\)/)
})
