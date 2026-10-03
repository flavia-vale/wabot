import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { diffSubscription, planSync, applySync, checkRenewal, createMpGet } from '../src/domain/payments/subscriptionSync.js'

// M3 da auditoria: Ficha 360 > aba Financeiro com Sincronizar MP e Testar renovação.

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const NEXT = '2026-11-01T00:00:00.000Z'

function fakeDb(subs, extra = {}) {
  const writes = []
  return {
    writes,
    subscription: {
      findMany: async () => subs,
      findFirst: async () => subs[0] ?? null,
      update: async (args) => { writes.push(args); return args },
    },
    webhookEvent: { findMany: async () => extra.webhooks ?? [] },
  }
}
const mp = (status, next = NEXT, extra = {}) => async () => ({ ok: true, corpo: { status, next_payment_date: next, summarized: { charged_quantity: 2 }, card_id: 'c1', ...extra } })
const sub = (over = {}) => ({ id: 's1', mpSubscriptionId: 'pre1', plan: 'pro', status: 'pending', nextChargeAt: null, ...over })

test('diff puro: pending local x authorized no MP => update, sem gravar', () => {
  const d = diffSubscription(sub(), { ok: true, corpo: { status: 'authorized', next_payment_date: NEXT } })
  assert.equal(d.action, 'update')
  assert.equal(d.newStatus, 'authorized')
  assert.equal(d.newNextChargeAt, NEXT)
})

test('diff puro: igual => none; MP fora do ar => unreachable', () => {
  assert.equal(diffSubscription(sub({ status: 'authorized' }), { ok: true, corpo: { status: 'authorized' } }).action, 'none')
  const u = diffSubscription(sub(), { ok: false, motivo: 'o Mercado Pago respondeu 500' })
  assert.equal(u.action, 'unreachable')
})

test('sem data no MP, mantém a próxima cobrança nossa', () => {
  const d = diffSubscription(sub({ nextChargeAt: new Date(NEXT) }), { ok: true, corpo: { status: 'authorized' } })
  assert.equal(d.newNextChargeAt, NEXT)
})

test('planSync NÃO grava; applySync grava o diff confirmado', async () => {
  const db = fakeDb([sub()])
  const plano = await planSync({ db, userId: 'u1', mpGet: mp('authorized') })
  assert.equal(plano.pending, 1)
  assert.equal(db.writes.length, 0)
  const r = await applySync({ db, userId: 'u1', shown: plano, mpGet: mp('authorized') })
  assert.equal(r.applied, 1)
  assert.equal(db.writes.length, 1)
  assert.equal(db.writes[0].data.status, 'authorized')
  assert.equal(db.writes[0].data.nextChargeAt.toISOString(), NEXT)
})

test('applySync recusa o que mudou no MP entre ver e confirmar (stale)', async () => {
  const db = fakeDb([sub()])
  const plano = await planSync({ db, userId: 'u1', mpGet: mp('authorized') })
  const r = await applySync({ db, userId: 'u1', shown: plano, mpGet: mp('cancelled') })
  assert.equal(r.applied, 0)
  assert.equal(r.stale, 1)
  assert.equal(db.writes.length, 0)
})

test('applySync ignora valor inventado pelo cliente: só o que o MP confirma agora', async () => {
  const db = fakeDb([sub()])
  const forjado = { items: [{ subscriptionId: 's1', action: 'update', newStatus: 'authorized', newNextChargeAt: '2030-01-01T00:00:00.000Z' }] }
  const r = await applySync({ db, userId: 'u1', shown: forjado, mpGet: mp('authorized') })
  assert.equal(r.applied, 0)
  assert.equal(db.writes.length, 0)
})

test('MP sem chave não lança e não grava', async () => {
  const db = fakeDb([sub()])
  const plano = await planSync({ db, userId: 'u1', mpGet: createMpGet({ token: '' }) })
  assert.equal(plano.items[0].action, 'unreachable')
  assert.doesNotMatch(JSON.stringify(plano), /Bearer/)
})

test('testar renovação: 6 elos, só leitura', async () => {
  const db = fakeDb([sub({ status: 'authorized', nextChargeAt: new Date(NEXT) })], { webhooks: [{ eventType: 'subscription_preapproval', processingStatus: 'done', error: null }] })
  const mpGet = async (c) => c.startsWith('/preapproval/')
    ? { ok: true, corpo: { status: 'authorized', next_payment_date: NEXT, card_id: 'c', summarized: { charged_quantity: 1 } } }
    : { ok: true, corpo: { results: [{ date_created: NEXT, transaction_amount: 10, status: 'processed' }] } }
  const r = await checkRenewal({ db, user: { id: 'u1', accessExpiresAt: new Date('2026-12-01') }, mpGet })
  assert.deepEqual(r.elos.map(e => e.id), ['mp_valendo', 'mp_cobrou', 'aviso_chega', 'aviso_processado', 'banco_espelha', 'acesso_cobre'])
  assert.ok(r.elos.every(e => e.ok === true))
  assert.equal(r.verdict.armed, true)
  assert.equal(db.writes.length, 0)
})

test('testar renovação: sem assinatura e acesso que vence antes da cobrança', async () => {
  assert.equal((await checkRenewal({ db: fakeDb([]), user: { id: 'u' }, mpGet: mp('authorized') })).hasSubscription, false)
  const db = fakeDb([sub({ status: 'authorized' })])
  const r = await checkRenewal({ db, user: { id: 'u1', accessExpiresAt: new Date('2026-10-05') }, mpGet: mp('authorized') })
  assert.equal(r.elos.find(e => e.id === 'acesso_cobre').ok, false)
})

test('rotas em duas etapas, com permissão e auditoria', () => {
  const src = read('src/api/routes/admin.js')
  const bloco = (nome) => { const i = src.indexOf(nome); return src.slice(i, i + 1400) }
  assert.match(bloco("app.get('/users/:id/assinatura/diff'"), /requireAdmin\(req, reply, 'billing:read'\)[\s\S]*planSync/)
  const post = bloco("app.post('/users/:id/assinatura/sincronizar'")
  assert.match(post, /requireAdmin\(req, reply, 'billing:write'\)/)
  assert.match(post, /confirm !== true/)
  assert.match(post, /applySync/)
  assert.match(post, /writeAdminAuditLog\(req, \{\s*action: 'admin\.assinatura\.sincronizar'/)
  assert.match(bloco("app.get('/users/:id/assinatura/testar-renovacao'"), /requireAdmin\(req, reply, 'billing:read'\)[\s\S]*checkRenewal/)
})

test('script de SSH importa o módulo (sem lógica duplicada)', () => {
  const s = read('scripts/sincronizar-assinatura.mjs')
  assert.match(s, /subscriptionSync\.js/)
  assert.match(s, /planSync/)
  assert.match(s, /applySync/)
  assert.doesNotMatch(s, /db\.subscription\.update/)
})

test('aba Financeiro: diff antes, confirm antes de gravar, testar renovação', () => {
  const page = read('dashboard/app/admin/clientes/[id]/page.js')
  assert.match(page, /adminAssinaturaDiff/)
  assert.match(page, /window\.confirm\([^\n]*\)\) return\s*\n\s*setBusy\(true\)[\s\S]*adminAssinaturaSincronizar/)
  assert.match(page, /adminAssinaturaTestarRenovacao/)
  assert.match(page, /<FinanceiroTab financeiro=\{history\.financeiro\} userId=\{history\.id\}/)
  const api = read('dashboard/lib/api.js')
  assert.match(api, /assinatura\/sincronizar/)
})
