// Aba E-mails do admin (fase 4): filtros de público (puros) e as rotas.
// Sem banco real: o Prisma é fingido e as consultas são inspecionadas.

import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { buildAudienceWhere, describeAudience, loadAudience } from '../src/email/audience.js'
import { adminEmailsRoutes } from '../src/api/routes/adminEmails.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-08-16T12:00:00Z')

// -------------------------------------------------------------- filtros puros

test('sem filtro nenhum, conta banida e suspensa ficam de fora', () => {
  const where = buildAudienceWhere({}, NOW)
  assert.deepEqual(where.status, { notIn: ['banned', 'suspended'] })
  assert.equal(where.AND, undefined)
})

test('"vencido nos últimos 7 dias" vira janela fechada de datas', () => {
  const where = buildAudienceWhere({ acesso: 'vencido_ha', dias: 7 }, NOW)
  const janela = where.AND[0].accessExpiresAt
  assert.equal(janela.lte.getTime(), NOW.getTime())
  assert.equal(janela.gte.getTime(), NOW.getTime() - 7 * DAY)
})

test('"vence nos próximos 3 dias" não pega quem já venceu', () => {
  const where = buildAudienceWhere({ acesso: 'vence_em', dias: 3 }, NOW)
  const janela = where.AND[0].accessExpiresAt
  assert.equal(janela.gt.getTime(), NOW.getTime())
  assert.equal(janela.lte.getTime(), NOW.getTime() + 3 * DAY)
})

test('filtros de WhatsApp, credencial e afiliada viram condições próprias', () => {
  const where = buildAudienceWhere({ whatsapp: 'desconectado', credencial: 'sem', afiliado: 'sim' }, NOW)
  const json = JSON.stringify(where)
  assert.match(json, /waSession/)
  assert.match(json, /credentials.*none/)
  assert.match(json, /affiliateRef.*approved/)
})

test('"parado há N dias" procura ausência de envio com sucesso', () => {
  const where = buildAudienceWhere({ semEnvioHaDias: 2 }, NOW)
  const condicao = where.AND[0].messageLogs.none
  assert.equal(condicao.status, 'success')
  assert.equal(condicao.sentAt.gte.getTime(), NOW.getTime() - 2 * DAY)
})

test('escolha manual manda em tudo: os outros filtros são ignorados', () => {
  const where = buildAudienceWhere({ userIds: ['u1', 'u2'], plano: 'pro', acesso: 'ativo' }, NOW)
  assert.deepEqual(where.id, { in: ['u1', 'u2'] })
  assert.equal(where.plan, undefined)
  assert.equal(where.AND, undefined)
})

test('valor de dias inválido não quebra o filtro (cai no padrão)', () => {
  const where = buildAudienceWhere({ acesso: 'vencido_ha', dias: 'abacaxi' }, NOW)
  assert.equal(where.AND[0].accessExpiresAt.gte.getTime(), NOW.getTime() - 7 * DAY)
})

test('a descrição do público sai em português', () => {
  assert.match(describeAudience({ acesso: 'vencido_ha', dias: 7 }), /vencidos nos últimos 7 dias/)
  assert.match(describeAudience({ userIds: ['a', 'b'] }), /2 cliente\(s\) escolhidos na mão/)
  assert.equal(describeAudience({}), 'todos os clientes ativos')
})

test('quem já recebeu este e-mail na janela sai da lista', async () => {
  const db = {
    user: {
      findMany: async () => [
        { id: 'u1', name: 'A', email: 'a@x.com' },
        { id: 'u2', name: 'B', email: 'b@x.com' },
      ],
    },
    emailSendLog: { findMany: async () => [{ userId: 'u2' }] },
  }
  const audiencia = await loadAudience({ db, slug: 'promocao_relampago', filters: { excluirRecebidosDias: 7 }, now: NOW })
  assert.deepEqual(audiencia.map((u) => u.id), ['u1'])
})

// -------------------------------------------------------------------- rotas

function makeDb(overrides = {}) {
  const state = {
    templates: new Map(),
    sendLogs: [],
    batches: [],
    users: [
      { id: 'admin1', name: 'Chefe', email: 'chefe@exemplo.com', status: 'active', adminUser: { id: 'a1', role: 'owner', status: 'active' } },
      { id: 'u1', name: 'Cliente Um', email: 'um@exemplo.com', status: 'active', plan: 'trial', accessExpiresAt: new Date(NOW.getTime() - DAY), createdAt: NOW },
      { id: 'u2', name: 'Cliente Dois', email: 'dois@exemplo.com', status: 'active', plan: 'pro', accessExpiresAt: new Date(NOW.getTime() + 30 * DAY), createdAt: NOW },
    ],
  }
  const db = {
    state,
    user: {
      findUnique: async ({ where }) => state.users.find((u) => u.id === where.id) ?? null,
      findMany: async () => state.users.filter((u) => u.id !== 'admin1'),
    },
    emailTemplate: {
      findUnique: async ({ where }) => state.templates.get(where.slug) ?? null,
      findMany: async () => [...state.templates.values()],
      upsert: async ({ where, create, update }) => {
        const atual = state.templates.get(where.slug)
        const row = atual ? { ...atual, ...update } : { ...create, updatedAt: new Date() }
        state.templates.set(where.slug, row)
        return row
      },
      delete: async ({ where }) => {
        if (!state.templates.has(where.slug)) { const e = new Error('nao existe'); e.code = 'P2025'; throw e }
        state.templates.delete(where.slug)
        return {}
      },
    },
    emailSendLog: {
      findMany: async () => state.sendLogs,
      count: async () => state.sendLogs.length,
      create: async ({ data }) => { const row = { id: `l${state.sendLogs.length + 1}`, ...data }; state.sendLogs.push(row); return row },
      update: async () => ({}),
      updateMany: async () => ({ count: 0 }),
    },
    emailBatch: {
      create: async ({ data }) => { const row = { id: `b${state.batches.length + 1}`, ...data }; state.batches.push(row); return row },
      findMany: async () => state.batches,
      update: async ({ where, data }) => {
        const row = state.batches.find((b) => b.id === where.id)
        if (row) Object.assign(row, data)
        return row
      },
    },
    emailOptOut: { findUnique: async () => null, count: async () => 0 },
    analyticsEvent: { count: async () => 0 },
    adminAuditLog: { create: async () => ({}) },
    ...overrides,
  }
  return db
}

async function buildApp({ db = makeDb(), sendMail = async () => ({ skipped: false }), userId = 'admin1' } = {}) {
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(adminEmailsRoutes, { prefix: '/api/admin/emails', db, sendMail })
  await app.ready()
  return { app, db }
}

test('lista de modelos vem agrupada e diz se o envio está ligado', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/emails/templates' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.ok(body.templates.length >= 30)
  assert.equal(typeof body.smtpConfigured, 'boolean')
  assert.ok(body.templates.every((t) => t.slug && t.name && t.groupLabel))
  await app.close()
})

test('quem não é admin não entra', async () => {
  const db = makeDb()
  db.state.users.push({ id: 'qualquer', name: 'X', email: 'x@x.com', status: 'active', adminUser: null })
  const { app } = await buildApp({ db, userId: 'qualquer' })
  const res = await app.inject({ method: 'GET', url: '/api/admin/emails/templates' })
  assert.equal(res.statusCode, 403)
  await app.close()
})

test('abrir um modelo devolve texto, variáveis e prévia pronta', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/emails/templates/boas_vindas' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.match(body.subject, /Bem-vinda/)
  assert.ok(body.variables.some((v) => v.name === 'fim_do_teste'))
  assert.match(body.preview.html, /<html/)
  assert.doesNotMatch(body.preview.subject, /{{/, 'a prévia não pode mostrar variável crua')
  await app.close()
})

test('salvar troca o texto; voltar ao padrão apaga a edição', async () => {
  const { app, db } = await buildApp()
  const salvo = await app.inject({
    method: 'PUT',
    url: '/api/admin/emails/templates/boas_vindas',
    payload: { subject: 'Oi {{primeiro_nome}}', body: 'Texto novo com {{fim_do_teste}}', enabled: true },
  })
  assert.equal(salvo.statusCode, 200)
  assert.equal(salvo.json().subject, 'Oi {{primeiro_nome}}')
  assert.equal(salvo.json().customized, true)
  assert.equal(db.state.templates.size, 1)

  const restaurado = await app.inject({ method: 'DELETE', url: '/api/admin/emails/templates/boas_vindas' })
  assert.equal(restaurado.statusCode, 200)
  assert.match(restaurado.json().subject, /Bem-vinda/)
  assert.equal(db.state.templates.size, 0)
  await app.close()
})

test('variável inventada é recusada com o nome do erro na tela', async () => {
  const { app } = await buildApp()
  const res = await app.inject({
    method: 'PUT',
    url: '/api/admin/emails/templates/boas_vindas',
    payload: { subject: 'Oi', body: 'Olha o {{descontao}}' },
  })
  assert.equal(res.statusCode, 400)
  assert.match(res.json().error, /descontao/)
  await app.close()
})

test('assunto ou texto vazio não salva', async () => {
  const { app } = await buildApp()
  const semAssunto = await app.inject({ method: 'PUT', url: '/api/admin/emails/templates/boas_vindas', payload: { subject: '  ', body: 'x' } })
  assert.equal(semAssunto.statusCode, 400)
  const semTexto = await app.inject({ method: 'PUT', url: '/api/admin/emails/templates/boas_vindas', payload: { subject: 'x', body: '' } })
  assert.equal(semTexto.statusCode, 400)
  await app.close()
})

test('prévia usa o texto que está na tela, sem salvar nada', async () => {
  const { app, db } = await buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/emails/templates/boas_vindas/preview',
    payload: { subject: 'Assunto de teste', body: 'Corpo **de teste**' },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().subject, 'Assunto de teste')
  assert.match(res.json().html, /<strong>de teste<\/strong>/)
  assert.equal(db.state.templates.size, 0)
  await app.close()
})

test('conferir público mostra total, descrição e amostra', async () => {
  const { app } = await buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/emails/audience/preview',
    payload: { slug: 'promocao_relampago', filters: { acesso: 'vencido_ha', dias: 7 } },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.total, 2)
  assert.match(body.description, /vencidos nos últimos 7 dias/)
  assert.equal(body.sample.length, 2)
  await app.close()
})

test('disparo em massa cria campanha e enfileira (sem mandar na hora)', async () => {
  process.env.SMTP_HOST = 'smtp.teste'
  process.env.SMTP_USER = 'u'
  process.env.SMTP_PASS = 'p'
  try {
    const enviados = []
    const { app, db } = await buildApp({ sendMail: async (m) => { enviados.push(m); return { skipped: false } } })
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/emails/send',
      payload: { slug: 'promocao_relampago', filters: {}, confirmTotal: 2 },
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().queued, 2)
    assert.equal(enviados.length, 0, 'o disparo enfileira; quem envia é a fila lenta')
    assert.equal(db.state.batches.length, 1)
    assert.equal(db.state.sendLogs.filter((r) => r.status === 'queued').length, 2)
  } finally {
    delete process.env.SMTP_HOST
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
  }
})

test('se a lista mudou entre conferir e enviar, o disparo para', async () => {
  process.env.SMTP_HOST = 'smtp.teste'
  process.env.SMTP_USER = 'u'
  process.env.SMTP_PASS = 'p'
  try {
    const { app } = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/emails/send',
      payload: { slug: 'promocao_relampago', filters: {}, confirmTotal: 99 },
    })
    assert.equal(res.statusCode, 409)
    assert.match(res.json().error, /A lista mudou/)
  } finally {
    delete process.env.SMTP_HOST
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
  }
})

test('sem servidor de e-mail configurado, disparo e teste são recusados com recado claro', async () => {
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) delete process.env[key]
  const { app } = await buildApp()
  const disparo = await app.inject({ method: 'POST', url: '/api/admin/emails/send', payload: { slug: 'promocao_relampago', filters: {} } })
  assert.equal(disparo.statusCode, 409)
  assert.match(disparo.json().error, /não está ligado/)

  const teste = await app.inject({ method: 'POST', url: '/api/admin/emails/templates/boas_vindas/test', payload: {} })
  assert.equal(teste.statusCode, 409)
  await app.close()
})

test('público vazio não vira campanha', async () => {
  process.env.SMTP_HOST = 'smtp.teste'
  process.env.SMTP_USER = 'u'
  process.env.SMTP_PASS = 'p'
  try {
    const db = makeDb()
    db.user.findMany = async () => []
    const { app } = await buildApp({ db })
    const res = await app.inject({ method: 'POST', url: '/api/admin/emails/send', payload: { slug: 'promocao_relampago', filters: {} } })
    assert.equal(res.statusCode, 400)
    assert.match(res.json().error, /Nenhum cliente/)
  } finally {
    delete process.env.SMTP_HOST
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
  }
})

test('e-mail que não existe devolve 404 em todas as portas', async () => {
  const { app } = await buildApp()
  for (const [method, url] of [
    ['GET', '/api/admin/emails/templates/inventado'],
    ['PUT', '/api/admin/emails/templates/inventado'],
    ['DELETE', '/api/admin/emails/templates/inventado'],
    ['POST', '/api/admin/emails/templates/inventado/preview'],
  ]) {
    const res = await app.inject({ method, url, payload: { subject: 'x', body: 'y' } })
    assert.equal(res.statusCode, 404, `${method} ${url}`)
  }
  await app.close()
})

test('histórico devolve campanhas com contagem e últimos envios', async () => {
  const db = makeDb()
  db.state.batches.push({ id: 'b1', slug: 'promocao_relampago', status: 'running', total: 3, filters: '{"descricao":"todos"}', createdAt: NOW })
  db.state.sendLogs.push({ id: 'l1', slug: 'promocao_relampago', email: 'a@x.com', status: 'sent', mode: 'manual', batchId: 'b1', createdAt: NOW, sentAt: NOW })
  const { app } = await buildApp({ db })

  const batches = await app.inject({ method: 'GET', url: '/api/admin/emails/batches' })
  assert.equal(batches.statusCode, 200)
  assert.equal(batches.json().batches[0].descricao, 'todos')

  const sends = await app.inject({ method: 'GET', url: '/api/admin/emails/sends?limit=10' })
  assert.equal(sends.statusCode, 200)
  assert.equal(sends.json().sends[0].name, 'Promoção relâmpago (manual)')
  await app.close()
})
