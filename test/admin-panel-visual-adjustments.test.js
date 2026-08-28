import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const adminPage = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
const onlinePage = readFileSync(new URL('../dashboard/app/admin/online/page.js', import.meta.url), 'utf8')
const customersPage = readFileSync(new URL('../dashboard/app/admin/clientes/page.js', import.meta.url), 'utf8')
const offersPage = readFileSync(new URL('../dashboard/app/admin/ofertas/page.js', import.meta.url), 'utf8')

test('atalho de ofertas explica que a visão acompanha imagens', () => {
  assert.match(adminPage, />Ofertas \(imagem\)<\/Link>/)
  assert.doesNotMatch(adminPage, /Ofertas \(entrega\)/)
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

test('página de ofertas usa a superfície clara das demais páginas admin', () => {
  assert.match(offersPage, /min-h-screen bg-slate-50/)
  assert.doesNotMatch(offersPage, /min-h-screen bg-slate-950/)
})
