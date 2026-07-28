import test from 'node:test'
import assert from 'node:assert/strict'
import { AppError, mapInfraError } from '../src/errors.js'

test('405 do WhatsApp vira erro próprio, não o genérico de pareamento', () => {
  // RCA 2026-07-28: o worker devolve "Socket fechado antes de chegar pronto
  // para pairing (code=405)" e isso caía no catch-all WA_PAIRING_FAILED. A
  // cliente lia "Falha ao solicitar código de pareamento" e re-pareava sem
  // parar — destruindo a credencial a cada tentativa — sem nenhuma chance de
  // sucesso, porque a recusa era do servidor do WhatsApp.
  const err = mapInfraError(new Error('Socket fechado antes de chegar pronto para pairing (code=405)'))
  assert.equal(err.code, 'WA_VERSION_REJECTED')
  assert.equal(err.statusCode, 503)
  assert.equal(err.retryable, true)
  assert.match(err.message, /não é problema do seu número/i)
})

test('mensagem do 405 não usa jargão técnico com a usuária', () => {
  const { message } = mapInfraError(new Error('close (405)'))
  for (const jargao of ['405', 'socket', 'handshake', 'Baileys', 'pairing']) {
    assert.equal(
      message.toLowerCase().includes(jargao.toLowerCase()),
      false,
      `"${jargao}" não pode chegar à tela da usuária`
    )
  }
})

test('timeout de pareamento continua com o código próprio dele', () => {
  const err = mapInfraError(new Error('Timeout ao solicitar código de pareamento'))
  assert.equal(err.code, 'WA_PAIRING_TIMEOUT')
  assert.equal(err.statusCode, 504)
})

test('demais infraerros seguem a classificação histórica', () => {
  assert.equal(mapInfraError(new Error('Bot não conectado')).code, 'WA_NOT_CONNECTED')
  assert.equal(mapInfraError(new Error('Connection Closed')).code, 'WA_SESSION_CLOSED')
  assert.equal(mapInfraError(new Error('Bot não disponível')).code, 'WA_PAIRING_UNAVAILABLE')
  assert.equal(mapInfraError(new Error('qualquer outra coisa')).code, 'WA_PAIRING_FAILED')
})

test('AppError já classificado passa intacto', () => {
  const original = new AppError('WA_VERSION_REJECTED', 'x', { statusCode: 503 })
  assert.equal(mapInfraError(original), original)
})
