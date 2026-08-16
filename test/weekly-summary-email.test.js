// Resumo semanal (fase 5): dia certo, números certos e quem NÃO recebe.

import test from 'node:test'
import assert from 'node:assert/strict'
import { isSummaryDay, resolveWeekday, summarizeWeek, runWeeklySummarySweep, WEEKLY_SUMMARY_SLUG } from '../src/emailTriggers/weeklySummary.js'
import { getTemplateDefinition } from '../src/email/registry.js'

const silentLogger = { info() {}, warn() {}, error() {} }
// 2026-08-17 é uma segunda-feira.
const SEGUNDA = new Date('2026-08-17T12:00:00Z')
const QUARTA = new Date('2026-08-19T12:00:00Z')

test('o dia da semana é configurável e cai na segunda por padrão', () => {
  assert.equal(resolveWeekday({}), 1)
  assert.equal(resolveWeekday({ WEEKLY_SUMMARY_WEEKDAY: '5' }), 5)
  assert.equal(resolveWeekday({ WEEKLY_SUMMARY_WEEKDAY: '9' }), 1)
  assert.equal(isSummaryDay(SEGUNDA, {}), true)
  assert.equal(isSummaryDay(QUARTA, {}), false)
})

test('os números somam envios com sucesso e contam grupos distintos', () => {
  const numeros = summarizeWeek({
    logs: [
      { status: 'success', destGroup: 'a@g.us' },
      { status: 'success', destGroup: 'a@g.us' },
      { status: 'success', destGroup: 'b@g.us' },
      { status: 'error', destGroup: 'c@g.us' },
    ],
    cliques: 42,
  })
  assert.deepEqual(numeros, { ofertas: 3, grupos: 2, cliques: 42 })
})

test('o e-mail do resumo existe no catálogo e é de divulgação', () => {
  const definition = getTemplateDefinition(WEEKLY_SUMMARY_SLUG)
  assert.ok(definition)
  assert.equal(definition.category, 'marketing')
})

function makeDb({ users = [], logs = [], cliques = 0 } = {}) {
  const sendLogs = []
  return {
    sendLogs,
    user: { findMany: async () => users },
    messageLog: { findMany: async ({ where }) => logs.filter((l) => l.userId === where.userId) },
    affiliateClick: { count: async () => cliques },
    emailTemplate: { findUnique: async () => null },
    emailOptOut: { findUnique: async () => null },
    analyticsEvent: { count: async () => 0 },
    emailSendLog: {
      count: async () => 0,
      create: async ({ data }) => { const row = { id: `l${sendLogs.length + 1}`, ...data }; sendLogs.push(row); return row },
      update: async () => ({}),
    },
  }
}

const cliente = { id: 'u1', name: 'Juliane', email: 'j@exemplo.com', status: 'active' }

test('fora do dia escolhido a passada não faz nada', async () => {
  const db = makeDb({ users: [cliente], logs: [{ userId: 'u1', status: 'success', destGroup: 'a' }] })
  const enviados = []
  const summary = await runWeeklySummarySweep({
    db, sendMail: async (m) => { enviados.push(m); return { skipped: false } }, now: QUARTA, logger: silentLogger, secret: 's',
  })
  assert.equal(summary.scanned, 0)
  assert.equal(enviados.length, 0)
})

test('no dia certo, quem enviou oferta recebe o resumo com os números', async () => {
  const db = makeDb({
    users: [cliente],
    logs: [
      { userId: 'u1', status: 'success', destGroup: 'a@g.us' },
      { userId: 'u1', status: 'success', destGroup: 'b@g.us' },
    ],
    cliques: 7,
  })
  const enviados = []
  const summary = await runWeeklySummarySweep({
    db, sendMail: async (m) => { enviados.push(m); return { skipped: false } }, now: SEGUNDA, logger: silentLogger, secret: 's',
  })
  assert.equal(summary.sent, 1)
  assert.match(enviados[0].subject, /2 ofertas enviadas/)
  assert.match(enviados[0].text, /2.*ofertas enviadas/s)
  assert.match(enviados[0].text, /7.*cliques/s)
  // É divulgação: precisa levar o descadastro.
  assert.match(enviados[0].text, /unsubscribe\?token=/)
})

test('semana sem nenhum envio NÃO vira e-mail', async () => {
  const db = makeDb({ users: [cliente], logs: [] })
  const enviados = []
  const summary = await runWeeklySummarySweep({
    db, sendMail: async (m) => { enviados.push(m); return { skipped: false } }, now: SEGUNDA, logger: silentLogger, secret: 's',
  })
  assert.equal(summary.sent, 0)
  assert.equal(summary.skipped, 1)
  assert.equal(enviados.length, 0)
})

test('e-mail fabricado não recebe resumo', async () => {
  const db = makeDb({
    users: [{ ...cliente, email: 'user_ab@sistema.com' }],
    logs: [{ userId: 'u1', status: 'success', destGroup: 'a' }],
  })
  const enviados = []
  await runWeeklySummarySweep({ db, sendMail: async (m) => { enviados.push(m); return { skipped: false } }, now: SEGUNDA, logger: silentLogger })
  assert.equal(enviados.length, 0)
})

test('falha isolada num cliente não derruba a passada', async () => {
  const db = makeDb({
    users: [cliente, { id: 'u2', name: 'B', email: 'b@exemplo.com', status: 'active' }],
    logs: [{ userId: 'u1', status: 'success', destGroup: 'a' }, { userId: 'u2', status: 'success', destGroup: 'b' }],
  })
  db.affiliateClick.count = async () => { throw new Error('SQLITE_BUSY') }
  const enviados = []
  const summary = await runWeeklySummarySweep({
    db, sendMail: async (m) => { enviados.push(m); return { skipped: false } }, now: SEGUNDA, logger: silentLogger, secret: 's',
  })
  // A contagem de cliques é isolada: falhar nela não impede o resumo.
  assert.equal(summary.sent, 2)
  assert.equal(enviados.length, 2)
})
