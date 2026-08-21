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

// --- Os dois e-mails de etiqueta tratam situações OPOSTAS -------------------
//
// Medido em produção (2026-08): 22 pessoas — 32% de quem não pagou — conectaram
// o WhatsApp e nunca cadastraram etiqueta de loja nenhuma. Nesse estado o robô
// se RECUSA a publicar (`skip:no_valid_conversions`, `src/bot-worker.js`), para
// não dar a comissão da venda ao afiliado do grupo de origem. NADA sai.
//
// O e-mail que já existia (`contato_duvida_credenciais`) diz o contrário —
// "suas ofertas continuam saindo, o link só sai mais comprido" — e está certo
// para o caso dele: etiqueta cadastrada que venceu, no ML/Amazon, onde o plano
// B segue publicando. Mandar esse texto para as 22 seria afirmar que as ofertas
// delas estão saindo quando nenhuma saiu.
//
// Mesma lição do texto da Shopee em `credentialExpiry/message.js`: tranquilizar
// quem está tendo prejuízo é pior do que não escrever.

test('quem nunca cadastrou etiqueta NÃO recebe "suas ofertas continuam saindo"', async () => {
  const { text } = await render('contato_sem_etiqueta_nada_sai')

  assert.doesNotMatch(
    text,
    /continuam? saindo|continua sendo sua|link (só sai )?mais comprido/i,
    'o texto de "nada sai" não pode tranquilizar como o de etiqueta vencida — para quem nunca cadastrou, nenhuma oferta foi publicada'
  )
  assert.match(
    text,
    /n[ãa]o publica (nenhuma oferta|nada)/i,
    'precisa dizer com todas as letras que nada é publicado — é essa informação que falta para a pessoa'
  )
  assert.match(
    text,
    /de prop[óo]sito|n[ãa]o [ée] defeito/i,
    'precisa explicar que é decisão do robô, não defeito — sem isso a pessoa continua achando que o produto está quebrado'
  )
})

test('o e-mail de etiqueta VENCIDA continua tranquilizando (não inverter os dois)', async () => {
  const { text } = await render('contato_duvida_credenciais')
  assert.match(text, /continuam saindo/i, 'para etiqueta vencida no ML/Amazon o plano B segue publicando — este texto tem que continuar dizendo isso')
  assert.doesNotMatch(text, /n[ãa]o publica (nenhuma oferta|nada)/i, 'este e-mail não é o de "nada sai"')
})

test('os dois textos de etiqueta não são o mesmo texto', async () => {
  const vencida = await render('contato_duvida_credenciais')
  const nunca = await render('contato_sem_etiqueta_nada_sai')
  assert.notEqual(vencida.text, nunca.text, 'os dois e-mails foram fundidos — são situações opostas')
  assert.notEqual(vencida.subject, nunca.subject)
})

test('o e-mail de "nada sai" leva para a tela de cadastrar etiqueta, sem URL colada na mão', async () => {
  const definicao = getTemplateDefinition('contato_sem_etiqueta_nada_sai')
  assert.match(definicao.body, /\{\{link_lojas\}\}/, 'usar a variável, não colar a URL — a rota muda e o texto fica quebrado em silêncio')

  const { text } = await render('contato_sem_etiqueta_nada_sai')
  assert.match(text, /painel\/ids-afiliada/, 'o link renderizado precisa apontar para a tela de etiquetas')
})
