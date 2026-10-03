import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import db from '../src/db.js'
import { channelFollowState, sourceCoverage } from '../src/domain/session/groupMembership.js'
import { getChannelMetadata } from '../src/core/channelDirectory.js'
import { sourceGapsForSlot, sourceGapsNotice } from '../src/core/reserveCoverage.js'
import { multiNumberRoutes } from '../src/api/routes/multiNumber.js'
import { getTemplateDefinition } from '../src/email/registry.js'

// Fase 2.1 (docs/rca/multi-numero.md): a reserva precisa estar nas ORIGENS,
// não só nos destinos — senão, depois da troca, a origem para de ser copiada.

test('canal: SUBSCRIBER/ADMIN/OWNER segue; GUEST não; sem resposta = desconhecido', () => {
  assert.equal(channelFollowState('SUBSCRIBER'), 'ok')
  assert.equal(channelFollowState('owner'), 'ok')
  assert.equal(channelFollowState('ADMIN'), 'ok')
  assert.equal(channelFollowState('GUEST'), 'missing')
  assert.equal(channelFollowState(null), 'unknown')
})

test('cobertura das origens: grupos pela pertença, canais pelo estado, Telegram fora', () => {
  const cov = sourceCoverage({
    sources: [
      { waJid: 'o1@g.us', name: 'Origem 1' },
      { waJid: 'o2@g.us', name: 'Origem 2' },
      { waJid: 'o2@g.us', name: 'Origem 2 (repetida)' },
      { waJid: 'c1@newsletter', name: 'Canal 1' },
      { waJid: 'c2@newsletter', name: 'Canal 2' },
      { waJid: 'c3@newsletter', name: 'Canal 3' },
      { waJid: 'tg:123', name: 'Telegram' },
    ],
    memberJids: ['o1@g.us'],
    channelStates: { 'c1@newsletter': 'ok', 'c2@newsletter': 'missing' },
  })
  assert.equal(cov.total, 5)
  assert.equal(cov.ok, 2)
  assert.deepEqual(cov.missingGroups.map(g => g.waJid), ['o2@g.us'])
  assert.deepEqual(cov.missingChannels.map(g => g.waJid), ['c2@newsletter'])
  assert.deepEqual(cov.unknownChannels.map(g => g.waJid), ['c3@newsletter'])
  assert.deepEqual(sourceCoverage({}), { total: 0, ok: 0, missingGroups: [], missingChannels: [], unknownChannels: [] })
})

test('metadata do canal devolve o papel de quem pergunta', async () => {
  const sock = { user: { id: '1@s.whatsapp.net' }, newsletterMetadata: async () => ({ id: 'c1@newsletter', name: 'C', viewer_metadata: { role: 'SUBSCRIBER', mute: 'OFF' } }) }
  assert.equal((await getChannelMetadata({ sock, jid: 'c1@newsletter' })).viewerRole, 'SUBSCRIBER')
  const noViewer = { ...sock, newsletterMetadata: async () => ({ id: 'c1@newsletter', name: 'C' }) }
  assert.equal((await getChannelMetadata({ sock: noViewer, jid: 'c1@newsletter' })).viewerRole, null)
})

test('aviso do e-mail: lista grupos que faltam, cita canais, nunca sai vazio', () => {
  const txt = sourceGapsNotice({ known: true, missingGroups: [{ waJid: 'o2@g.us', name: 'Origem 2' }], channelCount: 2 })
  assert.match(txt, /pararam de ser copiados:\n- Origem 2/)
  assert.match(txt, /2 canais/)
  assert.match(sourceGapsNotice({ known: true }), /está em todos os grupos/)
  assert.match(sourceGapsNotice({}), /Confira no painel/)
  const many = Array.from({ length: 12 }, (_, i) => ({ waJid: `g${i}@g.us`, name: `G${i}` }))
  assert.match(sourceGapsNotice({ known: true, missingGroups: many }), /e mais 2/)
  const tpl = getTemplateDefinition('whatsapp_reserva_assumiu')
  assert.match(tpl.body, /\{\{aviso_origens\}\}/)
  assert.ok(tpl.variables.some(v => v.name === 'aviso_origens'))
})

test('estrutural: a prontidão só consulta/segue canal e não grava a lista de canais da conta', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /STANDBY_IPC_TYPES = new Set\(\['stop', 'requestPairingCode', 'listGroups', 'metrics', 'channel:metadata', 'channel:follow'\]\)/)
  assert.match(src, /if \(!IS_STANDBY\) rememberChannelJid\(msg\.jid\)/)
  const server = readFileSync(new URL('../src/api/server.js', import.meta.url), 'utf8')
  assert.match(server, /sourceGapsForSlot\(\{ db, userId: user\.id, slot: to \}\)/)
})

async function build({ manager, sleep } = {}) {
  const userId = `user-sources-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'S', email: `${userId}@t.local`, passwordHash: 'x', plan: 'pro', extraNumbers: 1, accessExpiresAt: new Date(Date.now() + 864e5) } })
  await db.waSession.create({ data: { userId, status: 'connected', phone: '5511999990000' } })
  await db.waExtraSession.create({ data: { userId, slot: 2, status: 'connected', phone: '5511888880000', lastHeartbeatAt: new Date() } })
  await db.group.createMany({ data: [
    { userId, waJid: 'd1@g.us', name: 'D1', role: 'post' },
    { userId, waJid: 'o1@g.us', name: 'O1', role: 'monitor' },
    { userId, waJid: 'o2@g.us', name: 'O2', role: 'monitor' },
    { userId, waJid: 'c1@newsletter', name: 'C1', role: 'monitor', kind: 'channel' },
    { userId, waJid: 'c2@newsletter', name: 'C2', role: 'monitor', kind: 'channel' },
  ] })
  await db.waGroupMembership.createMany({ data: [
    { userId, slot: 2, waJid: 'd1@g.us' },
    { userId, slot: 2, waJid: 'o1@g.us' },
  ] })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async req => { req.user = { sub: userId } })
  await app.register(multiNumberRoutes, { prefix: '/api/multi-number', manager, env: { MULTI_NUMBER_ENABLED: 'true' }, sleep })
  return { app, userId }
}

function channelManager(roles) {
  const calls = []
  return {
    calls,
    isRunning: () => true,
    listGroups: async () => [],
    channelMetadata: async (key, { jid }) => { calls.push(['meta', key, jid]); return { jid, viewerRole: roles[jid] ?? null } },
    followChannelImmediate: async (key, jid) => { calls.push(['follow', key, jid]); roles[jid] = 'SUBSCRIBER'; return { followed: 'new' } },
  }
}

test('rota: "conferir" devolve destinos (formato antigo) + origens do número reserva', async () => {
  const manager = channelManager({ 'c1@newsletter': 'SUBSCRIBER', 'c2@newsletter': 'GUEST' })
  const { app, userId } = await build({ manager })
  try {
    const res = (await app.inject({ method: 'GET', url: '/api/multi-number/reserve/missing-groups' })).json()
    assert.equal(res.total, 1)
    assert.deepEqual(res.missing, [])
    assert.equal(res.sources.total, 4)
    assert.equal(res.sources.ok, 2)
    assert.deepEqual(res.sources.missingGroups.map(g => g.waJid), ['o2@g.us'])
    assert.deepEqual(res.sources.missingChannels.map(g => g.waJid), ['c2@newsletter'])
    assert.ok(manager.calls.some(c => c[1] === `${userId}~n2`), 'pergunta ao número reserva')
    // Número que envia sem pertença gravada: lê os grupos ao vivo (aqui, nenhum).
    assert.deepEqual(res.active.sources.missingGroups.map(g => g.waJid), ['o1@g.us', 'o2@g.us'])
  } finally {
    await db.user.deleteMany({ where: { id: userId } })
  }
})

test('rota: seguir canais só segue os que faltam, espaçado, e trava clique repetido', async () => {
  const manager = channelManager({ 'c1@newsletter': 'SUBSCRIBER', 'c2@newsletter': 'GUEST' })
  const sleeps = []
  const { app, userId } = await build({ manager, sleep: async ms => { sleeps.push(ms) } })
  try {
    const r = await app.inject({ method: 'POST', url: '/api/multi-number/reserve/follow-source-channels' })
    assert.equal(r.statusCode, 200)
    assert.deepEqual(r.json().followed.map(c => c.waJid), ['c2@newsletter'])
    assert.equal(r.json().remaining, 0)
    assert.deepEqual(manager.calls.filter(c => c[0] === 'follow'), [['follow', `${userId}~n2`, 'c2@newsletter']])
    assert.deepEqual(sleeps, [], 'um canal só, sem espera')
    const again = await app.inject({ method: 'POST', url: '/api/multi-number/reserve/follow-source-channels' })
    assert.equal(again.statusCode, 429)
    assert.equal(again.json().code, 'FOLLOW_TOO_SOON')
  } finally {
    await db.user.deleteMany({ where: { id: userId } })
  }
})

test('rota: seguir canais em lote de 5, com espera entre eles', async () => {
  const roles = {}
  const manager = channelManager(roles)
  const sleeps = []
  const { app, userId } = await build({ manager, sleep: async ms => { sleeps.push(ms) } })
  try {
    await db.group.createMany({ data: Array.from({ length: 5 }, (_, i) => ({ userId, waJid: `x${i}@newsletter`, name: `X${i}`, role: 'monitor', kind: 'channel' })) })
    const r = (await app.inject({ method: 'POST', url: '/api/multi-number/reserve/follow-source-channels' })).json()
    assert.equal(r.followed.length, 5)
    assert.equal(r.remaining, 2)
    assert.deepEqual(sleeps, [3000, 3000, 3000, 3000])
  } finally {
    await db.user.deleteMany({ where: { id: userId } })
  }
})

test('rota: seguir canais exige a reserva conectada e a flag', async () => {
  const { app, userId } = await build({ manager: channelManager({}) })
  try {
    await db.waExtraSession.updateMany({ where: { userId }, data: { status: 'disconnected' } })
    assert.equal((await app.inject({ method: 'POST', url: '/api/multi-number/reserve/follow-source-channels' })).statusCode, 409)
  } finally {
    await db.user.deleteMany({ where: { id: userId } })
  }
  const off = Fastify({ logger: false })
  off.decorate('authenticate', async req => { req.user = { sub: 'x' } })
  await off.register(multiNumberRoutes, { prefix: '/api/multi-number', manager: channelManager({}), env: {} })
  assert.equal((await off.inject({ method: 'POST', url: '/api/multi-number/reserve/follow-source-channels' })).statusCode, 404)
})

test('aviso da troca lê a pertença do número que assumiu', async () => {
  const userId = `user-gaps-${Date.now()}`
  await db.user.create({ data: { id: userId, name: 'G', email: `${userId}@t.local`, passwordHash: 'x' } })
  try {
    assert.equal((await sourceGapsForSlot({ db, userId, slot: 2 })).known, false)
    await db.group.createMany({ data: [
      { userId, waJid: 'o1@g.us', name: 'O1', role: 'monitor' },
      { userId, waJid: 'o2@g.us', name: 'O2', role: 'monitor' },
      { userId, waJid: 'c1@newsletter', name: 'C1', role: 'monitor', kind: 'channel' },
    ] })
    await db.waGroupMembership.create({ data: { userId, slot: 2, waJid: 'o1@g.us' } })
    const gaps = await sourceGapsForSlot({ db, userId, slot: 2 })
    assert.equal(gaps.known, true)
    assert.deepEqual(gaps.missingGroups.map(g => g.waJid), ['o2@g.us'])
    assert.equal(gaps.channelCount, 1)
  } finally {
    await db.user.deleteMany({ where: { id: userId } })
  }
})

test('rota: confere também o número que ENVIA (papéis invertem depois da troca)', async () => {
  // Staging 2026-10-03: a reserva estava em tudo, mas o número que enviava
  // não estava numa origem — e a tela dizia "recebe de todas".
  const manager = channelManager({ 'c1@newsletter': 'SUBSCRIBER', 'c2@newsletter': 'SUBSCRIBER' })
  const { app, userId } = await build({ manager })
  try {
    await db.waGroupMembership.createMany({ data: [
      { userId, slot: 1, waJid: 'd1@g.us' },
      { userId, slot: 1, waJid: 'o1@g.us' },
      { userId, slot: 1, waJid: 'o2@g.us' },
    ] })
    // Depois da troca: o número 2 envia, o 1 fica de prontidão.
    await db.user.update({ where: { id: userId }, data: { activeWaSlot: 2 } })
    const res = (await app.inject({ method: 'GET', url: '/api/multi-number/reserve/missing-groups' })).json()
    assert.equal(res.sources.ok, 4, 'a reserva (número 1) recebe de todas')
    assert.deepEqual(res.active.sources.missingGroups.map(g => g.waJid), ['o2@g.us'], 'o número que envia (2) não está na origem o2')
    assert.ok(manager.calls.some(c => c[0] === 'meta' && c[1] === userId), 'canais do número que envia: pergunta ao processo da conta')
  } finally {
    await db.user.deleteMany({ where: { id: userId } })
  }
})
