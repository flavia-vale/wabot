import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LONG_EXPIRED_DAYS,
  resolveLongExpiredDays,
  wantsLongExpired,
  buildLongExpiredWhere,
  isLongExpired,
} from '../src/core/adminVisibility.js'

const NOW = new Date('2026-08-26T12:00:00Z')
const dias = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

test('a janela padrão é de 30 dias', () => {
  assert.equal(DEFAULT_LONG_EXPIRED_DAYS, 30)
  assert.equal(resolveLongExpiredDays(undefined), 30)
  assert.equal(resolveLongExpiredDays('45'), 45)
  assert.equal(resolveLongExpiredDays('abacaxi'), 30)
  assert.equal(resolveLongExpiredDays('-5'), 30)
})

test('o "ver mais" aceita as formas que chegam pela URL', () => {
  for (const valor of ['1', 'true', 'sim', 'YES']) assert.equal(wantsLongExpired(valor), true)
  for (const valor of ['0', 'false', '', undefined, null, 'nao']) assert.equal(wantsLongExpired(valor), false)
})

test('por padrão, esconde quem venceu há mais que a janela', () => {
  const where = buildLongExpiredWhere({ now: NOW })
  assert.ok(where.OR, 'precisa filtrar')
  assert.equal(where.OR[0].accessExpiresAt, null, 'conta sem data de acesso nunca some')
  assert.ok(where.OR[1].accessExpiresAt.gt instanceof Date)
})

test('com "ver mais" ligado, não filtra nada', () => {
  assert.equal(buildLongExpiredWhere({ now: NOW, includeLongExpired: true }), null)
})

test('quem venceu ontem continua visível; quem venceu há 2 meses não', () => {
  assert.equal(isLongExpired(dias(1), { now: NOW }), false)
  assert.equal(isLongExpired(dias(29), { now: NOW }), false)
  assert.equal(isLongExpired(dias(31), { now: NOW }), true)
  assert.equal(isLongExpired(dias(60), { now: NOW }), true)
})

test('acesso no futuro nunca é escondido', () => {
  assert.equal(isLongExpired(new Date(NOW.getTime() + 5 * 86_400_000), { now: NOW }), false)
})

// "Não sei quando vence" não é "venceu há muito tempo": esconder por dúvida
// tiraria da tela justamente o caso estranho que alguém precisa olhar.
test('conta sem data de acesso nunca é escondida', () => {
  assert.equal(isLongExpired(null, { now: NOW }), false)
  assert.equal(isLongExpired(undefined, { now: NOW }), false)
  assert.equal(isLongExpired('data-quebrada', { now: NOW }), false)
})

// Guardas de fiação: a regra tem que valer nas DUAS listagens do admin, e o
// botão precisa dizer quantas ficaram de fora (senão parece que sumiram).
import { readFileSync } from 'node:fs'

const adminRoute = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
const adminService = readFileSync(new URL('../src/domain/admin/service.js', import.meta.url), 'utf8')
const adminPage = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
const onlinePage = readFileSync(new URL('../dashboard/app/admin/online/page.js', import.meta.url), 'utf8')

test('a listagem de clientes esconde vencidas antigas por padrão', () => {
  assert.match(adminService, /wantsLongExpired\(query\.incluirVencidos\)/)
  assert.match(adminService, /longExpiredWhere \? \{ AND: \[longExpiredWhere\] \} : \{\}/)
})

test('a aba online segue a mesma regra', () => {
  assert.match(adminRoute, /wantsLongExpired\(query\.incluirVencidos\)/)
  assert.match(adminRoute, /longExpiredWhere \? \{ AND: \[longExpiredWhere\] \} : \{\}/)
})

test('os cards de cenário contam a mesma coisa que a lista mostra', () => {
  assert.match(adminRoute, /if \(isLongExpired\(session\.user\?\.accessExpiresAt \?\? null/)
})

test('as duas telas dizem quantas ficaram de fora', () => {
  assert.match(adminService, /ocultasPorVencimento/)
  assert.match(adminRoute, /ocultasPorVencimento: hiddenLongExpired/)
  assert.match(adminPage, /Ver mais \(\$\{oculto\}/)
  assert.match(onlinePage, /Ver mais \(\$\{data\?\.summary\?\.ocultasPorVencimento\}/)
})
