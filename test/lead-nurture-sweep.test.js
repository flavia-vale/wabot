import test from 'node:test'
import assert from 'node:assert/strict'
import { runNurtureSweep } from '../src/leadNurture/sweep.js'

const SECRET = 'test-secret-key'

function makeFakeDb({ users = [], events = [] } = {}) {
  const state = { users: [...users], events: [...events] }
  return {
    _state: state,
    user: {
      findMany: async ({ where } = {}) => {
        const gte = where?.createdAt?.gte
        const lte = where?.createdAt?.lte
        return state.users.filter((u) => {
          if (gte && u.createdAt < gte) return false
          if (lte && u.createdAt > lte) return false
          return true
        })
      },
    },
    analyticsEvent: {
      findMany: async ({ where } = {}) => {
        return state.events.filter((e) => {
          if (where?.userId && e.userId !== where.userId) return false
          if (where?.event && e.event !== where.event) return false
          return true
        })
      },
      count: async ({ where } = {}) => {
        return state.events.filter((e) => {
          if (where?.userId && e.userId !== where.userId) return false
          if (where?.event && e.event !== where.event) return false
          return true
        }).length
      },
      create: async ({ data }) => {
        state.events.push(data)
        return data
      },
    },
  }
}

function makeSendMailSuccess() {
  const calls = []
  const sendMail = async (opts) => {
    calls.push(opts)
    return { skipped: false, messageId: `msg-${calls.length}` }
  }
  sendMail.calls = calls
  return sendMail
}

function makeSendMailSkipped() {
  return async () => ({ skipped: true })
}

const noopLogger = { error: () => {}, warn: () => {}, info: () => {} }

test('US1 trilha feliz: passos 2, 5 e 7 saem exatamente 1x cada, na ordem certa, sem passo extra', async () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const db = makeFakeDb({ users: [{ id: 'u1', name: 'Ana', email: 'ana@exemplo.com', createdAt }] })
  const sendMail = makeSendMailSuccess()

  // Entrada (dia 0): nenhum passo devido pela passada (0 é coberto pelo welcome).
  let summary = await runNurtureSweep({ db, sendMail, now: createdAt, secret: SECRET, logger: noopLogger })
  assert.equal(summary.sent, 0)

  // +2d
  summary = await runNurtureSweep({ db, sendMail, now: new Date('2026-07-03T00:00:00Z'), secret: SECRET, logger: noopLogger })
  assert.equal(summary.sent, 1)

  // +5d
  summary = await runNurtureSweep({ db, sendMail, now: new Date('2026-07-06T00:00:00Z'), secret: SECRET, logger: noopLogger })
  assert.equal(summary.sent, 1)

  // +7d
  summary = await runNurtureSweep({ db, sendMail, now: new Date('2026-07-08T00:00:00Z'), secret: SECRET, logger: noopLogger })
  assert.equal(summary.sent, 1)

  // Nenhum passo extra depois da trilha completa
  summary = await runNurtureSweep({ db, sendMail, now: new Date('2026-07-20T00:00:00Z'), secret: SECRET, logger: noopLogger })
  assert.equal(summary.sent, 0)

  const stepsSentInOrder = sendMail.calls.map((c) => {
    if (c.subject.includes('3 jeitos')) return 2
    if (c.subject.includes('testou o robô')) return 5
    if (c.subject.includes('teste grátis está perto')) return 7
    return null
  })
  assert.deepEqual(stepsSentInOrder, [2, 5, 7])
})

test('opt-out (US2): lead descadastrado não recebe passo algum; outro lead ativo continua recebendo', async () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-08T00:00:00Z')
  const db = makeFakeDb({
    users: [
      { id: 'u-unsub', name: 'Bia', email: 'bia@exemplo.com', createdAt },
      { id: 'u-ativo', name: 'Caio', email: 'caio@exemplo.com', createdAt },
    ],
    events: [
      { userId: 'u-unsub', event: 'nurture_unsubscribed', metadata: '{}', createdAt },
    ],
  })
  const sendMail = makeSendMailSuccess()

  const summary = await runNurtureSweep({ db, sendMail, now, secret: SECRET, logger: noopLogger })

  assert.equal(summary.sent, 3) // caio recebe 2, 5, 7
  const recipients = sendMail.calls.map((c) => c.to)
  assert.ok(recipients.every((to) => to === 'caio@exemplo.com'))
})

test('dupla execução (US3): rodar 2x no mesmo now não reenvia nenhum passo já enviado', async () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-08T00:00:00Z')
  const db = makeFakeDb({ users: [{ id: 'u1', name: 'Ana', email: 'ana@exemplo.com', createdAt }] })
  const sendMail = makeSendMailSuccess()

  const first = await runNurtureSweep({ db, sendMail, now, secret: SECRET, logger: noopLogger })
  assert.equal(first.sent, 3)

  const second = await runNurtureSweep({ db, sendMail, now, secret: SECRET, logger: noopLogger })
  assert.equal(second.sent, 0)
})

test('reinício simulado (US3): sentSteps pré-populado com {0,2} retoma no passo 5, sem reenviar 0/2', async () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-08T00:00:00Z')
  const db = makeFakeDb({
    users: [{ id: 'u1', name: 'Ana', email: 'ana@exemplo.com', createdAt }],
    events: [
      { userId: 'u1', event: 'nurture_email_sent', metadata: JSON.stringify({ step: 0 }), createdAt },
      { userId: 'u1', event: 'nurture_email_sent', metadata: JSON.stringify({ step: 2 }), createdAt },
    ],
  })
  const sendMail = makeSendMailSuccess()

  const summary = await runNurtureSweep({ db, sendMail, now, secret: SECRET, logger: noopLogger })
  assert.equal(summary.sent, 2) // 5 e 7
  const subjects = sendMail.calls.map((c) => c.subject)
  assert.ok(!subjects.some((s) => s.includes('3 jeitos'))) // passo 2 não reenviado
})

test('passada perdida (US3): elapsedDays=6 com só o passo 0 enviado envia dia 2 e dia 5 juntos', async () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-07T00:00:00Z') // elapsedDays = 6
  const db = makeFakeDb({
    users: [{ id: 'u1', name: 'Ana', email: 'ana@exemplo.com', createdAt }],
    events: [
      { userId: 'u1', event: 'nurture_email_sent', metadata: JSON.stringify({ step: 0 }), createdAt },
    ],
  })
  const sendMail = makeSendMailSuccess()

  const summary = await runNurtureSweep({ db, sendMail, now, secret: SECRET, logger: noopLogger })
  assert.equal(summary.sent, 2)
  const subjects = sendMail.calls.map((c) => c.subject)
  assert.ok(subjects.some((s) => s.includes('3 jeitos')))
  assert.ok(subjects.some((s) => s.includes('testou o robô')))
})

test('no-op sem SMTP (US3): sendMail skipped não lança e não grava nenhum nurture_email_sent', async () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-08T00:00:00Z')
  const db = makeFakeDb({ users: [{ id: 'u1', name: 'Ana', email: 'ana@exemplo.com', createdAt }] })
  const sendMail = makeSendMailSkipped()

  const summary = await runNurtureSweep({ db, sendMail, now, secret: SECRET, logger: noopLogger })
  assert.equal(summary.sent, 0)
  assert.equal(summary.skipped, 3)
  const gravados = db._state.events.filter((e) => e.event === 'nurture_email_sent')
  assert.equal(gravados.length, 0)
})

test('isolamento por item (US3): lead cujo sendMail lança não impede os demais; erro aparece em failures[]', async () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-08T00:00:00Z')
  const db = makeFakeDb({
    users: [
      { id: 'u-falha', name: 'Duda', email: 'duda@exemplo.com', createdAt },
      { id: 'u-ok', name: 'Caio', email: 'caio@exemplo.com', createdAt },
    ],
  })
  const sendMail = async (opts) => {
    if (opts.to === 'duda@exemplo.com') throw new Error('SMTP indisponível')
    return { skipped: false, messageId: 'ok' }
  }

  const summary = await runNurtureSweep({ db, sendMail, now, secret: SECRET, logger: noopLogger })
  assert.equal(summary.failed, 1)
  assert.equal(summary.failures.length, 1)
  assert.equal(summary.failures[0].userId, 'u-falha')
  assert.equal(summary.sent, 3) // caio recebe 2, 5, 7 normalmente
})

test('lead com e-mail @sistema.com nunca é elegível', async () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-08T00:00:00Z')
  const db = makeFakeDb({ users: [{ id: 'u1', name: 'Fallback', email: 'user_ab12cd@sistema.com', createdAt }] })
  const sendMail = makeSendMailSuccess()

  const summary = await runNurtureSweep({ db, sendMail, now, secret: SECRET, logger: noopLogger })
  assert.equal(summary.sent, 0)
  assert.equal(sendMail.calls.length, 0)
})
