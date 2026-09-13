// B2 do plano de ativação de 2026-09-08 — avisar sobre quem PEDIU a conexão do
// WhatsApp e não conseguiu.
//
// 11 das 114 pessoas que não pagaram nos 60 dias medidos caem nesse balde, e
// três delas em 22 e 23/08 — o que tem cara de incidente, não de acaso. O funil
// separa esse caso de "nem chegou a pedir" justamente para defeito de produto
// não se esconder atrás de "ela não quis"; faltava o número chegar a alguém.
//
// Puro + carregador com db injetado: roda sem banco e sem rede.

import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

import {
  describeStalledPairings,
  selectStalledPairings,
  PAIRING_STALLED_MIN_HOURS,
  PAIRING_STALLED_MAX_HOURS,
  PAIRING_STALLED_MAX_LISTED,
} from '../src/emailTriggers/pairingStalled.js'
import { runPairingStalledSweep } from '../src/emailTriggers/pairingStalledSweep.js'
import { getTemplateDefinition } from '../src/email/registry.js'

const NOW = new Date('2026-09-08T12:00:00Z')
const hAtras = (n) => new Date(NOW.getTime() - n * 3600000)
const sessao = (extra = {}) => ({
  userId: 'u1',
  email: 'ana@exemplo.com',
  name: 'Ana',
  status: 'disconnected',
  phone: null,
  lastHeartbeatAt: null,
  updatedAt: hAtras(30),
  ...extra,
})

// --- Quem entra ---------------------------------------------------------------

test('pediu a conexão há mais de um dia e não conectou', () => {
  const r = selectStalledPairings({ sessions: [sessao()], now: NOW })
  assert.equal(r.length, 1)
  assert.equal(r[0].horas, 30)
})

test('reconexão normal não vira alarme', () => {
  // Uma queda se resolve em minutos; avisar em cima disso seria alarme falso
  // recorrente, que treina a pessoa a ignorar justamente este aviso.
  const r = selectStalledPairings({ sessions: [sessao({ updatedAt: hAtras(2) })], now: NOW })
  assert.equal(r.length, 0)
  assert.equal(PAIRING_STALLED_MIN_HOURS, 24)
})

test('para de insistir depois de uma semana', () => {
  // Quem tentou há 20 dias e não voltou é assunto de recuperação, não incidente.
  const r = selectStalledPairings({ sessions: [sessao({ updatedAt: hAtras(400) })], now: NOW })
  assert.equal(r.length, 0)
  assert.equal(PAIRING_STALLED_MAX_HOURS, 168)
})

test('quem JÁ conectou alguma vez não entra', () => {
  // Quem conectou e caiu tem o aviso de "robô fora do ar" — outra conversa,
  // outra ação.
  for (const extra of [
    { everConnected: true },
    { status: 'connected' },
    { phone: '5511999999999' },
    { lastHeartbeatAt: hAtras(50) },
  ]) {
    const r = selectStalledPairings({ sessions: [sessao(extra)], now: NOW })
    assert.equal(r.length, 0, JSON.stringify(extra))
  }
})

test('sem data confiável não conta', () => {
  const r = selectStalledPairings({ sessions: [sessao({ updatedAt: null }), sessao({ updatedAt: 'ontem' })], now: NOW })
  assert.equal(r.length, 0)
})

test('as que esperam há mais tempo aparecem primeiro', () => {
  const r = selectStalledPairings({
    sessions: [
      sessao({ userId: 'a', updatedAt: hAtras(30) }),
      sessao({ userId: 'b', updatedAt: hAtras(100) }),
      sessao({ userId: 'c', updatedAt: hAtras(50) }),
    ],
    now: NOW,
  })
  assert.deepEqual(r.map((x) => x.userId), ['b', 'c', 'a'])
})

// --- O texto ------------------------------------------------------------------

test('a lista é curta e o resto vira contagem', () => {
  const muitas = Array.from({ length: 25 }, (_, i) => ({ userId: `u${i}`, email: `u${i}@x.com`, name: null, horas: 30 }))
  const d = describeStalledPairings(muitas)
  assert.equal(d.total, 25)
  assert.equal(d.lista.split('\n').length, PAIRING_STALLED_MAX_LISTED + 1)
  assert.match(d.lista, /e mais 15/)
})

test('uma pessoa só não vira "1 pessoas"', () => {
  const d = describeStalledPairings([{ userId: 'a', email: 'a@x.com', name: null, horas: 30 }])
  assert.match(d.resumo, /^1 pessoa pediu/)
})

test('o aviso diz que o obstáculo é NOSSO', () => {
  const t = getTemplateDefinition('admin_conexao_falhou')
  assert.ok(t)
  assert.equal(t.audience, 'admin')
  assert.equal(t.group, 'interno')
  assert.match(t.body, /obstáculo nosso/)
  assert.match(t.body, /incidente/)
})

// --- O carregador -------------------------------------------------------------

function fakeDb(sessions) {
  return { waSession: { findMany: async () => sessions } }
}

test('conta banida ou suspensa fica de fora', async () => {
  const db = fakeDb([
    { userId: 'a', status: 'disconnected', phone: null, lastHeartbeatAt: null, updatedAt: hAtras(30), user: { email: 'a@x.com', name: 'A', status: 'banned' } },
    { userId: 'b', status: 'disconnected', phone: null, lastHeartbeatAt: null, updatedAt: hAtras(30), user: { email: 'b@x.com', name: 'B', status: 'suspended' } },
  ])
  const r = await runPairingStalledSweep({ db, now: NOW, sendMail: async () => ({ sent: true }) })
  assert.equal(r.found, 0)
  assert.equal(r.reason, 'ninguem_travado')
})

test('falha no banco não derruba a passada de e-mails da cliente', async () => {
  const db = { waSession: { findMany: async () => { throw new Error('SQLITE_BUSY') } } }
  const r = await runPairingStalledSweep({ db, now: NOW })
  assert.equal(r.found, 0)
  assert.equal(r.reason, 'falhou')
})

test('roda no tick que já existe — nenhum processo novo', () => {
  const server = readFileSync(new URL('../src/api/server.js', import.meta.url), 'utf8')
  assert.match(server, /runPairingStalledSweep\(/)
  // Dentro do tick dos e-mails de ciclo de vida, não num setInterval próprio.
  const tick = server.slice(server.indexOf('async function runLifecycleEmailTick'), server.indexOf('function startLifecycleEmailSweep'))
  assert.match(tick, /runPairingStalledSweep/)
})
