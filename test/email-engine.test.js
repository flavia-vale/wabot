// Motor de e-mails (fase 2): formato do texto, moldura, travas do despachante
// e fila de disparo em massa. Nada de banco, rede ou SMTP de verdade.

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyVariables, extractVariables, renderBody, escapeHtml } from '../src/email/markup.js'
import { wrapEmail } from '../src/email/layout.js'
import { listTemplateDefinitions, getTemplateDefinition, variablesForTemplate, EMAIL_CATEGORIES, EMAIL_GROUPS } from '../src/email/registry.js'
import { isRealEmail, isDeliverableUser, loadTemplate, renderTemplate, sendTemplateEmail, standardVars } from '../src/email/dispatcher.js'
import { enqueueEmailBatch, runEmailQueueTick, cancelEmailBatch } from '../src/email/queue.js'
import { buildUnsubscribeUrl, verifyUnsubscribeToken } from '../src/email/optOut.js'

const NOW = new Date('2026-08-16T12:00:00Z')
const silentLogger = { info() {}, warn() {}, error() {} }

// ------------------------------------------------------------------ markup

test('variáveis são trocadas e as sem valor são reportadas', () => {
  const { output, missing } = applyVariables('Olá, {{primeiro_nome}}! Vence {{data}}.', { primeiro_nome: 'Ana' })
  assert.equal(output, 'Olá, Ana! Vence .')
  assert.deepEqual(missing, ['data'])
})

test('extractVariables lista sem repetir', () => {
  assert.deepEqual(extractVariables('{{a}} {{b}} {{a}}'), ['a', 'b'])
})

test('parágrafos, listas e botão viram texto e HTML', () => {
  const { text, html } = renderBody(`Primeiro parágrafo.

- um
- dois

1. passo um
2. passo dois

[[botao:Abrir painel|https://exemplo.com/painel]]`)
  assert.match(text, /Primeiro parágrafo\./)
  assert.match(text, /- um/)
  assert.match(text, /1\. passo um/)
  assert.match(text, /Abrir painel: https:\/\/exemplo\.com\/painel/)
  assert.match(html, /<p style[^>]*>Primeiro parágrafo\.<\/p>/)
  assert.match(html, /<ul[^>]*><li[^>]*>um<\/li>/)
  assert.match(html, /<ol[^>]*><li[^>]*>passo um<\/li>/)
  assert.match(html, /<a href="https:\/\/exemplo\.com\/painel"[^>]*>Abrir painel<\/a>/)
})

test('negrito e link no meio da frase', () => {
  const { text, html } = renderBody('Vale até **domingo**, veja [os planos](https://exemplo.com/planos).')
  assert.match(text, /Vale até domingo, veja os planos: https:\/\/exemplo\.com\/planos\./)
  assert.match(html, /<strong>domingo<\/strong>/)
  assert.match(html, /<a href="https:\/\/exemplo\.com\/planos"/)
})

test('texto da admin não consegue injetar HTML', () => {
  const { html } = renderBody('<script>alert(1)</script> e <b>negrito falso</b>')
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
  assert.equal(escapeHtml('a & b'), 'a &amp; b')
})

test('link com esquema perigoso perde o destino', () => {
  const { html } = renderBody('[clique](javascript:alert(1))')
  assert.doesNotMatch(html, /javascript:/)
  assert.match(html, /href="#"/)
})

// ------------------------------------------------------------------ moldura

test('e-mail transacional NÃO leva descadastro; marketing leva', () => {
  const transacional = wrapEmail({ title: 'Oi', body: 'corpo', category: 'transactional', unsubscribeUrl: 'https://x.com/u' })
  assert.doesNotMatch(transacional.text, /Descadastre/i)
  assert.doesNotMatch(transacional.html, /Descadastre/i)

  const marketing = wrapEmail({ title: 'Oi', body: 'corpo', category: 'marketing', unsubscribeUrl: 'https://x.com/u' })
  assert.match(marketing.text, /Descadastre-se: https:\/\/x\.com\/u/)
  assert.match(marketing.html, /Descadastre-se aqui/)
})

test('toda mensagem é assinada pela equipe', () => {
  const { text, html } = wrapEmail({ body: 'corpo' })
  assert.match(text, /Equipe BOTinho/)
  assert.match(html, /Equipe BOTinho/)
})

// ------------------------------------------------------------------ catálogo

test('catálogo: todo e-mail tem categoria, grupo e assunto válidos', () => {
  const definitions = listTemplateDefinitions()
  assert.ok(definitions.length > 0)
  const slugs = new Set()
  for (const definition of definitions) {
    assert.ok(!slugs.has(definition.slug), `slug repetido: ${definition.slug}`)
    slugs.add(definition.slug)
    assert.ok(EMAIL_CATEGORIES.includes(definition.category), `categoria inválida em ${definition.slug}`)
    assert.ok(EMAIL_GROUPS[definition.group], `grupo inválido em ${definition.slug}`)
    assert.ok(definition.subject.trim(), `assunto vazio em ${definition.slug}`)
    assert.ok(definition.body.trim(), `corpo vazio em ${definition.slug}`)
    assert.ok(definition.name.trim(), `nome vazio em ${definition.slug}`)
  }
})

test('catálogo: toda variável usada no texto está declarada', () => {
  const padrao = new Set(variablesForTemplate('boas_vindas').map((v) => v.name))
  for (const definition of listTemplateDefinitions()) {
    const declaradas = new Set(variablesForTemplate(definition.slug).map((v) => v.name))
    for (const usada of [...extractVariables(definition.subject), ...extractVariables(definition.title ?? ''), ...extractVariables(definition.body)]) {
      assert.ok(declaradas.has(usada) || padrao.has(usada), `variável {{${usada}}} não declarada em ${definition.slug}`)
    }
  }
})

// O texto é parte do produto: jargão técnico não chega na cliente.
const JARGAO_PROIBIDO = [/cookie/i, /ssid/i, /\btoken\b/i, /\?tag=/, /partner_id/i, /endpoint|payload|fallback/i]

test('catálogo: nenhum e-mail usa jargão técnico', () => {
  for (const definition of listTemplateDefinitions()) {
    const visivel = `${definition.subject}\n${definition.title ?? ''}\n${definition.body}`
    for (const proibido of JARGAO_PROIBIDO) {
      assert.doesNotMatch(visivel, proibido, `jargão em ${definition.slug}`)
    }
  }
})

// ------------------------------------------------------------------ despachante

test('e-mail fabricado e conta banida não são destinatários válidos', () => {
  assert.equal(isRealEmail('a@b.com'), true)
  assert.equal(isRealEmail('user_ab12@sistema.com'), false)
  assert.equal(isDeliverableUser({ email: 'a@b.com', status: 'active' }), true)
  assert.equal(isDeliverableUser({ email: 'a@b.com', status: 'banned' }), false)
  assert.equal(isDeliverableUser({ email: 'a@b.com', status: 'suspended' }), false)
})

test('standardVars monta primeiro nome e links do painel', () => {
  const vars = standardVars({ user: { name: 'Juliane Pumuceno' }, dashboardUrl: 'https://x.com' })
  assert.equal(vars.primeiro_nome, 'Juliane')
  assert.equal(vars.link_login, 'https://x.com/login')
  assert.equal(vars.marca, 'BOTinho')
})

function makeDb({ templates = [], logs = [], optOuts = [], users = [], batches = [] } = {}) {
  let seq = 0
  const nextId = () => `id-${++seq}`
  const db = {
    logs,
    batches,
    emailTemplate: {
      findUnique: async ({ where }) => templates.find((t) => t.slug === where.slug) ?? null,
    },
    emailOptOut: {
      findUnique: async ({ where }) => optOuts.find((o) => o.userId === where.userId_category.userId && o.category === where.userId_category.category) ?? null,
      upsert: async ({ create }) => { optOuts.push(create); return create },
    },
    analyticsEvent: { count: async () => 0 },
    emailSendLog: {
      count: async ({ where }) => logs.filter((row) => matchLog(row, where)).length,
      findMany: async ({ where, take }) => logs.filter((row) => matchLog(row, where)).slice(0, take ?? 100),
      create: async ({ data }) => { const row = { id: nextId(), ...data }; logs.push(row); return row },
      update: async ({ where, data }) => {
        const row = logs.find((r) => r.id === where.id)
        if (row) Object.assign(row, data)
        return row
      },
      updateMany: async ({ where, data }) => {
        const matched = logs.filter((row) => matchLog(row, where))
        for (const row of matched) Object.assign(row, data)
        return { count: matched.length }
      },
    },
    emailBatch: {
      create: async ({ data }) => { const row = { id: nextId(), ...data }; batches.push(row); return row },
      findMany: async ({ where }) => batches.filter((b) => !where?.status || b.status === where.status),
      update: async ({ where, data }) => {
        const row = batches.find((b) => b.id === where.id)
        if (row) Object.assign(row, data)
        return row
      },
    },
    user: { findUnique: async ({ where }) => users.find((u) => u.id === where.id) ?? null },
  }
  return db
}

function matchLog(row, where = {}) {
  if (where.slug && row.slug !== where.slug) return false
  if (where.status && row.status !== where.status) return false
  if ('userId' in where && row.userId !== where.userId) return false
  if ('email' in where && row.email !== where.email) return false
  if ('batchId' in where && row.batchId !== where.batchId) return false
  if (where.createdAt?.gte && new Date(row.createdAt ?? NOW) < new Date(where.createdAt.gte)) return false
  if (where.scheduledAt?.lte && new Date(row.scheduledAt ?? NOW) > new Date(where.scheduledAt.lte)) return false
  return true
}

const activeUser = { id: 'u1', name: 'Juliane', email: 'juliane@exemplo.com', status: 'active' }

function collectMails() {
  const sent = []
  return { sent, sendMail: async (msg) => { sent.push(msg); return { skipped: false, messageId: 'x' } } }
}

test('envio simples grava histórico e usa o texto do catálogo', async () => {
  const db = makeDb()
  const { sent, sendMail } = collectMails()
  const result = await sendTemplateEmail({
    db, sendMail, slug: 'boas_vindas', user: activeUser,
    vars: { fim_do_teste: '23/08/2026' }, now: NOW, logger: silentLogger, secret: 's',
  })
  assert.equal(result.sent, true)
  assert.equal(sent.length, 1)
  assert.match(sent[0].subject, /Bem-vinda ao BOTinho/)
  assert.match(sent[0].text, /Olá, Juliane!/)
  assert.match(sent[0].text, /23\/08\/2026/)
  assert.equal(db.logs.length, 1)
  assert.equal(db.logs[0].status, 'sent')
})

test('override do painel troca assunto e texto; sem override vale o do código', async () => {
  const db = makeDb({ templates: [{ slug: 'boas_vindas', subject: 'Assunto novo {{primeiro_nome}}', body: 'Corpo novo', enabled: true }] })
  const template = await loadTemplate({ db, slug: 'boas_vindas' })
  assert.equal(template.subject, 'Assunto novo {{primeiro_nome}}')
  assert.equal(template.customized, true)
  const rendered = renderTemplate({ template, vars: standardVars({ user: activeUser }) })
  assert.equal(rendered.subject, 'Assunto novo Juliane')

  const semOverride = await loadTemplate({ db: makeDb(), slug: 'boas_vindas' })
  assert.equal(semOverride.customized, false)
  assert.match(semOverride.subject, /Bem-vinda/)
})

test('e-mail desligado no painel não sai', async () => {
  const db = makeDb({ templates: [{ slug: 'boas_vindas', subject: 'x', body: 'y', enabled: false }] })
  const { sent, sendMail } = collectMails()
  const result = await sendTemplateEmail({ db, sendMail, slug: 'boas_vindas', user: activeUser, now: NOW, logger: silentLogger })
  assert.equal(result.reason, 'template_disabled')
  assert.equal(sent.length, 0)
})

test('anti-repetição: o mesmo e-mail não sai duas vezes na janela', async () => {
  const db = makeDb({ logs: [{ id: 'l1', slug: 'promocao_relampago', userId: 'u1', status: 'sent', createdAt: new Date(NOW.getTime() - 2 * 86400000) }] })
  const { sent, sendMail } = collectMails()
  const result = await sendTemplateEmail({ db, sendMail, slug: 'promocao_relampago', user: activeUser, now: NOW, logger: silentLogger, secret: 's' })
  assert.equal(result.reason, 'already_sent')
  assert.equal(sent.length, 0)
})

test('marketing respeita descadastro; transacional ignora', async () => {
  const optOuts = [{ userId: 'u1', category: 'marketing' }]
  const { sent, sendMail } = collectMails()

  const marketing = await sendTemplateEmail({ db: makeDb({ optOuts }), sendMail, slug: 'promocao_relampago', user: activeUser, now: NOW, logger: silentLogger, secret: 's' })
  assert.equal(marketing.reason, 'opted_out')

  const transacional = await sendTemplateEmail({ db: makeDb({ optOuts }), sendMail, slug: 'boas_vindas', user: activeUser, vars: { fim_do_teste: 'x' }, now: NOW, logger: silentLogger, secret: 's' })
  assert.equal(transacional.sent, true)
  assert.equal(sent.length, 1)
})

test('e-mail de marketing sai com link de descadastro que valida', async () => {
  const db = makeDb()
  const { sent, sendMail } = collectMails()
  await sendTemplateEmail({
    db, sendMail, slug: 'promocao_relampago', user: activeUser,
    vars: { oferta: '40% de desconto', validade: 'só até domingo' },
    now: NOW, logger: silentLogger, secret: 'segredo',
  })
  const link = sent[0].text.match(/https?:\/\/\S*unsubscribe\?token=([^\s]+)/)
  assert.ok(link, 'e-mail de marketing precisa ter link de descadastro')
  assert.deepEqual(verifyUnsubscribeToken(decodeURIComponent(link[1]), 'segredo'), { userId: 'u1' })
  assert.equal(verifyUnsubscribeToken(decodeURIComponent(link[1]), 'outro'), null)
})

test('buildUnsubscribeUrl aponta para a rota pública', () => {
  const url = buildUnsubscribeUrl({ userId: 'u1', secret: 's', baseUrl: 'https://x.com/' })
  assert.match(url, /^https:\/\/x\.com\/api\/emails\/unsubscribe\?token=/)
})

test('sem SMTP nada é gravado como enviado', async () => {
  const db = makeDb()
  const result = await sendTemplateEmail({
    db, sendMail: async () => ({ skipped: true }), slug: 'boas_vindas', user: activeUser,
    vars: { fim_do_teste: 'x' }, now: NOW, logger: silentLogger,
  })
  assert.equal(result.reason, 'smtp_disabled')
  assert.equal(db.logs.length, 0)
})

test('teto diário segura o envio', async () => {
  const logs = Array.from({ length: 3 }, (_, i) => ({ id: `l${i}`, slug: 'x', userId: `u${i}`, status: 'sent', createdAt: NOW }))
  const db = makeDb({ logs })
  const { sent, sendMail } = collectMails()
  process.env.EMAIL_DAILY_CAP = '3'
  try {
    const result = await sendTemplateEmail({ db, sendMail, slug: 'boas_vindas', user: activeUser, vars: { fim_do_teste: 'x' }, now: NOW, logger: silentLogger })
    assert.equal(result.reason, 'daily_cap')
    assert.equal(sent.length, 0)
  } finally {
    delete process.env.EMAIL_DAILY_CAP
  }
})

// RCA 2026-09 (recuperação de senha por e-mail não chegava): o teto diário
// existe para os disparos em massa, que voltam na próxima virada das 8h. O
// e-mail de nova senha não volta — o gatilho é dispare-e-esqueça —, então num
// dia de campanha grande a recuperação simplesmente parava de funcionar, em
// silêncio. Não voltar a submeter `recuperar_senha` ao teto.
test('teto diário NÃO segura o e-mail de nova senha', async () => {
  const logs = Array.from({ length: 3 }, (_, i) => ({ id: `l${i}`, slug: 'x', userId: `u${i}`, status: 'sent', createdAt: NOW }))
  const db = makeDb({ logs })
  const { sent, sendMail } = collectMails()
  process.env.EMAIL_DAILY_CAP = '3'
  try {
    const result = await sendTemplateEmail({
      db, sendMail, slug: 'recuperar_senha', user: activeUser,
      vars: { link_nova_senha: 'https://exemplo.com/nova-senha?c=abc', validade_link: '60 minutos' },
      now: NOW, logger: silentLogger,
    })
    assert.equal(result.sent, true)
    assert.equal(sent.length, 1)
    assert.match(sent[0].text, /nova-senha\?c=abc/)
  } finally {
    delete process.env.EMAIL_DAILY_CAP
  }
})

// O caminho do teto devolvia `retryLater` e ia embora sem gravar nada. Para um
// item de fila isso está certo (ele volta amanhã); para um gatilho
// dispare-e-esqueça é descarte de fato, e sem linha no histórico fica
// impossível descobrir por que o e-mail nunca chegou.
test('teto diário em gatilho sem fila deixa rastro no histórico', async () => {
  const logs = Array.from({ length: 3 }, (_, i) => ({ id: `l${i}`, slug: 'x', userId: `u${i}`, status: 'sent', createdAt: NOW }))
  const db = makeDb({ logs })
  const { sendMail } = collectMails()
  process.env.EMAIL_DAILY_CAP = '3'
  try {
    await sendTemplateEmail({ db, sendMail, slug: 'boas_vindas', user: activeUser, vars: { fim_do_teste: 'x' }, now: NOW, logger: silentLogger })
    const descarte = db.logs.find((row) => row.slug === 'boas_vindas')
    assert.equal(descarte?.status, 'skipped')
    assert.equal(descarte?.skipReason, 'daily_cap')
  } finally {
    delete process.env.EMAIL_DAILY_CAP
  }
})

test('falha no envio vira linha de erro, não exceção', async () => {
  const db = makeDb()
  const result = await sendTemplateEmail({
    db, sendMail: async () => { throw new Error('SMTP fora do ar') },
    slug: 'boas_vindas', user: activeUser, vars: { fim_do_teste: 'x' }, now: NOW, logger: silentLogger,
  })
  assert.equal(result.sent, false)
  assert.equal(db.logs[0].status, 'error')
  assert.match(db.logs[0].error, /SMTP fora do ar/)
})

// ------------------------------------------------------------------ fila

test('disparo em massa enfileira quem pode receber e já descarta quem não pode', async () => {
  const db = makeDb()
  const result = await enqueueEmailBatch({
    db,
    slug: 'promocao_relampago',
    recipients: [
      { id: 'u1', email: 'a@exemplo.com', status: 'active' },
      { id: 'u2', email: 'user_x@sistema.com', status: 'active' },
      { id: 'u3', email: 'c@exemplo.com', status: 'banned' },
      { id: 'u1', email: 'a@exemplo.com', status: 'active' },
    ],
    filters: { plano: 'trial' },
    now: NOW,
  })
  assert.equal(result.queued, 1)
  assert.equal(result.skipped, 2)
  assert.equal(db.logs.filter((r) => r.status === 'queued').length, 1)
  assert.equal(db.logs.find((r) => r.userId === 'u2').skipReason, 'undeliverable_user')
})

test('a fila sai em rodadas e respeita o limite por rodada', async () => {
  const users = Array.from({ length: 5 }, (_, i) => ({ id: `u${i}`, name: `Cliente ${i}`, email: `c${i}@exemplo.com`, status: 'active' }))
  const db = makeDb({ users })
  await enqueueEmailBatch({ db, slug: 'promocao_relampago', recipients: users, now: NOW })
  const { sent, sendMail } = collectMails()

  const primeira = await runEmailQueueTick({ db, sendMail, limit: 2, now: NOW, logger: silentLogger, secret: 's' })
  assert.equal(primeira.sent, 2)
  assert.equal(sent.length, 2)
  assert.equal(db.logs.filter((r) => r.status === 'queued').length, 3)
  assert.equal(db.batches[0].status, 'running')

  const segunda = await runEmailQueueTick({ db, sendMail, limit: 10, now: NOW, logger: silentLogger, secret: 's' })
  assert.equal(segunda.sent, 3)
  assert.equal(db.logs.filter((r) => r.status === 'queued').length, 0)
  assert.equal(db.batches[0].status, 'done')
})

test('sem SMTP a fila não perde ninguém — todos continuam esperando', async () => {
  const users = [{ id: 'u1', name: 'A', email: 'a@exemplo.com', status: 'active' }]
  const db = makeDb({ users })
  await enqueueEmailBatch({ db, slug: 'promocao_relampago', recipients: users, now: NOW })
  const summary = await runEmailQueueTick({ db, sendMail: async () => ({ skipped: true }), now: NOW, logger: silentLogger })
  assert.equal(summary.sent, 0)
  assert.equal(db.logs.filter((r) => r.status === 'queued').length, 1)
})

test('cancelar campanha impede o que ainda não saiu', async () => {
  const users = Array.from({ length: 3 }, (_, i) => ({ id: `u${i}`, name: 'x', email: `c${i}@exemplo.com`, status: 'active' }))
  const db = makeDb({ users })
  const { batchId } = await enqueueEmailBatch({ db, slug: 'promocao_relampago', recipients: users, now: NOW })
  const result = await cancelEmailBatch({ db, batchId, now: NOW })
  assert.equal(result.canceled, 3)
  assert.equal(db.batches[0].status, 'canceled')

  const { sent, sendMail } = collectMails()
  await runEmailQueueTick({ db, sendMail, now: NOW, logger: silentLogger })
  assert.equal(sent.length, 0)
})

test('item da fila cujo cliente sumiu não trava a rodada', async () => {
  const db = makeDb({ users: [] })
  await enqueueEmailBatch({ db, slug: 'promocao_relampago', recipients: [{ id: 'fantasma', email: 'x@exemplo.com', status: 'active' }], now: NOW })
  const { sent, sendMail } = collectMails()
  const summary = await runEmailQueueTick({ db, sendMail, now: NOW, logger: silentLogger })
  assert.equal(summary.skipped, 1)
  assert.equal(sent.length, 0)
  assert.equal(db.logs[0].skipReason, 'user_removed')
})
