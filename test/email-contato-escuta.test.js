// Grupo "Contato e escuta": e-mails prontos para perguntar o que travou.
//
// O contrato deste grupo é o que faz ele funcionar: precisa PERGUNTAR alguma
// coisa e precisa deixar os DOIS canais de contato na cara. E-mail de escuta
// sem pergunta é aviso; com pergunta e sem canal de resposta é armadilha.

import test from 'node:test'
import assert from 'node:assert/strict'
import { listTemplateDefinitions, getTemplateDefinition, EMAIL_GROUPS } from '../src/email/registry.js'
import { loadTemplate, renderTemplate, standardVars } from '../src/email/dispatcher.js'

const emptyDb = {
  emailTemplate: { findUnique: async () => null },
  emailOptOut: { findUnique: async () => null },
  analyticsEvent: { count: async () => 0 },
  emailSendLog: { count: async () => 0, create: async () => ({}), update: async () => ({}) },
}

const escuta = () => listTemplateDefinitions().filter((definition) => definition.group === 'contato')

async function render(slug, vars = {}) {
  const template = await loadTemplate({ db: emptyDb, slug })
  return renderTemplate({
    template,
    vars: {
      ...standardVars({ user: { id: 'u1', name: 'Juliane Pumuceno' }, dashboardUrl: 'https://exemplo.com' }),
      ...Object.fromEntries((getTemplateDefinition(slug).variables ?? []).map((v) => [v.name, v.example])),
      ...vars,
    },
    unsubscribeUrl: 'https://exemplo.com/api/emails/unsubscribe?token=t',
  })
}

test('o grupo existe no catálogo e tem e-mail suficiente para escolher', () => {
  assert.equal(EMAIL_GROUPS.contato, 'Contato e escuta')
  assert.ok(escuta().length >= 6, 'grupo de escuta precisa de opção para cada momento')
})

test('todo e-mail de escuta traz WhatsApp E e-mail de suporte', async () => {
  for (const definition of escuta()) {
    const { text, html } = await render(definition.slug)
    assert.match(text, /wa\.me/, `${definition.slug} sem WhatsApp`)
    assert.match(text, /@espelhagrupos\.com\.br/, `${definition.slug} sem e-mail de suporte`)
    assert.match(html, /wa\.me/, `${definition.slug} sem WhatsApp no HTML`)
    assert.match(html, /@espelhagrupos\.com\.br/, `${definition.slug} sem e-mail no HTML`)
  }
})

test('todo e-mail de escuta faz uma pergunta e convida a responder', async () => {
  for (const definition of escuta()) {
    const { subject, text } = await render(definition.slug)
    assert.match(`${subject} ${text}`, /\?/, `${definition.slug} não pergunta nada`)
    assert.match(text, /responder/i, `${definition.slug} não convida a responder`)
  }
})

test('e-mail de escuta é divulgação: respeita descadastro e leva o link', async () => {
  for (const definition of escuta()) {
    assert.equal(definition.category, 'marketing', `${definition.slug} precisa respeitar descadastro`)
    const { text } = await render(definition.slug)
    assert.match(text, /unsubscribe\?token=/, `${definition.slug} sem link de descadastro`)
  }
})

test('escuta é sempre disparo manual: pergunta automática na hora errada queima o canal', () => {
  for (const definition of escuta()) {
    assert.equal(definition.trigger, 'manual', `${definition.slug} não pode ter gatilho automático`)
  }
})

test('nenhum e-mail de escuta cobra, culpa ou promete resultado', async () => {
  const PROIBIDO = [/você (não|nao) fez/i, /culpa sua/i, /garantimos/i, /lucro garantido/i, /última chance/i]
  for (const definition of escuta()) {
    const { subject, text } = await render(definition.slug)
    for (const proibido of PROIBIDO) {
      assert.doesNotMatch(`${subject}\n${text}`, proibido, `tom errado em ${definition.slug}`)
    }
  }
})

test('a janela anti-repetição é longa: ninguém pode ser sondada toda semana', () => {
  for (const definition of escuta()) {
    assert.ok(definition.dedupDays >= 21, `${definition.slug} pode virar spam (dedupDays=${definition.dedupDays})`)
  }
})

test('os dois e-mails com pergunta configurável rendem o texto que a admin escrever', async () => {
  const conversa = await render('contato_convite_conversa', { convite: 'destravar seus grupos de destino' })
  assert.match(conversa.subject, /destravar seus grupos de destino/)
  assert.match(conversa.text, /destravar seus grupos de destino/)

  const pesquisa = await render('contato_pesquisa_rapida', { pergunta: 'o que mais te dá trabalho hoje?' })
  assert.match(pesquisa.text, /o que mais te dá trabalho hoje\?/)
})
