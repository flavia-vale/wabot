import test from 'node:test'
import assert from 'node:assert/strict'
import { runSmartLinkAlertSweep } from '../src/jobs/smartLinkAlerts.js'
import { buildAlertContent, etaPhrase } from '../src/core/smartLinkAlertMessage.js'
import { getTemplateDefinition } from '../src/email/registry.js'

const NOW = new Date('2026-09-30T18:00:00Z') // 15h BRT
const H = 3600_000
const future = new Date(NOW.getTime() + 864e5)

const sample = (size, hoursAgo = 0) => ({ size, sampledAt: new Date(NOW.getTime() - hoursAgo * H) })
const grp = (id, samples) => ({ id: `lg-${id}`, groupId: id, inviteCode: 'ABCDEFGHIJ1234', enabled: true, createdAt: new Date(), group: { id, name: `G-${id}`, memberSamples: samples }, dailyClicks: [] })

function makeDb({ links, user = { id: 'u1', name: 'Flavia Vale', email: 'f@exemplo.com', status: 'active', plan: 'pro', accessExpiresAt: future } }) {
  const updates = []
  const emails = []
  return {
    updates, emails,
    smartLink: {
      findMany: async () => links,
      update: async ({ where, data }) => { updates.push({ id: where.id, data }); const l = links.find(x => x.id === where.id); Object.assign(l, data); return l },
    },
    user: { findMany: async () => (user ? [user] : []) },
    // sendTemplateEmail sem tabelas de log (hasModel falso) não grava histórico
  }
}

const baseLink = (over = {}) => ({
  id: 'l1', userId: 'u1', name: 'Ofertas Tech', slug: 'ofertas-tech', enabled: true, capPerGroup: 1000, createdAt: new Date(),
  notifyEmail: true, notifyWhatsapp: true, alertKind: null, alertLastSentAt: null, alertReminders: 0, alertActiveGroups: null,
  groups: [grp('g1', [sample(950)]), grp('g2', [sample(930)]), grp('g3', [sample(990)])],
  ...over,
})

function harness(db, overrides = {}) {
  const wpp = []
  const mails = []
  return {
    wpp, mails,
    run: () => runSmartLinkAlertSweep({
      db, now: NOW, panelUrl: 'https://exemplo.com/painel/link-inteligente',
      sendMail: async (m) => (mails.push(m), { ok: true }),
      sendSelfMessage: async (userId, text, actor, options) => { wpp.push({ userId, text, kind: options?.kind }) },
      isRunning: async () => true,
      ...overrides,
    }),
  }
}

test('todos >= 90%: manda e-mail E WhatsApp (próprio número) e grava o estado do aviso', async () => {
  const db = makeDb({ links: [baseLink()] })
  const h = harness(db)
  const stats = await h.run()
  assert.equal(stats.sent, 1)
  assert.equal(h.mails.length, 1)
  assert.match(h.mails[0].subject, /quase cheios/)
  assert.equal(h.wpp.length, 1)
  assert.equal(h.wpp[0].kind, 'smart_link_alert')
  assert.match(h.wpp[0].text, /90%/)
  assert.equal(db.updates[0].data.alertKind, 'warn')
  assert.equal(db.updates[0].data.alertReminders, 0)
})

test('segunda passada logo depois NÃO repete (controle de repetição)', async () => {
  const db = makeDb({ links: [baseLink()] })
  const h = harness(db)
  await h.run()
  const again = await h.run()
  assert.equal(again.sent, 0)
  assert.equal(h.mails.length, 1)
  assert.equal(h.wpp.length, 1)
})

test('lotou: urgente, com envelope de urgente; escala mesmo já tendo avisado', async () => {
  const link = baseLink({ alertKind: 'warn', alertLastSentAt: new Date(NOW.getTime() - H), alertActiveGroups: 3, groups: [grp('g1', [sample(1000)]), grp('g2', [sample(1000)]), grp('g3', [sample(1000)])] })
  const db = makeDb({ links: [link] })
  const h = harness(db)
  await h.run()
  assert.match(h.mails[0].subject, /lotaram/)
  assert.equal(h.wpp[0].kind, 'smart_link_alert_urgent')
  assert.equal(db.updates[0].data.alertKind, 'urgent')
})

test('interruptores: só e-mail, só WhatsApp, e os dois desligados não envia nem grava estado', async () => {
  const onlyMail = harness(makeDb({ links: [baseLink({ notifyWhatsapp: false })] }))
  await onlyMail.run()
  assert.deepEqual([onlyMail.mails.length, onlyMail.wpp.length], [1, 0])

  const onlyWpp = harness(makeDb({ links: [baseLink({ notifyEmail: false })] }))
  await onlyWpp.run()
  assert.deepEqual([onlyWpp.mails.length, onlyWpp.wpp.length], [0, 1])

  const db = makeDb({ links: [baseLink({ notifyEmail: false, notifyWhatsapp: false })] })
  const off = harness(db)
  const stats = await off.run()
  assert.deepEqual([off.mails.length, off.wpp.length, db.updates.length, stats.skipped], [0, 0, 0, 1])
})

test('WhatsApp fora do ar: o e-mail sai e o estado é gravado (não repete o e-mail)', async () => {
  const db = makeDb({ links: [baseLink()] })
  const h = harness(db, { isRunning: async () => false })
  const stats = await h.run()
  assert.deepEqual([stats.sent, h.mails.length, h.wpp.length], [1, 1, 0])
  assert.equal(db.updates.length, 1)
})

test('nenhum canal entregou: NÃO queima o aviso (tenta de novo na próxima passada)', async () => {
  const link0 = baseLink({ notifyEmail: false })
  const db = makeDb({ links: [link0] })
  const h = harness(db, { isRunning: async () => false })
  const stats = await h.run()
  assert.deepEqual([stats.sent, stats.failed], [0, 1])
  assert.equal(link0.alertKind, null)
})

test('falha do envio por WhatsApp não derruba a passada; e-mail sem SMTP conta como não entregue', async () => {
  const links = [baseLink(), baseLink({ id: 'l2', slug: 'l2' })]
  const db = makeDb({ links })
  const h = harness(db, { sendSelfMessage: async () => { throw new Error('Timeout ao enviar') }, sendMail: async () => ({ skipped: true }) })
  const stats = await h.run()
  assert.equal(stats.failed, 2)
  assert.ok(links.every(l => l.alertKind === null), 'estado devolvido nos dois links')
})

test('Basic, conta bloqueada, link pausado ou sem medição: não avisa', async () => {
  const basic = makeDb({ links: [baseLink()], user: { id: 'u1', name: 'B', email: 'b@exemplo.com', status: 'active', plan: 'basic', accessExpiresAt: future } })
  const hb = harness(basic); await hb.run()
  const blocked = makeDb({ links: [baseLink()], user: { id: 'u1', name: 'B', email: 'b@exemplo.com', status: 'blocked', plan: 'pro', accessExpiresAt: future } })
  const hk = harness(blocked); await hk.run()
  const nodata = makeDb({ links: [baseLink({ groups: [grp('g1', [sample(990, 30)])] })] })
  const hn = harness(nodata); await hn.run()
  for (const h of [hb, hk, hn]) assert.deepEqual([h.mails.length, h.wpp.length], [0, 0])
})

test('folga real rearma sem enviar; depois, cruzar 90% de novo avisa', async () => {
  const link = baseLink({ alertKind: 'warn', alertLastSentAt: new Date(NOW.getTime() - 5 * H), alertActiveGroups: 3, groups: [grp('g1', [sample(950)]), grp('g2', [sample(600)]), grp('g3', [sample(990)])] })
  const db = makeDb({ links: [link] })
  const h = harness(db)
  const stats = await h.run()
  assert.deepEqual([stats.rearmed, stats.sent, h.mails.length], [1, 0, 0])
  assert.equal(link.alertKind, null)
  link.groups[1] = grp('g2', [sample(940)])
  const stats2 = await h.run()
  assert.equal(stats2.sent, 1)
})

test('de madrugada o aviso comum espera; o urgente sai', async () => {
  const night = new Date('2026-10-01T04:00:00Z')
  const db = makeDb({ links: [baseLink()] })
  const quiet = harness(db)
  const s1 = await runSmartLinkAlertSweep({ db, now: night, panelUrl: 'x', sendMail: async () => ({ ok: true }), sendSelfMessage: async () => {}, isRunning: async () => true })
  assert.equal(s1.sent, 0)
  const full = makeDb({ links: [baseLink({ groups: [grp('g1', [{ size: 1000, sampledAt: night }])] })] })
  const s2 = await runSmartLinkAlertSweep({ db: full, now: night, panelUrl: 'x', sendMail: async () => ({ ok: true }), sendSelfMessage: async () => {}, isRunning: async () => true })
  assert.equal(s2.sent, 1)
  assert.equal(quiet.mails.length, 0)
})

test('textos: sem jargão, com nome do link, vagas, previsão e endereço do painel', () => {
  const warn = buildAlertContent({ kind: 'warn', link: { name: 'Ofertas Tech' }, occupancy: { avgPct: 94, remainingSlots: 215, etaHours: 52, activeCount: 3 }, panelUrl: 'https://x/painel' })
  assert.equal(warn.emailSlug, 'link_inteligente_quase_cheio')
  assert.match(warn.whatsappText, /Ofertas Tech/)
  assert.match(warn.whatsappText, /215 vagas/)
  assert.match(warn.whatsappText, /cerca de 2 dias/)
  assert.match(warn.whatsappText, /https:\/\/x\/painel/)
  assert.match(buildAlertContent({ kind: 'warn', reminder: true, link: { name: 'L' }, occupancy: { avgPct: 91, remainingSlots: 5 }, panelUrl: 'u' }).whatsappText, /^Lembrete:/)
  const noEta = buildAlertContent({ kind: 'warn', link: { name: 'L' }, occupancy: { avgPct: 91, remainingSlots: 5, etaHours: null }, panelUrl: 'u' })
  assert.equal(noEta.emailVars.previsao_frase, '')
  assert.doesNotMatch(noEta.whatsappText, /acabam em/)
  const urgent = buildAlertContent({ kind: 'urgent', link: { name: 'L' }, occupancy: { activeCount: 4 }, panelUrl: 'u' })
  assert.match(urgent.whatsappText, /Grupos lotados/)
})

test('previsão: frases para horas, dias e ausência', () => {
  assert.equal(etaPhrase(0.4), 'menos de 1 hora')
  assert.equal(etaPhrase(14.2), 'cerca de 14 horas')
  assert.equal(etaPhrase(96), 'cerca de 4 dias')
  for (const bad of [null, undefined, NaN, -1]) assert.equal(etaPhrase(bad), null)
})

test('os dois e-mails existem no catálogo, são transacionais e ficam fora dos tetos (grupo próprio)', () => {
  for (const slug of ['link_inteligente_quase_cheio', 'link_inteligente_lotado']) {
    const def = getTemplateDefinition(slug)
    assert.equal(def.category, 'transactional')
    assert.equal(def.group, 'link')
  }
})

test('se NÃO conseguir gravar o estado, não envia nada (evita reenvio a cada passada)', async () => {
  const db = makeDb({ links: [baseLink()] })
  db.smartLink.update = async () => { throw new Error('banco fora') }
  const h = harness(db)
  const stats = await h.run()
  assert.deepEqual([stats.sent, stats.failed, h.mails.length, h.wpp.length], [0, 1, 0, 0])
})

test('nenhum canal entregou: o estado anterior é restaurado (não fica "avisada" sem ter avisado)', async () => {
  const link = baseLink({ notifyEmail: false })
  const db = makeDb({ links: [link] })
  const h = harness(db, { isRunning: async () => false })
  await h.run()
  assert.equal(link.alertKind, null)
  assert.equal(link.alertLastSentAt, null)
  assert.equal(db.updates.length, 2) // gravou para reservar e devolveu
})

import { describeWhatsappContactReason } from '../src/domain/admin/whatsappContactHistory.js'

test('o motivo do contato por WhatsApp aparece em português na tela da admin (nunca slug cru)', () => {
  assert.equal(describeWhatsappContactReason('alerta_link_inteligente'), 'Aviso: grupos do Link Inteligente enchendo')
})
