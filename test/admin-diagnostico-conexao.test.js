import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { diagnoseConexao, CONEXAO_ELOS } from '../src/domain/admin/diagnostics/conexao.js'

// G4 da auditoria: "por que não conecta" no painel (ficha > aba Robô).

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const NOW = 1_800_000_000_000
const base = () => ({ nowMs: NOW, user: { status: 'active', accessExpiresAt: new Date(NOW + 86_400_000) } })
const passos = (...ev) => ev.map((event, i) => ({ event, at: new Date(NOW - (ev.length - i) * 1000) }))

test('cadeia na ordem e conectada saudável sem problemas', () => {
  const r = diagnoseConexao({ ...base(), session: { status: 'connected', lifecycle: 'ready', lastHeartbeatAt: new Date(NOW - 10_000) }, credencial: { existe: true, backupPareamento: false } })
  assert.deepEqual(r.elos.map(e => e.id), CONEXAO_ELOS)
  assert.equal(r.veredito.ok, true)
  assert.equal(r.problemas.length, 0)
})

test('cenário 1: nunca conectou', () => {
  const r = diagnoseConexao({ ...base(), credencial: { existe: false, backupPareamento: false } })
  assert.equal(r.veredito.eloId, 'tela')
  assert.match(r.veredito.frase, /nunca conectou/)
  assert.ok(r.veredito.acao)
})

test('cenário 2: QR apareceu e venceu sem leitura', () => {
  const r = diagnoseConexao({
    ...base(),
    session: { status: 'disconnected', lifecycle: 'connecting' },
    tela: passos('connect_click', 'service_start_ok', 'qr_requested', 'qr_rendered', 'qr_timeout_25s'),
  })
  assert.equal(r.veredito.eloId, 'tela')
  assert.match(r.veredito.frase, /QR apareceu.*venceu/)
  // se leu o QR depois, não acusa a tela
  const leu = diagnoseConexao({ ...base(), session: { status: 'disconnected', lifecycle: 'connecting' }, tela: passos('qr_rendered', 'qr_timeout_25s', 'qr_rendered', 'qr_scanned') })
  assert.equal(leu.elos.find(e => e.id === 'tela').ok, true)
})

test('cenário 3: sem vaga no servidor aparece antes da tela e manda abrir vaga', () => {
  const r = diagnoseConexao({
    ...base(),
    session: { status: 'disconnected', lifecycle: 'disconnected' },
    tela: passos('connect_click'),
    vagas: { recusasDela: 3, recusasServidor: 9, limite: '80' },
  })
  assert.equal(r.veredito.eloId, 'vaga')
  assert.match(r.veredito.frase, /3 vez\(es\).*não havia vaga/)
  assert.match(r.veredito.acao, /Abrir vaga/)
  assert.equal(r.resumo.recusasDeVagaServidor, 9)
})

test('cenário 4: 405 (versão recusada, geral ou isolada) e 408 (tempo esgotado)', () => {
  const s405 = { status: 'disconnected', lifecycle: 'reconnecting', lastDisconnectCode: '405' }
  const geral = diagnoseConexao({ ...base(), session: s405, versaoRecusadaServidor: 40 })
  assert.equal(geral.veredito.eloId, 'whatsapp')
  assert.match(geral.veredito.frase, /várias contas ao mesmo tempo/)
  assert.match(geral.veredito.acao, /Não pedir para ela parear/)
  const isolada = diagnoseConexao({ ...base(), session: s405, versaoRecusadaServidor: 0 })
  assert.doesNotMatch(isolada.veredito.frase, /várias contas/)
  const t408 = diagnoseConexao({ ...base(), session: { status: 'disconnected', lifecycle: 'reconnecting', lastDisconnectCode: '408' } })
  assert.match(t408.veredito.frase, /demorou demais/)
  // jargão técnico nunca na tela
  for (const r of [geral, isolada, t408]) assert.doesNotMatch(r.problemas.join(' '), /socket|handshake|pairing/i)
})

test('conta vencida vem primeiro; pareamento interrompido aparece na credencial', () => {
  const vencida = diagnoseConexao({ ...base(), user: { status: 'active', accessExpiresAt: new Date(NOW - 1) }, session: { status: 'disconnected', lastDisconnectCode: '405' } })
  assert.equal(vencida.veredito.eloId, 'conta')
  const cred = diagnoseConexao({ ...base(), session: { status: 'connected', lifecycle: 'ready', lastHeartbeatAt: new Date(NOW) }, credencial: { existe: true, backupPareamento: true } })
  assert.equal(cred.veredito.eloId, 'credencial')
})

test('rota: leitura, support:read, auditada, só banco (nada de bot.log)', () => {
  const src = read('src/api/routes/admin.js')
  const ini = src.indexOf("app.get('/users/:id/diagnostico/conexao'")
  assert.ok(ini >= 0)
  const rota = src.slice(ini, ini + 4500)
  assert.match(rota, /requireAdmin\(req, reply, 'support:read'\)/)
  assert.match(rota, /diagnoseConexao\(/)
  assert.match(rota, /writeAdminAuditLog/)
  assert.doesNotMatch(rota, /bot\.log|readFileSync/)
})

test('script importa o módulo (regras não duplicadas) e a ficha mostra o bloco', () => {
  const script = read('scripts/diag-nao-conecta.mjs')
  assert.match(script, /diagnostics\/conexao\.js/)
  assert.match(script, /diagnoseConexao\(/)
  const page = read('dashboard/app/admin/clientes/[id]/page.js')
  assert.match(page, /api\.adminDiagnosticoConexao\(/)
  assert.match(page, /Por que não conecta\?/)
  assert.match(page, /Por que não envia\?/)
  assert.match(read('dashboard/lib/api.js'), /diagnostico\/conexao/)
})
