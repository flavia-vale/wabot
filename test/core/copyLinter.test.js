import test from 'node:test'
import assert from 'node:assert/strict'

import { lintChannelTitle, lintCopyTemplate, LINT_CODES } from '../../src/core/copyLinter.js'

// ---------- lintChannelTitle ----------

test('title sem marca → sem warnings', () => {
  const r = lintChannelTitle('Ofertas Tech BR')
  assert.equal(r.warnings.length, 0)
})

test('title contendo marca sem prefixo permitido → warning impersonação', () => {
  for (const t of ['Amazon Brasil', 'Shopee BR', 'Mercado Livre Ofertas', 'Magalu Promo', 'Aliexpress Brasil']) {
    const r = lintChannelTitle(t)
    assert.ok(r.warnings.some(w => w.code === LINT_CODES.BRAND_IMPERSONATION), `falhou pra "${t}"`)
  }
})

test('title contendo marca COM prefixo permitido → sem warning de impersonação', () => {
  for (const t of ['Ofertas de Amazon', 'Achados de Shopee', 'OFERTAS DE Magalu']) {
    const r = lintChannelTitle(t)
    assert.equal(r.warnings.filter(w => w.code === LINT_CODES.BRAND_IMPERSONATION).length, 0, `falhou pra "${t}"`)
  }
})

test('title genérico → warning pouco descritivo', () => {
  for (const t of ['Promo', 'Ofertas', 'Oferta', 'Achados', 'Achado']) {
    const r = lintChannelTitle(t)
    assert.ok(r.warnings.some(w => w.code === LINT_CODES.TITLE_TOO_GENERIC), `falhou pra "${t}"`)
  }
})

test('title vazio ou só espaços não gera warning (validar antes)', () => {
  assert.deepEqual(lintChannelTitle('').warnings, [])
  assert.deepEqual(lintChannelTitle('   ').warnings, [])
  assert.deepEqual(lintChannelTitle(null).warnings, [])
})

// ---------- lintCopyTemplate ----------

test('copy sem claims → sem warnings', () => {
  const r = lintCopyTemplate('Confira essa oferta em https://ex.com')
  assert.equal(r.warnings.length, 0)
})

test('copy com X% OFF (2-3 dígitos) → warning claim', () => {
  for (const t of ['80% off', '90 % OFF', '100% Off', 'até 99% off agora']) {
    const r = lintCopyTemplate(t)
    assert.ok(r.warnings.some(w => w.code === LINT_CODES.MISLEADING_CLAIM), `falhou pra "${t}"`)
  }
})

test('copy com "ultima(s) peça(s)" → warning claim', () => {
  for (const t of ['ultima peça', 'últimas peças', 'ULTIMA PECA disponível']) {
    const r = lintCopyTemplate(t)
    assert.ok(r.warnings.some(w => w.code === LINT_CODES.MISLEADING_CLAIM), `falhou pra "${t}"`)
  }
})

test('copy com "clique agora" → warning claim', () => {
  const r = lintCopyTemplate('clique agora antes que acabe')
  assert.ok(r.warnings.some(w => w.code === LINT_CODES.MISLEADING_CLAIM))
})

test('copy vazio não gera warning', () => {
  assert.deepEqual(lintCopyTemplate('').warnings, [])
  assert.deepEqual(lintCopyTemplate(null).warnings, [])
})

test('warning tem shape { code, message, severity }', () => {
  const r = lintChannelTitle('Amazon Brasil')
  const w = r.warnings[0]
  assert.ok(w.code)
  assert.ok(typeof w.message === 'string' && w.message.length > 0)
  assert.equal(w.severity, 'warning')
})
