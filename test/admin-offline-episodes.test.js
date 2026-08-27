import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOfflineEpisodesByUser,
  summarizeEpisodes,
  summarizeOfflineEpisodesByUser,
  presentOfflineEpisodes,
} from '../src/core/offlineEpisodes.js'

const USER = 'u1'
const NOW = new Date('2026-08-26T12:00:00Z')

function ev(type, at, metadata = {}, extra = {}) {
  return { userId: USER, type, occurredAt: at, metadata: JSON.stringify(metadata), ...extra }
}

function episodesOf(events, now = NOW) {
  return buildOfflineEpisodesByUser(events, { now }).get(USER) || []
}

test('queda que volta sozinha vira episódio fechado como sozinho', () => {
  const [episode] = episodesOf([
    ev('disconnect', '2026-08-26T10:00:00Z', { stuckMsg: true }, { code: '500' }),
    ev('reconnect_success', '2026-08-26T10:04:00Z'),
  ])
  assert.equal(episode.endedBy, 'sozinho')
  assert.equal(episode.durationMs, 4 * 60_000)
  assert.equal(episode.stuckMsg, true)
  assert.equal(episode.code, '500')
  assert.equal(episode.open, false)
})

// DEFEITO 1 (RCA 2026-08-26): a versão anterior fazia startedByUser.delete no
// evento manual e o tempo em que a cliente ficou parada ANTES de re-parear
// sumia da conta. O pior caso somava zero.
test('ação da cliente NÃO descarta o episódio: fecha como cliente e soma o tempo', () => {
  const [episode] = episodesOf([
    ev('disconnect', '2026-08-26T06:00:00Z'),
    ev('manual_pairing_requested', '2026-08-26T09:00:00Z'),
    ev('connected', '2026-08-26T09:05:00Z'),
  ])
  assert.equal(episode.endedBy, 'cliente')
  assert.equal(episode.durationMs, 3 * 60 * 60_000 + 5 * 60_000)

  const metrics = summarizeEpisodes([episode], { since: new Date('2026-08-25T12:00:00Z'), now: NOW })
  assert.equal(metrics.manualRecoveries, 1)
  assert.equal(metrics.manualReconnects, 1)
  assert.equal(metrics.automaticRecoveries, 0)
  assert.equal(metrics.manualOfflineMs, 3 * 60 * 60_000 + 5 * 60_000)
  assert.equal(metrics.automaticOfflineMs, 0, 'tempo de ação da cliente não pode virar tempo automático')
})

// DEFEITO 2: pareamento queda↔volta era feito só dentro da janela; queda que
// começou antes do recorte perdia o par e não contava nem recuperação nem tempo.
test('episódio iniciado antes da janela conta a recuperação e o tempo recortado', () => {
  const episodes = episodesOf([
    ev('disconnect', '2026-08-25T23:50:00Z'),
    ev('reconnect_success', '2026-08-26T00:10:00Z'),
  ])
  const since = new Date('2026-08-26T00:00:00Z')
  const metrics = summarizeEpisodes(episodes, { since, now: NOW })
  assert.equal(metrics.automaticRecoveries, 1, 'a recuperação não pode sumir por causa do recorte')
  assert.equal(metrics.automaticOfflineMs, 10 * 60_000, 'só o tempo dentro da janela')
  assert.equal(metrics.longestAutomaticOfflineMs, 20 * 60_000, 'a duração cheia continua visível')
})

test('episódio ainda aberto vira ongoingOfflineMs e não conta como recuperação', () => {
  const episodes = episodesOf([ev('disconnect', '2026-08-26T11:40:00Z')])
  const metrics = summarizeEpisodes(episodes, { since: new Date('2026-08-25T12:00:00Z'), now: NOW })
  assert.equal(metrics.ongoingOfflineMs, 20 * 60_000)
  assert.equal(metrics.automaticRecoveries, 0)
  assert.equal(metrics.manualRecoveries, 0)
})

test('logout/auth apagado abre episódio terminal e só fecha como cliente', () => {
  const [episode] = episodesOf([
    ev('auth_reset', '2026-08-26T08:00:00Z'),
    ev('connected', '2026-08-26T08:30:00Z'),
  ])
  assert.equal(episode.terminal, true)
  assert.equal(episode.endedBy, 'cliente', 'sessão deslogada não volta sozinha')
  const metrics = summarizeEpisodes([episode], { since: new Date('2026-08-25T12:00:00Z'), now: NOW })
  assert.equal(metrics.terminalEpisodes, 1)
  assert.equal(metrics.manualOfflineMs, 30 * 60_000)
})

test('parada pedida pela cliente e pareamento não abrem episódio', () => {
  assert.equal(episodesOf([ev('disconnect', '2026-08-26T10:00:00Z', { manual: true })]).length, 0)
  assert.equal(episodesOf([ev('disconnect', '2026-08-26T10:00:00Z', { pairing: true })]).length, 0)
})

test('quedas repetidas sem volta no meio continuam UM episódio só', () => {
  const episodes = episodesOf([
    ev('disconnect', '2026-08-26T10:00:00Z'),
    ev('disconnect', '2026-08-26T10:02:00Z'),
    ev('disconnect', '2026-08-26T10:04:00Z'),
    ev('connected', '2026-08-26T10:06:00Z'),
  ])
  assert.equal(episodes.length, 1)
  assert.equal(episodes[0].durationMs, 6 * 60_000)
})

test('eventos fora de ordem são ordenados antes de parear', () => {
  const [episode] = episodesOf([
    ev('reconnect_success', '2026-08-26T10:04:00Z'),
    ev('disconnect', '2026-08-26T10:00:00Z'),
  ])
  assert.equal(episode.endedBy, 'sozinho')
  assert.equal(episode.durationMs, 4 * 60_000)
})

test('evento com data inválida ou sem usuário é ignorado sem quebrar', () => {
  const map = buildOfflineEpisodesByUser([
    { userId: USER, type: 'disconnect', occurredAt: 'nao-e-data', metadata: '{}' },
    { type: 'disconnect', occurredAt: '2026-08-26T10:00:00Z', metadata: '{}' },
    ev('disconnect', '2026-08-26T10:00:00Z', 'metadata quebrada'),
    ev('connected', '2026-08-26T10:01:00Z'),
  ], { now: NOW })
  assert.equal((map.get(USER) || []).length, 1)
})

test('separa episódios por usuário', () => {
  const map = buildOfflineEpisodesByUser([
    { userId: 'a', type: 'disconnect', occurredAt: '2026-08-26T10:00:00Z', metadata: '{}' },
    { userId: 'b', type: 'disconnect', occurredAt: '2026-08-26T10:01:00Z', metadata: '{}' },
    { userId: 'a', type: 'connected', occurredAt: '2026-08-26T10:02:00Z', metadata: '{}' },
  ], { now: NOW })
  assert.equal(map.get('a')[0].endedBy, 'sozinho')
  assert.equal(map.get('b')[0].open, true)
})

test('summarizeOfflineEpisodesByUser devolve métricas por usuário', () => {
  const metrics = summarizeOfflineEpisodesByUser([
    ev('disconnect', '2026-08-26T10:00:00Z'),
    ev('reconnect_success', '2026-08-26T10:05:00Z'),
  ], { since: new Date('2026-08-25T12:00:00Z'), now: NOW })
  assert.equal(metrics.get(USER).automaticRecoveries, 1)
  assert.equal(metrics.get(USER).automaticOfflineMs, 5 * 60_000)
})

test('linha do tempo sai mais recente primeiro, com datas ISO e limite', () => {
  const episodes = episodesOf([
    ev('disconnect', '2026-08-26T08:00:00Z'),
    ev('connected', '2026-08-26T08:10:00Z'),
    ev('disconnect', '2026-08-26T10:00:00Z'),
    ev('connected', '2026-08-26T10:05:00Z'),
  ])
  const rows = presentOfflineEpisodes(episodes, { limit: 1 })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].startedAt, '2026-08-26T10:00:00.000Z')
  assert.equal(rows[0].endedAt, '2026-08-26T10:05:00.000Z')
  assert.equal(rows[0].endedBy, 'sozinho')
})
