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
    ],
    sessions: [
      { userId: 'u1', status: 'connected', phone: '5511999990001', user: { email: 'um@exemplo.com', name: 'Cliente Um' } },
      { userId: 'u2', status: 'disconnected', phone: null, user: { email: 'dois@exemplo.com', name: 'Cliente Dois' } },
    ],
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
      findMany: async ({ where }) => state.sessions.filter((s) => s.status === where.status),
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

test('lista de conectados só traz sessão status=connected', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/emails/whatsapp/connected' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.deepEqual(body.clientes.map((c) => c.userId), ['u1'])
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

test('quem não é admin não entra em nenhuma das 3 rotas', async () => {
  const db = makeDb({ user: { findUnique: async () => ({ id: 'x', email: 'x@x.com', status: 'active', adminUser: null }) } })
  const { app } = await buildApp({ db, userId: 'x' })
  for (const req of [
    { method: 'GET', url: '/api/admin/emails/whatsapp/history' },
    { method: 'GET', url: '/api/admin/emails/whatsapp/connected' },
    { method: 'POST', url: '/api/admin/emails/whatsapp/send', payload: { userId: 'u1', text: 'oi tudo bem' } },
  ]) {
    const res = await app.inject(req)
    assert.equal(res.statusCode, 403, req.url)
  }
})
