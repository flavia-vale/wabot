// Guardas da rodada "quem resolve a desconexão" (RCA 2026-08-26).
// A medição de produção mostrou 13 robôs no ar para 67 sessões caídas: ninguém
// estava tentando reconectar ninguém, e o admin não tinha como saber disso.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const adminRoute = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
const sessionRoute = readFileSync(new URL('../src/api/routes/session.js', import.meta.url), 'utf8')
const dispatcher = readFileSync(new URL('../src/email/dispatcher.js', import.meta.url), 'utf8')
const policy = readFileSync(new URL('../src/emailTriggers/lifecyclePolicy.js', import.meta.url), 'utf8')
const onlinePage = readFileSync(new URL('../dashboard/app/admin/online/page.js', import.meta.url), 'utf8')
const adminPage = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')

test('a rota classifica quem resolve cada desconexão', () => {
  assert.match(adminRoute, /resolveSessionOwner\(\{/)
  assert.match(adminRoute, /sessionOwner: ownership\.owner/)
  assert.match(adminRoute, /canAdminRetry: ownership\.canAdminRetry/)
})

test('os cenários de frota contam paradas e quem precisa de QR', () => {
  assert.match(adminRoute, /paradasSemNinguem: paradas\.size/)
  assert.match(adminRoute, /precisamDeQr: precisamDaCliente\.size/)
})

test('o botão de reconectar recusa o caso em que não resolveria', () => {
  assert.match(adminRoute, /if \(!ownership\.canAdminRetry\) \{/)
  assert.match(adminRoute, /Reconectar daqui não resolve este caso/)
})

// Se o clique do admin contasse como ação da cliente, o card que mede a
// promessa do produto ("Cliente teve que agir") viraria mentira.
test('o clique do admin NÃO é gravado como ação da cliente', () => {
  const trecho = adminRoute.slice(adminRoute.indexOf("app.post('/online/:userId/reconnect'"), adminRoute.indexOf("app.get('/online/:userId'"))
  assert.match(trecho, /type: 'admin_reconnect_requested'/)
  assert.doesNotMatch(trecho, /manual_reconnect_requested/)
})

test('a ação é auditada e exige permissão de escrita', () => {
  const trecho = adminRoute.slice(adminRoute.indexOf("app.post('/online/:userId/reconnect'"), adminRoute.indexOf("app.get('/online/:userId'"))
  assert.match(trecho, /requireAdmin\(req, reply, 'tech:write'\)/)
  assert.match(trecho, /action: 'admin\.online\.reconnect'/)
  assert.match(trecho, /user\.status !== 'active'/)
})

test('desligar pelo painel grava o estado na sessão, não só no evento', () => {
  assert.match(sessionRoute, /data: \{ status: 'disconnected', lifecycle: 'stopped_by_user' \}/)
  assert.match(sessionRoute, /lifecycle: 'stopped_by_user', phone: null/)
})

test('descarte de e-mail automático passa a deixar rastro', () => {
  const trecho = dispatcher.slice(dispatcher.indexOf('const markSkipped'), dispatcher.indexOf('if (!templateExists(slug))'))
  assert.match(trecho, /status: 'skipped'/)
  assert.match(trecho, /db\.emailSendLog\.create/, 'sem isto o descarte automático era invisível')
})

test('a trava de conta parada não cala o aviso de WhatsApp caído', () => {
  assert.match(dispatcher, /IDLE_GATE_EXEMPT_SLUGS = new Set\(\['whatsapp_desconectado'\]\)/)
  assert.match(dispatcher, /!IDLE_GATE_EXEMPT_SLUGS\.has\(slug\)/)
})

test('mas o aviso tem teto: conta parada há meses não é perseguida', () => {
  assert.match(policy, /WHATSAPP_DESCONECTADO_MAX_HORAS/)
  assert.match(policy, /horasDesconectado <= WHATSAPP_DESCONECTADO_MAX_HORAS/)
})

test('a tela mostra quem resolve e oferece o clique só onde ajuda', () => {
  assert.match(onlinePage, /OWNER_META/)
  assert.match(onlinePage, /user\.canAdminRetry && \(/)
  assert.match(onlinePage, /Tentar reconectar/)
})

test('os cards novos estão na primeira tela do admin', () => {
  assert.match(adminPage, /Paradas sem ninguém tentando/)
  assert.match(adminPage, /Precisam de QR novo/)
  assert.match(adminPage, /openScenario\('parado'\)/)
})

// Causa raiz das "paradas" (RCA 2026-08-26): acesso vencido faz o próprio
// worker gravar `disconnected` e sair. Reconectar ali repete o ciclo.
test('o botão recusa conta com acesso vencido', () => {
  const trecho = adminRoute.slice(adminRoute.indexOf("app.post('/online/:userId/reconnect'"), adminRoute.indexOf("app.get('/online/:userId'"))
  assert.match(trecho, /user\.accessExpiresAt && new Date\(user\.accessExpiresAt\) <= new Date\(\)/)
  assert.match(trecho, /é caso de renovação, não de reconexão/)
})

test('acesso vencido tem contador e cenário próprios, separados de "parada"', () => {
  assert.match(adminRoute, /acessoVencido: acessoVencido\.size/)
  assert.match(adminRoute, /vencido: acessoVencido/)
  assert.match(adminPage, /Acesso vencido/)
})

test('a classificação recebe a data de acesso nas duas visões', () => {
  assert.match(adminRoute, /accessExpiresAt: user\.accessExpiresAt \?\? null/)
  assert.match(adminRoute, /accessExpiresAt: session\.user\?\.accessExpiresAt \?\? null/)
})
