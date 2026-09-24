// Aba "Contato com cliente" do admin — parte WhatsApp: histórico
// (CustomerContactLog) + lista de conectados + envio manual.
// Sem banco real: Prisma fingido, sendSelfMessage injetado.

import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { adminEmailsRoutes } from '../src/api/routes/adminEmails.js'
import {
  describeWhatsappContactReason,
  isManualWhatsappContact,
  presentWhatsappContactRow,
} from '../src/domain/admin/whatsappContactHistory.js'

const NOW = new Date('2026-09-24T12:00:00Z')

// -------------------------------------------------------------- módulo puro

test('slug conhecido traduz para linguagem leiga', () => {
  assert.equal(describeWhatsappContactReason('boas_vindas_conexao'), 'Boas-vindas ao conectar o WhatsApp')
  assert.equal(describeWhatsappContactReason('mensagem_manual_suporte'), 'Mensagem manual do suporte')
})

test('slug desconhecido nunca some da tela — devolve ele mesmo', () => {
  assert.equal(describeWhatsappContactReason('slug_novo_ainda_sem_label'), 'slug_novo_ainda_sem_label')
})

test('manual só quando tem actorUserId', () => {
  assert.equal(isManualWhatsappContact({ actorUserId: 'admin1' }), true)
  assert.equal(isManualWhatsappContact({ actorUserId: null }), false)
  assert.equal(isManualWhatsappContact({}), false)
})

test('presentWhatsappContactRow monta o formato da tela', () => {
  const row = {
    id: 'c1', createdAt: NOW, userId: 'u1', reason: 'lembrete_sem_etiqueta',
    notes: 'texto enviado', actorUserId: null,
    user: { email: 'cliente@ex.com', name: 'Cliente' },
    actorUser: null,
  }
  assert.deepEqual(presentWhatsappContactRow(row), {
    id: 'c1', when: NOW, userId: 'u1',
    clienteEmail: 'cliente@ex.com', clienteNome: 'Cliente',
    motivo: 'Lembrete: cadastrar a loja', manual: false, enviadoPor: null, texto: 'texto enviado',
  })
})

// -------------------------------------------------------------------- rotas

function makeDb(overrides = {}) {
  const state = {
    users: [
      { id: 'admin1', name: 'Chefe', email: 'chefe@exemplo.com', status: 'active', adminUser: { id: 'a1', role: 'owner', status: 'active' } },
      { id: 'u1', name: 'Cliente Um', email: 'um@exemplo.com', status: 'active' },
      { id: 'u2', name: 'Cliente Dois', email: 'dois@exemplo.com', status: 'active' },
      { id: 'u3', name: 'Cliente Três', email: 'tres@exemplo.com', status: 'active' },
    ],
    sessions: [
      { userId: 'u1', status: 'connected', phone: '5511999990001', user: { email: 'um@exemplo.com', name: 'Cliente Um' } },
      { userId: 'u2', status: 'disconnected', phone: null, user: { email: 'dois@exemplo.com', name: 'Cliente Dois' } },
      { userId: 'u3', status: 'connected', phone: '5511999990003', user: { email: 'tres@exemplo.com', name: 'Cliente Três' } },
    ],
    // u1: já enviou, sem credencial. u2/u3: nunca enviaram, sem credencial.
    // u3 é o alvo típico da campanha "conectado + nunca enviou".
    credentials: [],
    successCounts: { u1: 3 },
    contactLogs: [
      { id: 'c1', userId: 'u1', channel: 'whatsapp', reason: 'boas_vindas_conexao', outcome: 'contacted', notes: 'oi', actorUserId: null, createdAt: NOW, user: { email: 'um@exemplo.com', name: 'Cliente Um' }, actorUser: null },
    ],
  }
  const db = {
    state,
    user: {
      findUnique: async ({ where }) => state.users.find((u) => u.id === where.id) ?? null,
      findMany: async () => state.users.filter((u) => u.id !== 'admin1'),
    },
    waSession: {
      findUnique: async ({ where }) => state.sessions.find((s) => s.userId === where.userId) ?? null,
      findMany: async ({ where }) => {
        const busca = where?.user?.is?.OR?.[0]?.email?.contains
        if (!busca) return state.sessions
        return state.sessions.filter((s) => s.user.email.includes(busca) || s.user.name.includes(busca))
      },
    },
    credential: {
      groupBy: async ({ where }) => {
        const ids = where.userId.in
        const porUsuario = new Map()
        for (const c of state.credentials) if (ids.includes(c.userId)) porUsuario.set(c.userId, (porUsuario.get(c.userId) || 0) + 1)
        return [...porUsuario.entries()].map(([userId, n]) => ({ userId, _count: { _all: n } }))
      },
    },
    messageLog: {
      groupBy: async ({ where }) => {
        const ids = where.userId.in
        return ids
          .filter((id) => (state.successCounts[id] || 0) > 0)
          .map((id) => ({ userId: id, _count: { _all: state.successCounts[id] } }))
      },
    },
    customerContactLog: {
      findMany: async ({ where, take }) => state.contactLogs.filter((c) => c.channel === where.channel).slice(0, take),
    },
    adminAuditLog: { create: async () => ({}) },
    analyticsEvent: { count: async () => 0 },
    emailTemplate: { findMany: async () => [] },
    emailSendLog: { findMany: async () => [], count: async () => 0 },
    emailBatch: { findMany: async () => [] },
    emailOptOut: { count: async () => 0 },
    ...overrides,
  }
  return db
}

async function buildApp({ db = makeDb(), sendSelfMessage = async () => ({ ok: true }), userId = 'admin1' } = {}) {
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(adminEmailsRoutes, { prefix: '/api/admin/emails', db, sendSelfMessage })
  await app.ready()
  return { app, db }
}

test('histórico devolve as linhas de whatsapp já traduzidas', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/emails/whatsapp/history' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.contatos.length, 1)
  assert.equal(body.contatos[0].motivo, 'Boas-vindas ao conectar o WhatsApp')
  assert.equal(body.contatos[0].clienteEmail, 'um@exemplo.com')
})

test('sem filtro, a lista traz TODOS (conectado e desconectado) com os fatos junto', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/emails/whatsapp/connected' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.deepEqual(new Set(body.clientes.map((c) => c.userId)), new Set(['u1', 'u2', 'u3']))
  const u1 = body.clientes.find((c) => c.userId === 'u1')
  assert.equal(u1.conectado, true)
})

test('filtro connected=yes só traz quem está conectado agora', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/emails/whatsapp/connected?connected=yes' })
  const body = res.json()
  assert.deepEqual(new Set(body.clientes.map((c) => c.userId)), new Set(['u1', 'u3']))
})

test('enviar mensagem chama sendSelfMessage e grava audit log', async () => {
  const chamadas = []
  const db = makeDb()
  const { app } = await buildApp({ db, sendSelfMessage: async (userId, text, actorUserId) => { chamadas.push({ userId, text, actorUserId }); return { ok: true } } })
  const res = await app.inject({ method: 'POST', url: '/api/admin/emails/whatsapp/send', payload: { userId: 'u1', text: 'Oi, tudo bem?' } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(chamadas, [{ userId: 'u1', text: 'Oi, tudo bem?', actorUserId: 'admin1' }])
})

test('não deixa mandar para quem NÃO está conectado', async () => {
  const chamadas = []
  const { app } = await buildApp({ sendSelfMessage: async (...args) => { chamadas.push(args); return { ok: true } } })
  const res = await app.inject({ method: 'POST', url: '/api/admin/emails/whatsapp/send', payload: { userId: 'u2', text: 'Oi, tudo bem?' } })
  assert.equal(res.statusCode, 409)
  assert.equal(chamadas.length, 0)
})

test('mensagem vazia ou curta demais é recusada antes de chamar o envio', async () => {
  const chamadas = []
  const { app } = await buildApp({ sendSelfMessage: async (...args) => { chamadas.push(args); return { ok: true } } })
  const res = await app.inject({ method: 'POST', url: '/api/admin/emails/whatsapp/send', payload: { userId: 'u1', text: 'oi' } })
  assert.equal(res.statusCode, 400)
  assert.equal(chamadas.length, 0)
})

test('cliente inexistente devolve 404', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/admin/emails/whatsapp/send', payload: { userId: 'fantasma', text: 'Oi, tudo bem?' } })
  assert.equal(res.statusCode, 404)
})

test('falha no envio devolve erro claro, sem gravar audit log de sucesso', async () => {
  const { app } = await buildApp({ sendSelfMessage: async () => { throw new Error('Timeout ao enviar mensagem para o próprio número') } })
  const res = await app.inject({ method: 'POST', url: '/api/admin/emails/whatsapp/send', payload: { userId: 'u1', text: 'Oi, tudo bem?' } })
  assert.equal(res.statusCode, 502)
  assert.match(res.json().error, /Timeout/)
})

test('quem não é admin não entra em nenhuma das 4 rotas', async () => {
  const db = makeDb({ user: { findUnique: async () => ({ id: 'x', email: 'x@x.com', status: 'active', adminUser: null }) } })
  const { app } = await buildApp({ db, userId: 'x' })
  for (const req of [
    { method: 'GET', url: '/api/admin/emails/whatsapp/history' },
    { method: 'GET', url: '/api/admin/emails/whatsapp/connected' },
    { method: 'POST', url: '/api/admin/emails/whatsapp/send', payload: { userId: 'u1', text: 'oi tudo bem' } },
    { method: 'POST', url: '/api/admin/emails/whatsapp/send-bulk', payload: { filters: {}, text: 'oi tudo bem' } },
  ]) {
    const res = await app.inject(req)
    assert.equal(res.statusCode, 403, req.url)
  }
})

// --------------------------------------------------------------- filtros

test('filtro connected=yes&everSent=no acha só o alvo da campanha (u3)', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/emails/whatsapp/connected?connected=yes&everSent=no' })
  const body = res.json()
  assert.deepEqual(body.clientes.map((c) => c.userId), ['u3'])
})

test('filtro hasCredential=no acha os 3 (nenhum tem credencial nesta base de teste)', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/emails/whatsapp/connected?hasCredential=no' })
  const body = res.json()
  assert.deepEqual(new Set(body.clientes.map((c) => c.userId)), new Set(['u1', 'u2', 'u3']))
})

// ---------------------------------------------------------- envio em massa

test('envio em massa manda só pra quem bate no filtro E está conectado', async () => {
  const chamadas = []
  const { app } = await buildApp({ sendSelfMessage: async (userId, text, actorUserId) => { chamadas.push({ userId, text, actorUserId }); return { ok: true } } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/emails/whatsapp/send-bulk',
    payload: { filters: { connected: 'yes', everSent: 'no' }, text: 'Vídeo de ajuda aqui' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.elegiveis, 1)
  assert.equal(body.enviados, 1)
  assert.deepEqual(body.falhas, [])
  assert.deepEqual(chamadas, [{ userId: 'u3', text: 'Vídeo de ajuda aqui', actorUserId: 'admin1' }])
})

test('envio em massa NUNCA manda pra quem está desconectado, mesmo com filtro connected=any', async () => {
  const chamadas = []
  const { app } = await buildApp({ sendSelfMessage: async (...args) => { chamadas.push(args); return { ok: true } } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/emails/whatsapp/send-bulk',
    payload: { filters: { connected: 'any', everSent: 'no' }, text: 'Vídeo de ajuda aqui' },
  })
  const body = res.json()
  // u2 (desconectado, nunca enviou) bate no filtro mas não pode receber agora.
  assert.deepEqual(chamadas.map((c) => c[0]), ['u3'])
  assert.equal(body.elegiveis, 1)
})

test('sem ninguém elegível, devolve 409 e não chama envio', async () => {
  const chamadas = []
  const { app } = await buildApp({ sendSelfMessage: async (...args) => { chamadas.push(args); return { ok: true } } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/emails/whatsapp/send-bulk',
    payload: { filters: { connected: 'no', everSent: 'yes' }, text: 'Vídeo de ajuda aqui' },
  })
  assert.equal(res.statusCode, 409)
  assert.equal(chamadas.length, 0)
})

test('falha em UM cliente não impede o envio pros demais (best-effort)', async () => {
  const db = makeDb()
  db.state.sessions.push({ userId: 'u4', status: 'connected', phone: '5511999990004', user: { email: 'quatro@exemplo.com', name: 'Cliente Quatro' } })
  db.state.users.push({ id: 'u4', name: 'Cliente Quatro', email: 'quatro@exemplo.com', status: 'active' })
  const chamadas = []
  const { app } = await buildApp({
    db,
    sendSelfMessage: async (userId, text, actorUserId) => {
      chamadas.push(userId)
      if (userId === 'u3') throw new Error('Bot não conectado')
      return { ok: true }
    },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/emails/whatsapp/send-bulk',
    payload: { filters: { connected: 'yes', everSent: 'no' }, text: 'Vídeo de ajuda aqui' },
  })
  const body = res.json()
  assert.equal(body.elegiveis, 2)
  assert.equal(body.enviados, 1)
  assert.deepEqual(body.falhas.map((f) => f.userId), ['u3'])
  assert.deepEqual(new Set(chamadas), new Set(['u3', 'u4']))
})

test('mensagem vazia/curta é recusada antes de calcular quem é elegível', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/admin/emails/whatsapp/send-bulk', payload: { filters: {}, text: 'oi' } })
  assert.equal(res.statusCode, 400)
})
