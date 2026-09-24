import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'

import {
  OUTSIDE_SEND_WINDOW_PREFIX,
  buildOutsideSendWindowReason,
  parseOutsideSendWindowReason,
  resolveSendWindow,
  sendWindowState,
  shouldDropOutsideSendWindow,
} from '../src/core/sendWindow.js'
import { operatingHoursState } from '../src/core/channelThrottle.js'
import { categorizeErrorMsg, ERROR_CATEGORIES } from '../src/errorTaxonomy.js'
import { explainErrorMsg } from '../dashboard/lib/painel/logsCopy.js'
import { friendlyMobileLogError } from '../dashboard/lib/mobileLogs.js'
import {
  SEND_PAUSE_KIND,
  buildSendPauseNotice,
  classifyDeferMessage,
  describeSendPause,
  summarizeQueuedByKind,
} from '../dashboard/lib/painel/sendPauseNotice.js'
import { logsRoutes } from '../src/api/routes/logs.js'
import { attachSendWindow, groupsRoutes } from '../src/api/routes/groups.js'
import db from '../src/db.js'

// RCA 2026-09-24 (frota): 45 de 48 modelos padrão com horário de envio 8h–22h
// e limite de espera de 5h. Oferta das 22h ficava adiada até as 8h e às 8h era
// descartada por idade — 547 descartes às 8h BRT em 23/09, 855 em 24/09. A
// cliente não recebia aviso nenhum. Decisão da dona do produto: opção A —
// descartar NA HORA, com motivo próprio, quando não há chance de sair a tempo.

const PRESERVATION = {
  operatingHoursEnabled: true,
  operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
  queueMaxAgeMin: 300,
}
// 23:00 BRT = 02:00Z do dia seguinte. Faltam 9h para as 8h.
const NOITE = Date.parse('2026-09-24T02:00:00Z')
// 14:00 BRT.
const TARDE = Date.parse('2026-09-24T17:00:00Z')
// 05:00 BRT: faltam 3h para abrir.
const MADRUGADA_TARDE = Date.parse('2026-09-24T08:00:00Z')

test('oferta que chega às 23h com limite de 5h é descartada na hora (caso do RCA)', () => {
  const r = shouldDropOutsideSendWindow({ now: NOITE, enqueuedAt: NOITE, preservation: PRESERVATION })
  assert.equal(r.drop, true)
  assert.equal(r.reason, 'would_expire_before_open')
  assert.equal(r.waitMs, 9 * 60 * 60_000)
  assert.equal(r.maxAgeMs, 300 * 60_000)
})

test('oferta que chega às 5h e cabe no limite (3h até abrir) NÃO é descartada', () => {
  const r = shouldDropOutsideSendWindow({ now: MADRUGADA_TARDE, enqueuedAt: MADRUGADA_TARDE, preservation: PRESERVATION })
  assert.equal(r.drop, false)
  assert.equal(r.reason, 'fits_before_open')
})

test('a idade JÁ gasta na fila soma com a espera até abrir', () => {
  // Entrou às 2h30 BRT (2h30 na fila) e são 5h: 2h30 + 3h = 5h30 > 5h → descarta.
  const r = shouldDropOutsideSendWindow({ now: MADRUGADA_TARDE, enqueuedAt: MADRUGADA_TARDE - 150 * 60_000, preservation: PRESERVATION })
  assert.equal(r.drop, true)
})

test('dentro do horário nunca descarta por aqui', () => {
  const r = shouldDropOutsideSendWindow({ now: TARDE, enqueuedAt: TARDE - 10 * 60 * 60_000, preservation: PRESERVATION })
  assert.equal(r.drop, false)
  assert.equal(r.reason, 'window_open')
})

test('limite de espera desligado (0) → espera até abrir, como antes', () => {
  for (const queueMaxAgeMin of [0, null, undefined, -5]) {
    const r = shouldDropOutsideSendWindow({ now: NOITE, enqueuedAt: NOITE, preservation: { ...PRESERVATION, queueMaxAgeMin } })
    assert.equal(r.drop, false, `queueMaxAgeMin=${queueMaxAgeMin}`)
    assert.equal(r.reason, 'max_age_disabled')
  }
})

test('horário desligado, ilegível ou 24h → não descarta', () => {
  assert.equal(shouldDropOutsideSendWindow({ now: NOITE, enqueuedAt: NOITE, preservation: { ...PRESERVATION, operatingHoursEnabled: false } }).drop, false)
  assert.equal(shouldDropOutsideSendWindow({ now: NOITE, enqueuedAt: NOITE, preservation: null }).drop, false)
  assert.equal(shouldDropOutsideSendWindow({ now: NOITE, enqueuedAt: NOITE, preservation: { ...PRESERVATION, operatingHoursJson: '{"startHour":0,"endHour":0}' } }).drop, false)
})

test('fila com horário próprio (ignoreGlobalQuietHours) não é descartada pelo horário do destino', () => {
  const r = shouldDropOutsideSendWindow({ now: NOITE, enqueuedAt: NOITE, preservation: PRESERVATION, ignoreOperatingHours: true })
  assert.equal(r.drop, false)
  assert.equal(r.reason, 'source_has_own_hours')
})

test('sem carimbo de entrada a idade conta como zero (só descarta se a espera sozinha estoura)', () => {
  assert.equal(shouldDropOutsideSendWindow({ now: NOITE, enqueuedAt: null, preservation: PRESERVATION }).drop, true)
  assert.equal(shouldDropOutsideSendWindow({ now: MADRUGADA_TARDE, enqueuedAt: 'x', preservation: PRESERVATION }).drop, false)
})

test('janela que cruza a meia-noite (20h–2h) é lida certo', () => {
  const p = { ...PRESERVATION, operatingHoursJson: '{"startHour":20,"endHour":2,"tz":"America/Sao_Paulo"}' }
  assert.equal(sendWindowState(NOITE, resolveSendWindow(p)).open, true, '23h está dentro de 20h–2h')
  assert.equal(sendWindowState(TARDE, resolveSendWindow(p)).open, false, '14h está fora de 20h–2h')
})

test('sendWindowState concorda com operatingHoursState do robô (mesmo relógio)', () => {
  const hours = { startHour: 8, endHour: 22, tz: 'America/Sao_Paulo' }
  for (let h = 0; h < 48; h++) {
    const now = Date.parse('2026-09-23T00:00:00Z') + h * 30 * 60_000 + 7 * 60_000
    const a = sendWindowState(now, hours)
    const b = operatingHoursState(now, hours)
    assert.equal(a.open, b.inOperating, `hora ${new Date(now).toISOString()}`)
    assert.equal(a.waitMs, b.deferMs, `espera em ${new Date(now).toISOString()}`)
  }
})

// ---------- motivo, taxonomia e linguagem ----------

test('motivo canônico carrega horário e limite, e cai em CONFIG_BLOCK', () => {
  const reason = buildOutsideSendWindowReason(shouldDropOutsideSendWindow({ now: NOITE, enqueuedAt: NOITE, preservation: PRESERVATION }))
  assert.equal(reason, `${OUTSIDE_SEND_WINDOW_PREFIX}:hours=8-22:max=300min`)
  assert.deepEqual(parseOutsideSendWindowReason(reason), { startHour: 8, endHour: 22, maxMin: 300 })
  assert.equal(categorizeErrorMsg(reason), ERROR_CATEGORIES.CONFIG_BLOCK)
})

test('painel e celular explicam em linguagem leiga, com o horário, sem jargão', () => {
  const reason = 'skip:outside_send_window:hours=8-22:max=300min'
  for (const texto of [explainErrorMsg(reason), friendlyMobileLogError(reason)]) {
    assert.match(texto, /horário de envio/)
    assert.match(texto, /8h–22h/)
    assert.match(texto, /Anti-banimento/)
    assert.doesNotMatch(texto, /skip:|outside_send_window|queueMaxAge|preset|throttle|Preservação por/i)
  }
  // Sem os números o texto continua fazendo sentido.
  assert.match(explainErrorMsg('skip:outside_send_window'), /horário de envio/)
})

// ---------- fiação no robô ----------

const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('processSendJob descarta fora do horário DEPOIS do descarte por idade e ANTES do smart delay', () => {
  const start = botWorkerSource.indexOf('async function processSendJob(job)')
  assert.notEqual(start, -1)
  const body = botWorkerSource.slice(start)
  const idade = body.indexOf('shouldDropExpiredQueueJob({')
  const horario = body.indexOf('shouldDropOutsideSendWindow({')
  const smartDelay = body.indexOf('calculateRestWindowDelayMs({')
  assert.ok(idade > 0 && horario > idade && smartDelay > horario, 'ordem canônica: idade → horário → smart delay')
  assert.match(body.slice(horario, smartDelay), /ignoreOperatingHours: job\.ignoreGlobalQuietHours === true/)
  assert.match(body.slice(horario, smartDelay), /buildOutsideSendWindowReason\(windowDrop\)/)
})

// ---------- tela de Espelhamento ----------

const pageSource = readFileSync(new URL('../dashboard/app/painel/espelhamento/page.js', import.meta.url), 'utf8')

const shellSource = readFileSync(new URL('../dashboard/app/painel/PainelShell.js', import.meta.url), 'utf8')

test('o aviso "robô esperando o Anti-banimento" é GLOBAL (shell), com link para o Anti-banimento', () => {
  assert.match(shellSource, /function SendPauseBanner\(\{ notice \}\)/)
  assert.match(shellSource, /data-testid="robo-esperando-anti-banimento"/)
  assert.match(shellSource, /<SendPauseBanner notice=\{sendPauseNotice\} \/>/)
  assert.match(shellSource, /buildSendPauseNotice\(\{ groups: groupsList, queued: sendPauseQueued, online, now: Date\.now\(\) \}\)/)
  assert.match(shellSource, /api\.sendPause\(\)/, 'a shell precisa perguntar a fila segurada no mesmo tick dos grupos')
  assert.match(shellSource, /<Link href=\{notice\.ctaHref\} className="pnl-btn is-primary"/)
  // A tela de Espelhamento não duplica o aviso: ela já está dentro da shell.
  assert.doesNotMatch(pageSource, /describeSendPause\(/)
})

const dest = (name, sendWindow) => ({ id: name, name, role: 'post', sendWindow })
const JANELA = { startHour: 8, endHour: 22, tz: 'America/Sao_Paulo' }

test('todos os destinos fora do horário → aviso com a janela e a hora de volta', () => {
  const aviso = describeSendPause([dest('A', JANELA), dest('B', JANELA), { id: 'm', role: 'monitor' }], NOITE)
  assert.ok(aviso)
  assert.equal(aviso.title, 'Envio pausado agora: fora do horário (8h–22h)')
  assert.match(aviso.detail, /voltam a sair às 8h/)
  assert.deepEqual(aviso.destinations.map(d => d.name), ['A', 'B'])
})

test('algum destino aberto, sem horário ou dentro do horário → sem aviso', () => {
  assert.equal(describeSendPause([dest('A', JANELA), dest('B', null)], NOITE), null)
  assert.equal(describeSendPause([dest('A', JANELA)], TARDE), null)
  assert.equal(describeSendPause([dest('A', null)], NOITE), null)
  assert.equal(describeSendPause([], NOITE), null)
})

// ---------- GET /groups devolve o horário efetivo ----------

test('attachSendWindow resolve pelo modelo padrão da conta e pelo override do grupo', () => {
  const presets = [
    { id: 'p-default', isDefault: true, operatingHoursEnabled: true, operatingHoursJson: JSON.stringify(JANELA), queueMaxAgeMin: 300 },
    { id: 'p-24h', isDefault: false, operatingHoursEnabled: false },
  ]
  const [semModelo, comModelo, override, origem] = attachSendWindow([
    { id: 'a', role: 'post', preservationPresetId: null },
    { id: 'b', role: 'post', preservationPresetId: 'p-24h' },
    { id: 'c', role: 'post', preservationPresetId: null, operatingHoursEnabled: true, operatingHoursJson: '{"startHour":6,"endHour":23,"tz":"America/Sao_Paulo"}' },
    { id: 'm', role: 'monitor' },
  ], presets)
  assert.deepEqual(semModelo.sendWindow, JANELA)
  assert.equal(comModelo.sendWindow, null)
  assert.deepEqual(override.sendWindow, { startHour: 6, endHour: 23, tz: 'America/Sao_Paulo' })
  assert.equal('sendWindow' in origem, false)
})

test('GET /api/groups carrega sendWindow do modelo padrão (mesma resolução do robô)', async () => {
  const userId = `user-send-window-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Janela', email: `${userId}@send-window.local`, passwordHash: 'x', plan: 'pro' } })
  await db.preservationPreset.create({ data: { userId, name: 'Padrão', isDefault: true, operatingHoursEnabled: true, operatingHoursJson: JSON.stringify(JANELA) } })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  app.addHook('onClose', async () => {
    await db.group.deleteMany({ where: { userId } })
    await db.preservationPreset.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  await app.register(groupsRoutes, {
    prefix: '/api/groups',
    channelMetadata: async () => null,
    followChannelImmediate: async () => ({ followed: 'new' }),
    listFollowedChannels: async () => [],
    isRunning: () => true,
    reloadConfig: async () => true,
  })
  try {
    await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: `d-${Math.random()}@g.us`, name: 'Destino', role: 'post', kind: 'group' } })
    await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: `o-${Math.random()}@g.us`, name: 'Origem', role: 'monitor', kind: 'group' } })
    const res = await app.inject({ method: 'GET', url: '/api/groups' })
    assert.equal(res.statusCode, 200)
    const list = JSON.parse(res.body)
    const destino = list.find(g => g.role === 'post')
    const origem = list.find(g => g.role === 'monitor')
    assert.deepEqual(destino.sendWindow, JANELA)
    assert.equal(origem.sendWindow, undefined)
  } finally {
    await app.close()
  }
})

// ---------- o aviso global: motivos da fila + prioridade ----------

test('toda frase de deferReasonMessage (bot-worker) cai num tipo conhecido — senão o aviso some em silêncio', () => {
  const fn = botWorkerSource.match(/function deferReasonMessage\(reason\) \{[\s\S]*?\n\}\n/)
  assert.ok(fn, 'deferReasonMessage não encontrada')
  const frases = [...fn[0].matchAll(/return '([^'\\]{10,})'/g)].map(m => m[1])
  assert.ok(frases.length >= 6, `esperava as frases de adiamento, achei ${frases.length}`)
  for (const frase of frases) {
    assert.ok(classifyDeferMessage(frase), `frase sem tipo: "${frase}"`)
  }
  assert.equal(classifyDeferMessage('Este grupo/canal já bateu o limite diário de ofertas configurado no Anti-banimento. Os envios continuam amanhã.'), SEND_PAUSE_KIND.LIMITE_DIARIO)
  assert.equal(classifyDeferMessage('Fora do horário de envio configurado para este grupo/canal no Anti-banimento.'), SEND_PAUSE_KIND.HORARIO)
  assert.equal(classifyDeferMessage('O bot pausou os envios para este grupo/canal por segurança. Deve voltar sozinho em breve.'), SEND_PAUSE_KIND.SEGURANCA)
  assert.equal(classifyDeferMessage('Esperando o intervalo entre destinos que você definiu no Anti-banimento.'), SEND_PAUSE_KIND.RITMO)
  // Linha `queued` sem motivo é envio normal em vôo — não é espera.
  assert.equal(classifyDeferMessage(null), null)
  assert.equal(classifyDeferMessage(''), null)
  assert.equal(classifyDeferMessage('skip:queue_expired:age=300min:max=300min'), null)
})

test('summarizeQueuedByKind conta por tipo e acha a mais antiga', () => {
  const r = summarizeQueuedByKind([
    { errorMsg: 'Esperando o intervalo mínimo entre uma oferta e outra deste grupo/canal, configurado no Anti-banimento.', sentAt: new Date(TARDE - 5 * 60_000) },
    { errorMsg: 'Este grupo/canal já bateu o limite diário de ofertas configurado no Anti-banimento. Os envios continuam amanhã.', sentAt: new Date(TARDE - 40 * 60_000) },
    { errorMsg: null, sentAt: new Date(TARDE) },
  ])
  assert.deepEqual(r.byKind, { ritmo: 1, limite_diario: 1 })
  assert.equal(r.total, 2)
  assert.equal(r.oldestAt, new Date(TARDE - 40 * 60_000).toISOString())
})

test('aviso global: robô desconectado ou nada segurado → null', () => {
  assert.equal(buildSendPauseNotice({ groups: [dest('A', JANELA)], queued: { total: 3, byKind: { ritmo: 3 } }, online: false, now: NOITE }), null)
  assert.equal(buildSendPauseNotice({ groups: [dest('A', JANELA)], queued: null, online: true, now: TARDE }), null)
  assert.equal(buildSendPauseNotice({ groups: [dest('A', JANELA)], queued: { total: 0, byKind: {} }, online: true, now: TARDE }), null)
})

test('aviso global: horário fechado ganha de tudo; depois limite diário; depois segurança; depois ritmo — sempre com link para o Anti-banimento', () => {
  const horario = buildSendPauseNotice({ groups: [dest('A', JANELA)], queued: { total: 2, byKind: { ritmo: 2 } }, online: true, now: NOITE })
  assert.equal(horario.kind, SEND_PAUSE_KIND.HORARIO)
  assert.match(horario.title, /fora do horário \(8h–22h\)/)

  const diario = buildSendPauseNotice({ groups: [dest('A', JANELA)], queued: { total: 5, byKind: { ritmo: 4, limite_diario: 1 }, oldestAt: new Date(TARDE - 90 * 60_000).toISOString() }, online: true, now: TARDE })
  assert.equal(diario.kind, SEND_PAUSE_KIND.LIMITE_DIARIO)
  assert.match(diario.body, /5 ofertas estão na fila \(a mais antiga há 1h 30min\)/)
  assert.match(diario.body, /voltam a sair amanhã/)

  const seguranca = buildSendPauseNotice({ groups: [], queued: { total: 1, byKind: { seguranca: 1, ritmo: 0 } }, online: true, now: TARDE })
  assert.equal(seguranca.kind, SEND_PAUSE_KIND.SEGURANCA)

  const ritmo = buildSendPauseNotice({ groups: [], queued: { total: 1, byKind: { ritmo: 1 } }, online: true, now: TARDE })
  assert.equal(ritmo.kind, SEND_PAUSE_KIND.RITMO)
  assert.match(ritmo.title, /tempo que você definiu no Anti-banimento/)

  for (const n of [horario, diario, seguranca, ritmo]) {
    assert.equal(n.ctaHref, '/painel/anti-banimento?parte=ritmo')
    assert.match(n.ctaLabel, /Anti-banimento/)
    assert.doesNotMatch(`${n.title} ${n.body}`, /burst|throttle|preset|jitter|cap\b|preservação por/i)
  }
})

test('GET /api/logs/send-pause resume a fila segurada da conta', async () => {
  const userId = `user-send-pause-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Fila', email: `${userId}@send-pause.local`, passwordHash: 'x', plan: 'pro' } })
  await db.messageLog.createMany({ data: [
    { userId, sourceGroup: 'o@g.us', destGroup: 'd@g.us', originalUrl: '', convertedUrl: '', messageText: 'a', platform: 'shopee', status: 'queued', errorMsg: 'Esperando o intervalo entre destinos que você definiu no Anti-banimento.' },
    { userId, sourceGroup: 'o@g.us', destGroup: 'd@g.us', originalUrl: '', convertedUrl: '', messageText: 'b', platform: 'shopee', status: 'queued', errorMsg: null },
    { userId, sourceGroup: 'o@g.us', destGroup: 'd@g.us', originalUrl: '', convertedUrl: '', messageText: 'c', platform: 'shopee', status: 'success', errorMsg: null },
  ] })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  app.addHook('onClose', async () => {
    await db.messageLog.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  await app.register(logsRoutes, { prefix: '/api/logs' })
  try {
    const res = await app.inject({ method: 'GET', url: '/api/logs/send-pause' })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.equal(body.queued.total, 1)
    assert.deepEqual(body.queued.byKind, { ritmo: 1 })
    assert.ok(body.queued.oldestAt)
  } finally {
    await app.close()
  }
})
