import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../dashboard/app/painel/ofertas-automaticas/page.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../dashboard/app/painel/painel.css', import.meta.url), 'utf8')

// Protótipo Basic/PRO (2026-09-23): "Novo tema" é a ação do cabeçalho da tela,
// antes do card de status — como em Filas.
test('Novo tema fica no cabeçalho da tela, antes do card de status', () => {
  const head = page.indexOf('className="pnl-pro-head"')
  const button = page.indexOf('+ Novo tema')
  const status = page.indexOf('className="offer-auto-status"')
  assert.ok(head > -1 && button > head && status > button)
})

test('card de tema mostra forma de publicação e aprovadas sem ícone fixo da Shopee', () => {
  assert.match(page, /Revisar antes/)
  assert.match(page, /Enviar direto/)
  assert.match(page, /approvedReviewCount/)
  assert.doesNotMatch(page, /offer-auto-store-badge/)
})

test('temas têm separação visual entre os cards', () => {
  assert.match(css, /\.offer-auto-topic-list \{[^}]*gap: 8px/s)
  assert.match(css, /\.offer-auto-topic \{[^}]*border-radius: 12px/s)
})
