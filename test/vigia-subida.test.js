import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { compararSubida, isMirror, pior, SEM_MARCA_DE_RESTART } from '../scripts/vigia-subida.mjs'

const pm2 = (restarts = 0) => ['api', 'dashboard', 'bot-supervisor'].map(name => ({ name, status: 'online', restarts }))
const http = { ready: 200, bots: 200, painel: 200 }
const marco = {
  commit: 'aaaaaaa',
  pm2: pm2(),
  http,
  sessions: { connected: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'], stale: 0 },
  sends: { janelaMin: 60, stuck: 0, porUsuario: { u1: { mirror: 60, outros: 30, erros: 2 }, u2: { mirror: 30, outros: 0, erros: 0 } } },
}
const saudavel = {
  commit: 'bbbbbbb',
  pm2: pm2(1),
  http,
  sessions: { connected: marco.sessions.connected, stale: 0 },
  sends: { janelaMin: 30, stuck: 0, porUsuario: { u1: { mirror: 30, outros: 15, erros: 1 }, u2: { mirror: 14, outros: 0, erros: 0 } } },
}
const niveis = (itens, titulo) => itens.filter(i => i.titulo === titulo).map(i => i.nivel)

test('subida saudável não acusa vermelho nem amarelo', () => {
  const itens = compararSubida({ marco, agora: saudavel, minutosDesde: 30 })
  assert.equal(pior(itens), '🟢', JSON.stringify(itens.filter(i => i.nivel !== '🟢')))
})

test('sessões que estavam conectadas e não voltaram: amarelo na carência, vermelho depois, com e-mail', () => {
  const agora = { ...saudavel, sessions: { connected: ['u1', 'u2', 'u3', 'u4', 'u5'], stale: 0 } }
  assert.deepEqual(niveis(compararSubida({ marco, agora, minutosDesde: 5 }), 'Sessões WhatsApp'), ['🟡'])
  const itens = compararSubida({ marco, agora, minutosDesde: 30, nomes: { u6: 'cliente@x.com' } })
  assert.deepEqual(niveis(itens, 'Sessões WhatsApp'), ['🔴'])
  assert.match(itens.find(i => i.titulo === 'Sessões WhatsApp').detalhe, /cliente@x\.com/)
})

test('espelhamento parado depois da subida é vermelho e lista as contas que pararam', () => {
  const agora = { ...saudavel, sends: { ...saudavel.sends, porUsuario: { u1: { mirror: 0, outros: 15, erros: 0 } } } }
  const itens = compararSubida({ marco, agora, minutosDesde: 30 })
  assert.deepEqual(niveis(itens, 'Espelhamento'), ['🔴'])
  assert.deepEqual(niveis(itens, 'Contas espelhando'), ['🔴'])
})

test('processo fora do ar, em loop de reinício ou API sem responder é vermelho', () => {
  const fora = { ...saudavel, pm2: pm2(1).filter(p => p.name !== 'bot-supervisor') }
  assert.ok(niveis(compararSubida({ marco, agora: fora, minutosDesde: 30 }), 'Processos').includes('🔴'))
  const loop = { ...saudavel, pm2: pm2(5) }
  assert.ok(niveis(compararSubida({ marco, agora: loop, anterior: saudavel, minutosDesde: 30 }), 'Processos').includes('🔴'))
  const semApi = { ...saudavel, http: { ...http, bots: 503 } }
  assert.deepEqual(niveis(compararSubida({ marco, agora: semApi, minutosDesde: 30 }), 'API /ready/bots'), ['🔴'])
})

test('erros e fila presa acima do marco são vermelhos', () => {
  const agora = { ...saudavel, sends: { janelaMin: 30, stuck: 12, porUsuario: { u1: { mirror: 30, outros: 0, erros: 20 }, u2: { mirror: 14, outros: 0, erros: 0 } } } }
  const itens = compararSubida({ marco, agora, minutosDesde: 30 })
  assert.deepEqual(niveis(itens, 'Erros de envio'), ['🔴'])
  assert.deepEqual(niveis(itens, 'Fila presa'), ['🔴'])
})

test('espelhamento = origem com JID; agendado/automático não conta', () => {
  assert.equal(isMirror('120363000000000000@g.us'), true)
  assert.equal(isMirror('123@newsletter'), true)
  assert.equal(isMirror('scheduled'), false)
  assert.equal(isMirror(null), false)
})

test('vigia-subida.mjs é somente leitura no banco e não mexe no pm2', () => {
  const s = fs.readFileSync(new URL('../scripts/vigia-subida.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(s, /\.(create|update|updateMany|delete|deleteMany|upsert)\(/)
  assert.doesNotMatch(s, /\$executeRaw/)
  assert.doesNotMatch(s, /'pm2', \['(restart|reload|stop|delete|kill|save)/)
})

test('filtro de marca de restart não descarta envios com errorMsg nulo (todo sucesso)', () => {
  // Regressão 2026-10-03: `NOT: { errorMsg: { startsWith } }` sozinho vira
  // NOT (NULL LIKE …) = NULL no SQLite e some com todos os sucessos.
  assert.deepEqual(SEM_MARCA_DE_RESTART.OR[0], { errorMsg: null })
  assert.deepEqual(SEM_MARCA_DE_RESTART.OR[1], { NOT: { errorMsg: { startsWith: 'error:worker_restart' } } })
})
