import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ALERT_EVENT, ALERT_VALID_MS, CREDENTIAL_STATUS, lastAlertsByUser, resolveCredentialStatus,
  buildCredentialStatuses, hasBadCredential, latestBadSinceMs,
} from '../src/domain/admin/credentialStatus.js'
import { buildInbox, GRAVIDADE, descreverMotivo, LIMIAR_AGORA } from '../src/domain/admin/inboxPriority.js'
import { PAYING_STATUS } from '../src/domain/admin/payingStatus.js'
import { probeCredentialReadOnly } from '../src/credentialExpiry/sweep.js'
import { FILTROS_MOTIVO } from '../dashboard/lib/admin/inboxFiltros.js'
import { encryptCredential } from '../src/credentialCrypto.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const NOW = new Date('2026-10-03T12:00:00Z')
const dias = (n) => new Date(NOW.getTime() - n * 86_400_000)
const ev = (userId, platform, createdAt) => ({ userId, event: ALERT_EVENT, metadata: JSON.stringify({ platform }), createdAt })

test('lastAlertsByUser: pega o aviso mais recente por (cliente, loja) e ignora lixo', () => {
  const m = lastAlertsByUser([
    ev('u1', 'amazon', dias(5)), ev('u1', 'amazon', dias(2)), ev('u1', 'shopee', dias(1)),
    { userId: 'u2', event: ALERT_EVENT, metadata: '{quebrado', createdAt: dias(1) },
    { userId: null, event: ALERT_EVENT, metadata: '{"platform":"amazon"}', createdAt: dias(1) },
    { userId: 'u3', event: 'outro_evento', metadata: '{"platform":"amazon"}', createdAt: dias(1) },
  ])
  assert.equal(m.get('u1').get('amazon'), dias(2).getTime())
  assert.equal(m.get('u1').get('shopee'), dias(1).getTime())
  assert.equal(m.has('u2'), false)
  assert.equal(m.has('u3'), false)
})

test('status: ML/Amazon = vencida, Shopee = recusada, sem aviso ou aviso velho = sem medição (nunca "ok")', () => {
  assert.equal(resolveCredentialStatus({ platform: 'mercadolivre', lastAlertAt: dias(3), now: NOW }).status, CREDENTIAL_STATUS.EXPIRED)
  assert.equal(resolveCredentialStatus({ platform: 'amazon', lastAlertAt: dias(3), now: NOW }).status, CREDENTIAL_STATUS.EXPIRED)
  const shopee = resolveCredentialStatus({ platform: 'shopee', lastAlertAt: dias(3), now: NOW })
  assert.equal(shopee.status, CREDENTIAL_STATUS.REFUSED)
  assert.equal(shopee.sinceMs, 3 * 86_400_000)
  assert.equal(resolveCredentialStatus({ platform: 'shopee', now: NOW }).status, CREDENTIAL_STATUS.UNMEASURED)
  const velho = new Date(NOW.getTime() - ALERT_VALID_MS - 1000)
  assert.equal(resolveCredentialStatus({ platform: 'shopee', lastAlertAt: velho, now: NOW }).status, CREDENTIAL_STATUS.UNMEASURED)
})

test('status: sondagem ao vivo vence o aviso; indeterminado (alive null) não vira vencida', () => {
  const base = { platform: 'amazon', lastAlertAt: dias(2), now: NOW }
  assert.equal(resolveCredentialStatus({ ...base, probe: { alive: true } }).status, CREDENTIAL_STATUS.OK)
  assert.equal(resolveCredentialStatus({ ...base, probe: { alive: false } }).status, CREDENTIAL_STATUS.EXPIRED)
  assert.equal(resolveCredentialStatus({ platform: 'amazon', now: NOW, probe: { alive: null } }).status, CREDENTIAL_STATUS.UNMEASURED)
})

test('buildCredentialStatuses lista só lojas cadastradas com sondagem ativa', () => {
  const alerts = new Map([['shopee', dias(1).getTime()]])
  const r = buildCredentialStatuses({ alerts, configured: ['shopee', 'amazon', 'magalu'], now: NOW })
  assert.deepEqual(r.map(x => x.platform), ['amazon', 'shopee'])
  assert.equal(hasBadCredential(r), true)
  assert.equal(latestBadSinceMs(r), 86_400_000)
  assert.equal(hasBadCredential(buildCredentialStatuses({ now: NOW })), false)
})

test('GRAVIDADE TRAVA DE PROPÓSITO: "chave-de-loja" precisa ter gravidade e texto na caixa Hoje', () => {
  assert.ok(GRAVIDADE['chave-de-loja'] > 0, 'motivo novo sem gravidade some da caixa em silêncio')
  assert.equal(GRAVIDADE['chave-de-loja'], 2.5)
  const d = descreverMotivo('chave-de-loja')
  assert.match(d.titulo, /Chave de loja/)
  assert.ok(d.porque && d.acao)
  assert.ok(FILTROS_MOTIVO.some(f => f.motivos.includes('chave-de-loja')), 'sem chip de filtro na tela Hoje')
})

test('caixa Hoje: pagante com chave ruim entra em "Agora"; peso e gravidade valem', () => {
  const r = buildInbox({ now: NOW, clientes: [
    { id: 'a', email: 'a@x', payingStatus: PAYING_STATUS.PAYING, chaveDeLoja: true, detalheMs: 86_400_000 },
    { id: 'b', email: 'b@x', payingStatus: PAYING_STATUS.NEVER, chaveDeLoja: true },
    { id: 'c', email: 'c@x', payingStatus: PAYING_STATUS.PAYING, chaveDeLoja: false },
  ] })
  assert.deepEqual(r.agora.map(l => l.userId), ['a'])
  assert.equal(r.agora[0].motivo, 'chave-de-loja')
  assert.equal(r.agora[0].prioridade, 7.5)
  assert.ok(r.agora[0].prioridade >= LIMIAR_AGORA)
  assert.deepEqual(r.semana.map(l => l.userId), ['b'])
  assert.equal(r.total, 2)
})

test('caixa Hoje: uma linha por cliente; robô caído e cobrança recusada vencem a chave, vence chave sobre segmento mais leve', () => {
  const um = (c) => buildInbox({ now: NOW, clientes: [{ id: 'a', email: 'a@x', payingStatus: PAYING_STATUS.PAYING, chaveDeLoja: true, ...c }] })
  assert.equal(um({ operacional: 'robo-caido-agora' }).agora[0].motivo, 'robo-caido-agora')
  assert.equal(um({ segmento: 'cobranca-recusada' }).agora[0].motivo, 'cobranca-recusada')
  assert.equal(um({ segmento: 'sem-envio-ate-7d' }).agora[0].motivo, 'chave-de-loja')
  assert.equal(um({ segmento: 'sem-loja' }).agora[0].motivo, 'chave-de-loja')
  assert.equal(um({ segmento: 'robo-caido' }).agora[0].motivo, 'robo-caido')
})

test('probeCredentialReadOnly: só leitura — descarta credentialPatch, falha vira alive null', async () => {
  const cred = { data: encryptCredential(JSON.stringify({ tag: 'x' })) }
  let visto = null
  const checkers = {
    amazon: async (data) => { visto = data; return { configured: true, alive: false, reason: 'expired', credentialPatch: { cookie: 'novo' } } },
    shopee: async () => { throw new Error('rede fora') },
    mercadolivre: async () => ({ configured: true, alive: 'talvez', reason: 'busy' }),
  }
  const am = await probeCredentialReadOnly({ platform: 'amazon', cred, checkers })
  assert.deepEqual(am, { configured: true, alive: false, reason: 'expired', rotated: true })
  assert.equal(visto.tag, 'x')
  assert.equal('credentialPatch' in am, false)
  const sh = await probeCredentialReadOnly({ platform: 'shopee', cred, checkers, logger: null })
  assert.equal(sh.alive, null)
  assert.equal(sh.reason, 'check_failed')
  assert.equal((await probeCredentialReadOnly({ platform: 'mercadolivre', cred, checkers })).alive, null)
  assert.equal((await probeCredentialReadOnly({ platform: 'amazon', cred: null, checkers })).reason, 'not_configured')
  assert.equal((await probeCredentialReadOnly({ platform: 'magalu', cred, checkers })).reason, 'unsupported_platform')
})

test('estrutura: sweep.js não mudou a sondagem de produção; rota é billing:read, auditada e sem escrita de credencial', () => {
  const sweep = read('src/credentialExpiry/sweep.js')
  assert.match(sweep, /async function probePlatform\(/)
  const trecho = sweep.slice(sweep.indexOf('export async function probeCredentialReadOnly'))
  assert.doesNotMatch(trecho, /\.update\(|\.create\(|setCachedProbe/)

  const admin = read('src/api/routes/admin.js')
  const ini = admin.indexOf("app.post('/customers/:id/credenciais/:platform/testar'")
  assert.ok(ini >= 0)
  const corpo = admin.slice(ini, admin.indexOf('\n  })\n', ini))
  assert.match(corpo, /requireAdmin\(req, reply, 'billing:read'\)/)
  assert.match(corpo, /action: 'admin\.credentials\.probe'/)
  assert.doesNotMatch(corpo, /credential\.(update|upsert|create|delete)|analyticsEvent\.create|sendMail/)

  const inbox = admin.slice(admin.indexOf("app.get('/inbox'"), admin.indexOf("app.get('/funnel'"))
  assert.match(inbox, /lastAlertsByUser/)
  assert.match(inbox, /chaveDeLoja/)
})

test('ficha: seção "Chaves das lojas" com Testar chave e confirmação antes de sondar', () => {
  const page = read('dashboard/app/admin/clientes/[id]/page.js')
  assert.match(page, /Chaves das lojas/)
  assert.match(page, /Testar chave/)
  assert.match(page, /window\.confirm\([^)]*Testar a chave/)
  assert.match(page, /chavesLojas=\{history\.chavesLojas\}/)
  assert.match(read('dashboard/lib/api.js'), /adminTestarChaveLoja/)
})
