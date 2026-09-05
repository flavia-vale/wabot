import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const adminPage = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
const onlinePage = readFileSync(new URL('../dashboard/app/admin/online/page.js', import.meta.url), 'utf8')
const customersPage = readFileSync(new URL('../dashboard/app/admin/clientes/page.js', import.meta.url), 'utf8')

test('a visão de imagem das ofertas vive no Início, não numa página à parte', () => {
  // A página /admin/ofertas foi removida (2026-09-05): a pergunta "as ofertas
  // estão saindo com foto?" é de olhar todo dia, e página separada não é aberta.
  assert.doesNotMatch(adminPage, /href="\/admin\/ofertas"/)
  assert.match(adminPage, /adminQualidadeEntrega\(48\)/)
  assert.match(adminPage, /De que jeito as imagens saíram/)
  assert.match(adminPage, /Envios e imagem por loja/)
})

test('a página de automações some e o limite passa a ser campo do cliente', () => {
  assert.doesNotMatch(adminPage, /href="\/admin\/automacoes"/)
  const customerHistory = readFileSync(new URL('../dashboard/app/admin/clientes/[id]/page.js', import.meta.url), 'utf8')
  assert.match(customerHistory, /Limite de automações/)
  assert.match(customerHistory, /adminAutomationQuotaUpdate/)
})

test('cards removidos não aparecem no início, na aba online nem na página online', () => {
  for (const label of ['Acesso vencido', 'Precisam de QR novo', 'Offline acumulado 24h', 'WA desconectado']) {
    assert.doesNotMatch(adminPage, new RegExp(`label="${label}"`))
  }
  assert.doesNotMatch(onlinePage, /label="Alertas desconectados"/)
})

test('lista de clientes apresenta o vencimento em dias', () => {
  assert.match(customersPage, /function formatDaysUntil/)
  assert.match(customersPage, /formatDaysUntil\(customer\.accessExpiresAt\)/)
})

test('a tela de capacidade não tem mais painel de fundo escuro', () => {
  const decisionCard = readFileSync(new URL('../dashboard/app/admin/capacidade/components/CapacityDecisionCard.js', import.meta.url), 'utf8')
  assert.doesNotMatch(decisionCard, /bg-slate-950 p-6 text-white/)
  assert.match(decisionCard, /bg-white/)
})
