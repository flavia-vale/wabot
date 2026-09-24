import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SELF_WELCOME_PILOT_EMAILS,
  resolveSelfWelcomePilotEmails,
  isPilotEmail,
  shouldSendSelfWelcomeMessage,
  decideActivationNudge,
  formatSupportPhoneDisplay,
  buildSelfMessageEnvelope,
  buildSelfWelcomeMessageText,
  buildFirstOfferPublishedMessageText,
  buildMissingCredentialNudgeText,
  buildMissingGroupsNudgeText,
  buildAdminSupportMessageText,
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

test('isPilotEmail: só e-mail dentro da lista, normalizando caixa', () => {
  assert.equal(isPilotEmail('Flavia.Vale@USP.BR', ['flavia.vale@usp.br']), true)
  assert.equal(isPilotEmail('outra@conta.com', ['flavia.vale@usp.br']), false)
  assert.equal(isPilotEmail(null, ['flavia.vale@usp.br']), false)
  assert.equal(isPilotEmail('a@b.com', []), false)
  assert.equal(isPilotEmail('a@b.com', undefined), false)
})

test('formatSupportPhoneDisplay deriva (32) 99984-4020 do link de wa.me', () => {
  assert.equal(formatSupportPhoneDisplay('https://wa.me/5532999844020'), '(32) 99984-4020')
})

test('nunca manda boas-vindas pra quem já conectou antes (hadPhoneBefore)', () => {
  assert.equal(
    shouldSendSelfWelcomeMessage({ accountEmail: 'flavia.vale@usp.br', hadPhoneBefore: true, pilotEmails: ['flavia.vale@usp.br'] }),
    false,
  )
})

test('boas-vindas manda só pra e-mail dentro do piloto', () => {
  assert.equal(
    shouldSendSelfWelcomeMessage({ accountEmail: 'outra@conta.com', hadPhoneBefore: false, pilotEmails: ['flavia.vale@usp.br'] }),
    false,
  )
  assert.equal(
    shouldSendSelfWelcomeMessage({ accountEmail: 'Flavia.Vale@USP.BR', hadPhoneBefore: false, pilotEmails: ['flavia.vale@usp.br'] }),
    true,
  )
})

test('envelope: título em negrito, subtítulo em itálico com a marca, rodapé com o suporte', () => {
  const texto = buildSelfMessageEnvelope({ titulo: 'Título', corpo: 'Corpo aqui' })
  assert.match(texto, /^\*Título\*\n_Essa é uma mensagem do Espelha Grupos_\n\n/)
  assert.match(texto, /Corpo aqui/)
  assert.match(texto, /Qualquer dúvida acione nosso suporte no número \(32\) 99984-4020\.$/)
  assert.doesNotMatch(texto, /não fala com mais ninguém|continua sem falar/)
})

test('envelope com vídeo inclui a linha do vídeo entre o corpo e o rodapé', () => {
  const texto = buildSelfMessageEnvelope({ titulo: 'T', corpo: 'C', videoUrl: 'https://youtu.be/x' })
  assert.match(texto, /🎥 Vídeo mostrando como: https:\/\/youtu\.be\/x/)
})

test('as 4 mensagens usam o envelope (título + rodapé com suporte) e as 2 com vídeo trazem o link', () => {
  const boasVindas = buildSelfWelcomeMessageText({ videoUrl: 'https://youtu.be/etiquetas' })
  const primeiraOferta = buildFirstOfferPublishedMessageText()
  const semEtiqueta = buildMissingCredentialNudgeText({ videoUrl: 'https://youtu.be/etiquetas' })
  const semGrupo = buildMissingGroupsNudgeText({ videoUrl: 'https://youtu.be/ativacao' })

  for (const texto of [boasVindas, primeiraOferta, semEtiqueta, semGrupo]) {
    assert.match(texto, /^\*.+\*\n_Essa é uma mensagem do Espelha Grupos_/)
    assert.match(texto, /suporte no número \(32\) 99984-4020\./)
  }
  assert.match(boasVindas, /youtu\.be\/etiquetas/)
  assert.match(semEtiqueta, /youtu\.be\/etiquetas/)
  assert.match(semGrupo, /youtu\.be\/ativacao/)
  assert.doesNotMatch(primeiraOferta, /🎥/)
})

test('decideActivationNudge: fora do piloto nunca decide nada', () => {
  assert.equal(
    decideActivationNudge({ accountEmail: 'outra@conta.com', pilotEmails: ['flavia.vale@usp.br'], connectedForMs: 999999999, hasCredential: false, hasGroups: false }),
    null,
  )
})

test('decideActivationNudge: antes da janela mínima, nada', () => {
  assert.equal(
    decideActivationNudge({
      accountEmail: 'flavia.vale@usp.br', pilotEmails: ['flavia.vale@usp.br'],
      connectedForMs: 60_000, minDelayMs: 24 * 60 * 60 * 1000, hasCredential: false, hasGroups: false,
    }),
    null,
  )
})

test('decideActivationNudge: sem credencial vem ANTES de sem grupo (mesma ordem dos e-mails de ciclo de vida)', () => {
  const base = { accountEmail: 'flavia.vale@usp.br', pilotEmails: ['flavia.vale@usp.br'], connectedForMs: 25 * 60 * 60 * 1000, minDelayMs: 24 * 60 * 60 * 1000 }
  assert.equal(decideActivationNudge({ ...base, hasCredential: false, hasGroups: false }), 'missing_credential')
  assert.equal(decideActivationNudge({ ...base, hasCredential: true, hasGroups: false }), 'missing_groups')
  assert.equal(decideActivationNudge({ ...base, hasCredential: true, hasGroups: true }), null)
})

test('decideActivationNudge: cada nudge só dispara uma vez', () => {
  const base = { accountEmail: 'flavia.vale@usp.br', pilotEmails: ['flavia.vale@usp.br'], connectedForMs: 25 * 60 * 60 * 1000, minDelayMs: 24 * 60 * 60 * 1000 }
  assert.equal(decideActivationNudge({ ...base, hasCredential: false, hasGroups: false, sentCredentialNudge: true }), null)
  assert.equal(decideActivationNudge({ ...base, hasCredential: true, hasGroups: false, sentGroupsNudge: true }), null)
})

test('decideActivationNudge: sem sinal confiável de conexão, nunca decide (fail-safe)', () => {
  assert.equal(
    decideActivationNudge({ accountEmail: 'flavia.vale@usp.br', pilotEmails: ['flavia.vale@usp.br'], connectedForMs: null, hasCredential: false, hasGroups: false }),
    null,
  )
})

test('mensagem manual do suporte: título fixo, corpo é o que a admin escreveu, sem pilot', () => {
  const texto = buildAdminSupportMessageText({ corpo: 'Oi! Vi que você teve uma dúvida, posso ajudar?' })
  assert.match(texto, /^\*💬 Mensagem do suporte\*/)
  assert.match(texto, /Oi! Vi que você teve uma dúvida, posso ajudar\?/)
  assert.match(texto, /suporte no número \(32\) 99984-4020\./)
})

test('mensagem manual do suporte tolera espaço/undefined no corpo', () => {
  assert.doesNotThrow(() => buildAdminSupportMessageText({ corpo: '  texto  ' }))
  assert.doesNotThrow(() => buildAdminSupportMessageText({}))
})
