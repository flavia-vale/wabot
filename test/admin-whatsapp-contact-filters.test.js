import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseWhatsappContactFilters,
  matchesWhatsappContactFilters,
  isEligibleForBulkSend,
} from '../src/domain/admin/whatsappContactFilters.js'

test('sem query, os 3 filtros caem em "any"', () => {
  assert.deepEqual(parseWhatsappContactFilters(), { connected: 'any', everSent: 'any', hasCredential: 'any' })
})

test('valor de lixo cai em "any" (nunca quebra, nunca esconde tudo)', () => {
  assert.deepEqual(
    parseWhatsappContactFilters({ connected: 'sim', everSent: '', hasCredential: 123 }),
    { connected: 'any', everSent: 'any', hasCredential: 'any' },
  )
})

test('"any" sempre passa, independente do fato', () => {
  const filtros = parseWhatsappContactFilters()
  assert.equal(matchesWhatsappContactFilters({ connected: true, everSentSuccess: true, hasCredential: true }, filtros), true)
  assert.equal(matchesWhatsappContactFilters({ connected: false, everSentSuccess: false, hasCredential: false }, filtros), true)
})

test('o caso da campanha: conectado + nunca enviou (credencial não importa)', () => {
  const filtros = parseWhatsappContactFilters({ connected: 'yes', everSent: 'no' })
  assert.equal(matchesWhatsappContactFilters({ connected: true, everSentSuccess: false, hasCredential: false }, filtros), true)
  assert.equal(matchesWhatsappContactFilters({ connected: true, everSentSuccess: false, hasCredential: true }, filtros), true)
  assert.equal(matchesWhatsappContactFilters({ connected: true, everSentSuccess: true, hasCredential: false }, filtros), false, 'já enviou não pode entrar')
  assert.equal(matchesWhatsappContactFilters({ connected: false, everSentSuccess: false, hasCredential: false }, filtros), false, 'desconectado não pode entrar')
})

test('sem credencial cadastrada', () => {
  const filtros = parseWhatsappContactFilters({ hasCredential: 'no' })
  assert.equal(matchesWhatsappContactFilters({ connected: true, everSentSuccess: true, hasCredential: false }, filtros), true)
  assert.equal(matchesWhatsappContactFilters({ connected: true, everSentSuccess: true, hasCredential: true }, filtros), false)
})

test('elegível para envio em massa exige conexão AGORA, mesmo com filtro connected=any', () => {
  assert.equal(isEligibleForBulkSend({ connected: true }), true)
  assert.equal(isEligibleForBulkSend({ connected: false }), false)
  assert.equal(isEligibleForBulkSend({}), false)
})
