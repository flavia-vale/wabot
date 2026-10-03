import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyInboundChat,
  createInboundCensus,
  describeBlindness,
  blindKindHint,
  BLIND_KIND,
} from '../src/core/inboundNodeCensus.js'

// RCA 2026-10-03 (doritosmms@gmail.com, gabrielpontes@consultorfin.com): conta
// "conectada" sem receber nada das origens por horas. O bot.log não dizia se
// mensagem de GRUPO sequer chegava ao socket — descarte antes de abrir sai em
// `debug` (não vai pro arquivo) e "o servidor não mandou" não deixa linha. Este
// censo é o que separa as hipóteses.

const self = new Set(['5511999990000@s.whatsapp.net', '123456789@lid'])

test('classifica por tipo de chat; a própria conta vem antes de dm', () => {
  assert.equal(classifyInboundChat('120363@g.us'), 'grupo')
  assert.equal(classifyInboundChat('5511888@s.whatsapp.net'), 'dm')
  assert.equal(classifyInboundChat('987@lid'), 'dm')
  assert.equal(classifyInboundChat('123@newsletter'), 'canal')
  assert.equal(classifyInboundChat('status@broadcast'), 'status')
  assert.equal(classifyInboundChat('5511999990000:14@s.whatsapp.net', { selfJids: self }), 'propria')
  assert.equal(classifyInboundChat('123456789:3@lid', { selfJids: self }), 'propria')
  assert.equal(classifyInboundChat(''), 'desconhecido')
  assert.equal(classifyInboundChat(null), 'desconhecido')
})

test('conta chegada, offline e tipo de cifra por tipo de chat; amostra só as primeiras N', () => {
  const c = createInboundCensus({ sampleLimit: 2 })
  const r1 = c.noteArrival({ chatJid: 'a@g.us', offline: '1', encType: 'skmsg', now: 1000 })
  const r2 = c.noteArrival({ chatJid: 'b@g.us', encType: 'skmsg', now: 2000 })
  const r3 = c.noteArrival({ chatJid: 'c@g.us', encType: 'pkmsg', now: 3000 })
  const r4 = c.noteArrival({ chatJid: 'x@lid', encType: 'msg', now: 4000 })
  assert.deepEqual([r1.sample, r2.sample, r3.sample, r4.sample], [true, true, false, true])
  assert.equal(r1.kind, 'grupo')
  const s = c.snapshot(5000)
  assert.deepEqual(s.window.arrivals, { grupo: 3, dm: 1 })
  assert.deepEqual(s.window.arrivalsOffline, { grupo: 1 })
  assert.deepEqual(s.window.encTypes, { 'grupo:skmsg': 2, 'grupo:pkmsg': 1, 'dm:msg': 1 })
  assert.equal(s.lastGroupArrivalAgeMs, 2000)
  assert.equal(s.lastArrivalAgeMs, 1000)
})

test('descartes, falhas e upserts por tipo; a aceitação zera só o "desde a última aceitação"', () => {
  const c = createInboundCensus()
  c.noteArrival({ chatJid: 'a@g.us', now: 1 })
  c.noteIgnored('a@g.us', 'grupo_nao_monitorado')
  c.noteArrival({ chatJid: 'b@g.us', now: 2 })
  c.noteDecryptFailure('b@g.us')
  c.noteArrival({ chatJid: 'c@g.us', now: 3 })
  c.noteUpsert('c@g.us')
  let s = c.snapshot(10)
  assert.deepEqual(s.sinceLastAccepted.arrivals, { grupo: 3 })
  assert.deepEqual(s.sinceLastAccepted.ignored, { 'grupo:grupo_nao_monitorado': 1 })
  assert.deepEqual(s.sinceLastAccepted.decryptFailures, { grupo: 1 })
  assert.deepEqual(s.sinceLastAccepted.upserts, { grupo: 1 })
  assert.equal(s.lastAcceptedAgeMs, null)

  c.noteAccepted('c@g.us', { now: 20 })
  s = c.snapshot(30)
  // A janela segue inteira (é o resumo periódico); o "desde aceite" zerou.
  assert.deepEqual(s.window.arrivals, { grupo: 3 })
  assert.deepEqual(s.window.accepted, { grupo: 1 })
  assert.deepEqual(s.sinceLastAccepted.arrivals, {})
  assert.deepEqual(s.sinceLastAccepted.ignored, {})
  assert.equal(s.lastAcceptedAgeMs, 10)
  assert.equal(s.totalAccepted, 1)
})

test('drain devolve o resumo da janela e zera só a janela', () => {
  const c = createInboundCensus()
  c.noteArrival({ chatJid: 'a@g.us', now: 1000 })
  c.noteIgnored('a@g.us', 'escopo')
  const resumo = c.drain(61_000)
  assert.deepEqual(resumo.arrivals, { grupo: 1 })
  assert.deepEqual(resumo.ignored, { 'grupo:escopo': 1 })
  assert.equal(resumo.windowMs, 60_000)
  assert.deepEqual(resumo.sinceLastAccepted.arrivals, { grupo: 1 })
  const depois = c.snapshot(62_000)
  assert.deepEqual(depois.window.arrivals, {})
  assert.deepEqual(depois.sinceLastAccepted.arrivals, { grupo: 1 })
  // Janela nova sem nada dentro ainda assim resume (tudo zero) — o zero é o dado.
  const vazio = c.drain(70_000)
  assert.deepEqual(vazio.arrivals, {})
  assert.equal(vazio.windowMs, 9_000)
})

test('describeBlindness separa as hipóteses pelo balde onde o grupo some', () => {
  const c = createInboundCensus()
  assert.equal(describeBlindness(c.snapshot()).kind, BLIND_KIND.NOTHING_ARRIVES)

  c.noteArrival({ chatJid: 'a@g.us' })
  c.noteIgnored('a@g.us', 'grupo_nao_monitorado')
  assert.equal(describeBlindness(c.snapshot()).kind, BLIND_KIND.DROPPED_BY_RULE)

  c.noteArrival({ chatJid: 'a@g.us' })
  c.noteDecryptFailure('a@g.us')
  c.noteArrival({ chatJid: 'a@g.us' })
  c.noteDecryptFailure('a@g.us')
  const d = describeBlindness(c.snapshot())
  assert.equal(d.kind, BLIND_KIND.FAILS_TO_OPEN)
  assert.deepEqual([d.grupoChegou, d.grupoDescartado, d.grupoFalhou, d.grupoUpsert], [3, 1, 2, 0])

  c.noteArrival({ chatJid: 'a@g.us' })
  c.noteUpsert('a@g.us')
  assert.equal(describeBlindness(c.snapshot()).kind, BLIND_KIND.NOT_ACCEPTED)

  assert.equal(describeBlindness(null).kind, BLIND_KIND.UNKNOWN)
  assert.equal(describeBlindness({}).kind, BLIND_KIND.UNKNOWN)
})

test('DM descartada não muda o veredito de grupo (ela nunca silencia uma origem)', () => {
  const c = createInboundCensus()
  for (let i = 0; i < 50; i++) {
    c.noteArrival({ chatJid: `${i}@lid` })
    c.noteIgnored(`${i}@lid`, 'escopo')
  }
  assert.equal(describeBlindness(c.snapshot()).kind, BLIND_KIND.NOTHING_ARRIVES)
})

test('todo tipo de cegueira tem um texto de ação sem jargão', () => {
  for (const kind of Object.values(BLIND_KIND)) {
    const hint = blindKindHint(kind)
    assert.ok(hint.length > 20, kind)
  }
  assert.match(blindKindHint(BLIND_KIND.NOTHING_ARRIVES), /parear de novo/)
})
