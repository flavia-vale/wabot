import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { diagnoseEnvios } from '../src/domain/admin/diagnostics/envios.js'
import { stopSessionOnPurpose, validateStopReason, STOP_REASON_MIN } from '../src/domain/session/stopSession.js'

// M2 da auditoria: Ficha 360 → aba Robô com Parar, motivo e "por que não envia".

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const NOW = 1_800_000_000_000

const saudavel = () => ({
  nowMs: NOW,
  hours: 6,
  user: { status: 'active', accessExpiresAt: new Date(NOW + 86_400_000) },
  canUseChannels: true,
  workerRunning: true,
  session: { status: 'connected', lifecycle: 'ready', lastHeartbeatAt: new Date(NOW - 30_000) },
  groups: [
    { id: 'm1', name: 'Origem', role: 'monitor', kind: 'group' },
    { id: 'p1', name: 'Destino', role: 'post', kind: 'group' },
  ],
  targets: [{ monitorId: 'm1', postId: 'p1' }],
  logs: { total: 10, byStatus: { success: 10 }, lastSentAt: new Date(NOW - 60_000) },
  stuckSending: 0,
  dlqTotal: 0,
})

test('cadeia saudável: nenhum elo quebrado', () => {
  const r = diagnoseEnvios(saudavel())
  assert.equal(r.veredito.ok, true)
  assert.equal(r.problemas.length, 0)
  assert.deepEqual(r.elos.map(e => e.id), ['conta', 'robo', 'sessao', 'grupos', 'envios'])
})

test('o veredito é o PRIMEIRO elo que falha, na ordem da cadeia', () => {
  const r = diagnoseEnvios({ ...saudavel(), workerRunning: false, session: { status: 'disconnected', lifecycle: 'ready' } })
  assert.equal(r.veredito.eloId, 'robo')
  assert.equal(r.elos.find(e => e.id === 'sessao').ok, false)
})

test('conta bloqueada ou com acesso vencido', () => {
  assert.equal(diagnoseEnvios({ ...saudavel(), user: { status: 'suspended' } }).veredito.eloId, 'conta')
  assert.equal(diagnoseEnvios({ ...saudavel(), user: { status: 'active', accessExpiresAt: new Date(NOW - 1) } }).veredito.eloId, 'conta')
})

test('robô: false = parado; null = não sei (não afirma que está parado)', () => {
  assert.match(diagnoseEnvios({ ...saudavel(), workerRunning: false }).veredito.frase, /Não há robô rodando/)
  assert.match(diagnoseEnvios({ ...saudavel(), workerRunning: null }).veredito.frase, /Não consegui saber/)
})

test('sessão: parada de propósito, sem sessão, conectada sem sinal', () => {
  assert.match(diagnoseEnvios({ ...saudavel(), session: { status: 'disconnected', lifecycle: 'stopped_by_user' } }).veredito.frase, /de propósito/)
  assert.match(diagnoseEnvios({ ...saudavel(), session: null }).veredito.frase, /nunca conectou/)
  const cega = diagnoseEnvios({ ...saudavel(), session: { status: 'connected', lifecycle: 'ready', lastHeartbeatAt: new Date(NOW - 10 * 60_000) } })
  assert.match(cega.veredito.frase, /sinal há mais de 5 minutos/)
})

test('grupos: sem destino ligado e canal bloqueado pelo plano', () => {
  const semDestino = diagnoseEnvios({ ...saudavel(), targets: [] })
  assert.equal(semDestino.veredito.eloId, 'grupos')
  assert.match(semDestino.veredito.frase, /"Origem" não tem nenhum destino/)
  const canal = diagnoseEnvios({
    ...saudavel(),
    canUseChannels: false,
    groups: [{ id: 'm1', name: 'Canal X', role: 'monitor', kind: 'channel' }, { id: 'p1', name: 'D', role: 'post', kind: 'group' }],
  })
  assert.match(canal.problemas.join(' '), /não libera canais/)
  assert.equal(diagnoseEnvios({ ...saudavel(), groups: [] }).elos.find(e => e.id === 'grupos').frases.length, 2)
})

test('envios: presos, fila de erros e maioria falhando; dlq null = indisponível, não erro', () => {
  assert.match(diagnoseEnvios({ ...saudavel(), stuckSending: 3 }).veredito.frase, /3 envio\(s\) preso/)
  assert.match(diagnoseEnvios({ ...saudavel(), dlqTotal: 4 }).veredito.frase, /fila de erros/)
  const falhando = diagnoseEnvios({ ...saudavel(), logs: { total: 10, byStatus: { failed: 6, success: 4 } } })
  assert.match(falhando.veredito.frase, /6 de 10 envios/)
  assert.equal(diagnoseEnvios({ ...saudavel(), dlqTotal: null }).veredito.ok, true)
})

test('tudo certo mas sem envio na janela: diz que o grupo provavelmente não publicou', () => {
  const r = diagnoseEnvios({ ...saudavel(), logs: { total: 0, byStatus: {}, lastSentAt: null } })
  assert.equal(r.veredito.ok, true)
  assert.match(r.veredito.frase, /não houve envio/)
})

test('parar: motivo mínimo e cortado em 300', () => {
  assert.equal(validateStopReason({ reason: 'abc' }).ok, false)
  assert.equal(validateStopReason({}).ok, false)
  assert.match(validateStopReason({ reason: ' ' }).error, new RegExp(String(STOP_REASON_MIN)))
  assert.equal(validateStopReason({ reason: ' pedido da cliente ' }).reason, 'pedido da cliente')
  assert.equal(validateStopReason({ reason: 'x'.repeat(999) }).reason.length, 300)
})

test('parar: marca stopped_by_user ANTES do stopBot e grava o evento; stopBot falho não derruba', async () => {
  const ordem = []
  const db = { waSession: { updateMany: async (q) => { ordem.push(['marca', q.data.lifecycle]); return { count: 1 } } } }
  const r = await stopSessionOnPurpose({
    db,
    userId: 'u1',
    stopBot: async () => { ordem.push(['stopBot']); throw new Error('supervisor fora') },
    isRunning: async () => true,
    record: (e) => ordem.push(['evento', e.type, e.metadata.source, e.metadata.reason]),
    eventType: 'manual_stop_requested',
    source: 'admin',
    metadata: { reason: 'teste de motivo' },
  })
  assert.deepEqual(ordem.map(o => o[0]), ['marca', 'evento', 'stopBot'])
  assert.deepEqual(ordem[1], ['evento', 'manual_stop_requested', 'admin', 'teste de motivo'])
  assert.equal(r.rodando, true)
  assert.match(r.parado, /erro: supervisor fora/)
})

test('rota de parar: tech:write, motivo, auditoria e função única (sem duplicar o script)', () => {
  const src = read('src/api/routes/admin.js')
  const ini = src.indexOf("app.post('/users/:id/session/stop'")
  assert.ok(ini >= 0)
  const rota = src.slice(ini, src.indexOf("app.get('/users/:id/diagnostico/envios'"))
  assert.match(rota, /requireAdmin\(req, reply, 'tech:write'\)/)
  assert.match(rota, /validateStopReason\(req\.body\)/)
  assert.match(rota, /stopSessionOnPurpose\(/)
  assert.match(rota, /writeAdminAuditLog\(req, \{[\s\S]*admin\.session\.stop/)
  assert.doesNotMatch(rota, /waSession\.updateMany/, 'a marca vive só em stopSession.js')
  const script = read('scripts/parar-sessao.mjs')
  assert.match(script, /stopSessionOnPurpose/)
  assert.doesNotMatch(script, /waSession\.updateMany/)
})

test('rota de diagnóstico: leitura, auditada, só banco/Redis (nada de bot.log)', () => {
  const src = read('src/api/routes/admin.js')
  const ini = src.indexOf("app.get('/users/:id/diagnostico/envios'")
  assert.ok(ini >= 0)
  const rota = src.slice(ini, ini + 4500)
  assert.match(rota, /requireAdmin\(req, reply, 'support:read'\)/)
  assert.match(rota, /diagnoseEnvios\(/)
  assert.match(rota, /writeAdminAuditLog/)
  assert.doesNotMatch(rota, /bot\.log|readFileSync/)
})

test('reconectar aceita motivo opcional e o grava no evento e na auditoria', () => {
  const src = read('src/api/routes/admin.js')
  const rota = src.slice(src.indexOf("app.post('/online/:userId/reconnect'"), src.indexOf("app.post('/users/:id/session/stop'"))
  assert.match(rota, /req\.body\?\.reason/)
  assert.match(rota, /metadata: \{[^}]*reason: motivoReconexao/)
  assert.match(rota, /after: \{[^}]*reason: motivoReconexao/)
})

test('o script diag-envios-vazios importa o módulo (regras não duplicadas)', () => {
  const script = read('scripts/diag-envios-vazios.mjs')
  assert.match(script, /diagnostics\/envios\.js/)
  assert.doesNotMatch(script, /nenhum destino ligado/)
})

test('ficha: Parar e Reconectar com confirm + motivo; diagnóstico; eventos com motivo', () => {
  const page = read('dashboard/app/admin/clientes/[id]/page.js')
  for (const fn of ['async function parar(id)', 'async function reconnect(id)']) {
    const ini = page.indexOf(fn)
    assert.ok(ini >= 0, fn)
    const corpo = page.slice(ini, ini + 1400)
    assert.match(corpo, /if \(!window\.confirm\(/)
    assert.match(corpo, /window\.prompt\(/)
    assert.ok(corpo.indexOf('window.confirm(') < corpo.indexOf('window.prompt('), 'confirma antes de pedir o motivo')
  }
  assert.match(page, /api\.adminSessionStop\(/)
  assert.match(page, /api\.adminDiagnosticoEnvios\(/)
  assert.match(page, /Parar robô/)
  assert.match(page, /event\.metadata\?\.reason/)
  assert.equal(page.split('>Por que caiu</h3>').length - 1, 1, 'não duplicar o bloco "Por que caiu"')
  const api = read('dashboard/lib/api.js')
  assert.match(api, /session\/stop/)
  assert.match(api, /diagnostico\/envios/)
})
