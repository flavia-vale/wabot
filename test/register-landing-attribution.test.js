import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeAttributionValue } from '../src/api/routes/auth.js'

// specs/010-seo-lead-capture (US2/T012): sanitização de `landingPage` -> `landing_page`
// gravado na metadata do evento durável `signup_created` (src/api/routes/auth.js). Sem
// migration de schema; a ausência do campo MUST NOT bloquear o cadastro (FR-005) — o valor
// gravado é apenas string vazia nesse caso. Cobre a mesma regra usada no frontend
// (dashboard/lib/marketing-attribution.js sanitizeAttributionValue), reimplementada no
// backend por serem árvores/pacotes separados sem import compartilhado.

test('landingPage ausente (undefined/null) sanitiza para string vazia', () => {
  assert.equal(sanitizeAttributionValue(undefined), '')
  assert.equal(sanitizeAttributionValue(null), '')
  assert.equal(sanitizeAttributionValue(''), '')
})

test('landingPage com caracteres fora da allowlist é sanitizado', () => {
  const result = sanitizeAttributionValue('/blog/artigo?utm_source=teste&x=<script>')
  // caracteres fora de [\p{L}\p{N}._~:@/-] viram '-', com colapso de '-' repetidos
  assert.ok(!/[<>&=?]/.test(result))
  assert.equal(result, sanitizeAttributionValue(result)) // idempotente/estável
})

test('landingPage muito longa é truncada a 500 chars (default)', () => {
  const long = '/blog/' + 'a'.repeat(600)
  const result = sanitizeAttributionValue(long)
  assert.equal(result.length, 500)
})

test('landingPage válida e curta passa sem alteração de conteúdo semântico', () => {
  const value = '/blog/comecar-afiliado-whatsapp-sem-grupo-grande?utm_source=teste&utm_medium=organic&utm_campaign=lote1'
  const result = sanitizeAttributionValue(value)
  assert.ok(result.startsWith('/blog/comecar-afiliado-whatsapp-sem-grupo-grande'))
  assert.ok(result.length <= 500)
})

test('collapse de traços repetidos não deixa sequências --- na saída', () => {
  const result = sanitizeAttributionValue('/a///b***c')
  assert.ok(!/-{2,}/.test(result))
})
