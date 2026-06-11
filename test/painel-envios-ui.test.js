import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../dashboard/app/painel/envios/page.js')
const tabs = read('../dashboard/app/painel/envios/EnviosTabs.js')
const history = read('../dashboard/app/painel/envios/SendHistory.js')
const upcoming = read('../dashboard/app/painel/envios/UpcomingSends.js')
const legacy = read('../dashboard/app/painel/agendados/page.js')

test('Envios usa Histórico como padrão e Próximos envios via searchParams assíncrono', () => {
  assert.match(page, /await searchParams/)
  assert.match(page, /query\?\.view === 'scheduled'/)
  assert.match(page, /<UpcomingSends \/>/)
  assert.match(page, /<SendHistory \/>/)
  assert.match(tabs, /href: '\/painel\/envios\?view=scheduled'/)
  assert.match(tabs, /aria-current=/)
})

test('histórico identifica execuções originadas de agendamento', () => {
  assert.match(history, /sourceGroup === 'scheduled'/)
  assert.match(history, /return 'Agendamento'/)
})

test('próximos envios só oferece cancelamento para pending e mantém refresh e vazio', () => {
  assert.match(upcoming, /item\.status === 'pending'/)
  assert.doesNotMatch(upcoming, /new Set\(\['pending', 'queued'\]\)/)
  assert.match(upcoming, /'Atualizar'/)
  assert.match(upcoming, /Nenhum envio programado/)
})

test('rota legada de agendados redireciona para a aba consolidada', () => {
  assert.match(legacy, /redirect\('\/painel\/envios\?view=scheduled'\)/)
})
