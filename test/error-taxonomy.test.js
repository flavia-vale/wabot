import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyError,
  categorizeErrorMsg,
  isBenignSkip,
  ERROR_CATEGORIES,
} from '../src/errorTaxonomy.js'

test('classifyError mapeia SEND_MESSAGE_TIMEOUT para timeout:send com destJid', () => {
  const err = Object.assign(new Error('sendMessage timeout após 60000ms'), {
    code: 'SEND_MESSAGE_TIMEOUT',
  })
  const result = classifyError(err, { destJid: '120363@newsletter' })
  assert.equal(result, 'timeout:send:120363@newsletter')
})

test('classifyError detecta timeout da incomingQueue por padrão de mensagem', () => {
  const err = new Error('timeout 15000ms: msg:ABC123')
  assert.equal(classifyError(err), 'timeout:incoming')
})

test('classifyError preserva skip:decrypt_failed para erros de libsignal', () => {
  const err = new Error('Bad MAC ao decodificar mensagem do grupo')
  const result = classifyError(err)
  assert.match(result, /^skip:decrypt_failed:/)
})

test('classifyError aceita context.kind para casos sem exception', () => {
  assert.equal(classifyError(null, { kind: 'queue_full' }), 'error:queue_full')
  assert.equal(classifyError(null, { kind: 'worker_restart' }), 'error:worker_restart')
  assert.equal(classifyError(null, { kind: 'channel_forbidden' }), 'error:channel_forbidden')
  assert.equal(classifyError(null, { kind: 'send_stuck' }), 'timeout:send:stuck')
  assert.equal(classifyError(null, { kind: 'queue_cleared' }), 'skip:queue_cleared')
})

test('skip:queue_cleared é skip benigno (config_block, pinta cinza)', () => {
  assert.equal(categorizeErrorMsg('skip:queue_cleared'), ERROR_CATEGORIES.CONFIG_BLOCK)
  assert.equal(isBenignSkip('skip:queue_cleared'), true)
})

test('classifyError mapeia statusCode Boom para error:baileys:<code>', () => {
  const err = Object.assign(new Error('Forbidden'), {
    output: { statusCode: 403 },
  })
  assert.equal(classifyError(err), 'error:baileys:403')
})

test('classifyError detecta CHANNEL_THROTTLED por code ou mensagem', () => {
  assert.equal(classifyError({ code: 'CHANNEL_THROTTLED', message: 'x' }), 'error:channel_throttled')
  assert.equal(classifyError(new Error('Canal throttled (jid=foo)')), 'error:channel_throttled')
})

test('classifyError em incoming sem padrão conhecido vira skip:incoming_error', () => {
  const result = classifyError(new Error('algum erro genérico'), { kind: 'incoming' })
  assert.match(result, /^skip:incoming_error:algum erro/)
})

test('classifyError com erro desconhecido vira error:other:<detalhe>', () => {
  const result = classifyError(new Error('coisa nova quebrou'))
  assert.match(result, /^error:other:coisa nova quebrou/)
})

test('categorizeErrorMsg agrupa proteções como categoria correta', () => {
  assert.equal(categorizeErrorMsg('skip:dedup_recent_link'), ERROR_CATEGORIES.DEDUP)
  assert.equal(categorizeErrorMsg('skip:dedup_recent_link_global'), ERROR_CATEGORIES.DEDUP)
  assert.equal(categorizeErrorMsg('skip:title_mismatch'), ERROR_CATEGORIES.CONFIG_BLOCK)
  assert.equal(categorizeErrorMsg('skip:blocked_keyword'), ERROR_CATEGORIES.CONFIG_BLOCK)
  assert.equal(categorizeErrorMsg('skip:text_too_large'), ERROR_CATEGORIES.CONFIG_BLOCK)
})

test('categorizeErrorMsg agrupa timeouts e erros operacionais', () => {
  assert.equal(categorizeErrorMsg('timeout:send:foo@s.whatsapp.net'), ERROR_CATEGORIES.TIMEOUT)
  assert.equal(categorizeErrorMsg('timeout:send:stuck'), ERROR_CATEGORIES.TIMEOUT)
  assert.equal(categorizeErrorMsg('timeout:incoming'), ERROR_CATEGORIES.TIMEOUT)
  assert.equal(categorizeErrorMsg('error:channel_forbidden'), ERROR_CATEGORIES.CHANNEL_FORBIDDEN)
  assert.equal(categorizeErrorMsg('error:queue_full'), ERROR_CATEGORIES.QUEUE_FULL)
  assert.equal(categorizeErrorMsg('error:baileys:403'), ERROR_CATEGORIES.BAILEYS)
  assert.equal(categorizeErrorMsg('error:conversion:Sem credenciais Amazon'), ERROR_CATEGORIES.CONVERSION)
  assert.equal(categorizeErrorMsg('error:other:bug X'), ERROR_CATEGORIES.OTHER)
})

test('categorizeErrorMsg tolera strings legadas livres', () => {
  assert.equal(categorizeErrorMsg(''), ERROR_CATEGORIES.UNKNOWN)
  assert.equal(categorizeErrorMsg(null), ERROR_CATEGORIES.UNKNOWN)
  assert.equal(categorizeErrorMsg('Falha desconhecida do passado'), ERROR_CATEGORIES.UNKNOWN)
})

test('isBenignSkip identifica proteções (não falhas reais)', () => {
  assert.equal(isBenignSkip('skip:dedup_recent_link'), true)
  assert.equal(isBenignSkip('skip:blocked_keyword'), true)
  assert.equal(isBenignSkip('skip:title_mismatch'), true)
  assert.equal(isBenignSkip('timeout:send:foo'), false)
  assert.equal(isBenignSkip('error:baileys:500'), false)
  assert.equal(isBenignSkip('skip:decrypt_failed:bad mac'), false)
})
