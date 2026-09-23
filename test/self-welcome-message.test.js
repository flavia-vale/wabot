import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SELF_WELCOME_PILOT_EMAILS,
  resolveSelfWelcomePilotEmails,
  shouldSendSelfWelcomeMessage,
  buildSelfWelcomeMessageText,
} from '../src/core/selfWelcomeMessage.js'

test('sem env, o piloto é a lista padrão do código', () => {
  assert.deepEqual(resolveSelfWelcomePilotEmails({}), [...DEFAULT_SELF_WELCOME_PILOT_EMAILS])
})

test('env vazia desliga o piloto pra todo mundo', () => {
  assert.deepEqual(resolveSelfWelcomePilotEmails({ SELF_WELCOME_MESSAGE_PILOT_EMAILS: '' }), [])
})

test('env presente SUBSTITUI a lista, normalizando espaço e caixa', () => {
  assert.deepEqual(
    resolveSelfWelcomePilotEmails({ SELF_WELCOME_MESSAGE_PILOT_EMAILS: ' Foo@Bar.com , baz@qux.com ' }),
    ['foo@bar.com', 'baz@qux.com'],
  )
})

test('nunca manda pra quem já conectou antes (hadPhoneBefore)', () => {
  assert.equal(
    shouldSendSelfWelcomeMessage({ accountEmail: 'flavia.vale@usp.br', hadPhoneBefore: true, pilotEmails: ['flavia.vale@usp.br'] }),
    false,
  )
})

test('manda só pra e-mail dentro do piloto', () => {
  assert.equal(
    shouldSendSelfWelcomeMessage({ accountEmail: 'outra@conta.com', hadPhoneBefore: false, pilotEmails: ['flavia.vale@usp.br'] }),
    false,
  )
  assert.equal(
    shouldSendSelfWelcomeMessage({ accountEmail: 'Flavia.Vale@USP.BR', hadPhoneBefore: false, pilotEmails: ['flavia.vale@usp.br'] }),
    true,
  )
})

test('fail-safe: sem e-mail, sem piloto ou piloto vazio nunca manda', () => {
  assert.equal(shouldSendSelfWelcomeMessage({ accountEmail: null, hadPhoneBefore: false, pilotEmails: ['a@b.com'] }), false)
  assert.equal(shouldSendSelfWelcomeMessage({ accountEmail: 'a@b.com', hadPhoneBefore: false, pilotEmails: [] }), false)
  assert.equal(shouldSendSelfWelcomeMessage({ accountEmail: 'a@b.com', hadPhoneBefore: false, pilotEmails: undefined }), false)
})

test('o texto não promete que o robô vai falar com outra pessoa', () => {
  const texto = buildSelfWelcomeMessageText({ videoUrl: 'https://youtu.be/x' })
  assert.match(texto, /conectado/i)
  assert.match(texto, /https:\/\/youtu\.be\/x/)
  assert.doesNotMatch(texto, /grupo|contato/i)
})

test('o texto funciona também sem vídeo (não quebra em template vazio)', () => {
  const texto = buildSelfWelcomeMessageText({})
  assert.ok(texto.length > 10)
})
