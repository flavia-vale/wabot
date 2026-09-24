import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { listProFeaturesInUse, buildProFeaturesNotice, PRO_FEATURES } from '../src/domain/payments/proFeaturesInUse.js'
import { buildEntitledGroupConfig } from '../src/billing/groupEntitlements.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

// RCA 2026-09-23 (tecnicotelecom10@gmail.com): pagou o Basic depois do teste
// grátis e o canal-destino parou de receber em silêncio. O grupo ao lado
// seguia normal — "paguei e o robô parou".

test('reproduz o defeito: no Basic o canal some da config do robô, no teste grátis não', () => {
  const groups = [
    { id: 'm1', role: 'monitor', kind: 'group', waJid: '1@g.us', targetsMode: 'all' },
    { id: 'p1', role: 'post', kind: 'group', waJid: '2@g.us' },
    { id: 'p2', role: 'post', kind: 'channel', waJid: '3@newsletter' },
  ]
  const futuro = new Date(Date.now() + 86_400_000)
  const trial = buildEntitledGroupConfig({ groups, planSubject: { plan: 'trial', accessExpiresAt: futuro } })
  const basic = buildEntitledGroupConfig({ groups, planSubject: { plan: 'basic', accessExpiresAt: futuro } })
  assert.deepEqual(trial.groups.post, ['2@g.us', '3@newsletter'])
  assert.deepEqual(basic.groups.post, ['2@g.us'])
  assert.equal(basic.blockedChannelCount, 1)
})

test('lista só o que a conta usa, em linguagem leiga e com plural certo', () => {
  assert.deepEqual(listProFeaturesInUse({}), [])
  const um = listProFeaturesInUse({ channelCount: 1 })
  assert.equal(um[0].feature, PRO_FEATURES.CHANNELS)
  assert.equal(um[0].label, '1 canal do WhatsApp')
  const varios = listProFeaturesInUse({ channelCount: 2, activeAutomationCount: 3, activeQueueCount: 1 })
  assert.deepEqual(varios.map(i => i.label), ['2 canais do WhatsApp', '3 ofertas automáticas', '1 fila de ofertas'])
})

test('contagem inválida vira zero (sem dado não se afirma que ela usa)', () => {
  assert.deepEqual(listProFeaturesInUse({ channelCount: null, activeAutomationCount: 'x', activeQueueCount: -2 }), [])
})

test('sem recurso do Pro em uso, nenhum aviso em plano nenhum', () => {
  for (const plan of ['trial', 'basic', 'pro']) {
    assert.equal(buildProFeaturesNotice({ plan, accessActive: true, items: [] }), null)
  }
})

test('no Basic com canal configurado: aviso de que PAROU, com o que faz voltar', () => {
  const n = buildProFeaturesNotice({ plan: 'basic', accessActive: true, items: listProFeaturesInUse({ channelCount: 1 }) })
  assert.equal(n.kind, 'stopped')
  assert.match(n.body, /1 canal do WhatsApp/)
  assert.match(n.body, /grupos continuam/)
  assert.match(n.action, /Pro/)
})

test('Basic vencido não ganha este aviso (quem fala ali é o banner de plano vencido)', () => {
  assert.equal(buildProFeaturesNotice({ plan: 'basic', accessActive: false, items: listProFeaturesInUse({ channelCount: 1 }) }), null)
})

test('no teste grátis: aviso ANTES de escolher, para o card do Basic', () => {
  const n = buildProFeaturesNotice({ plan: 'trial', accessActive: true, items: listProFeaturesInUse({ channelCount: 1, activeQueueCount: 2 }) })
  assert.equal(n.kind, 'before_choosing')
  assert.match(n.body, /1 canal do WhatsApp e 2 filas de ofertas/)
  assert.match(n.action, /Pro/)
})

test('linguagem leiga: nada de jargão interno no texto', () => {
  const textos = [
    buildProFeaturesNotice({ plan: 'basic', accessActive: true, items: listProFeaturesInUse({ channelCount: 1, activeAutomationCount: 1, activeQueueCount: 1 }) }),
    buildProFeaturesNotice({ plan: 'trial', accessActive: true, items: listProFeaturesInUse({ channelCount: 1 }) }),
  ].flatMap(n => [n.title, n.body, n.action]).join(' ')
  assert.doesNotMatch(textos, /entitlement|newsletter|feature|\bconfig\b|downgrade|\bgate\b|trial/i)
})

test('a API devolve o aviso no resumo do plano, sem derrubar a tela em falha', () => {
  const src = read('src/api/routes/payments.js')
  assert.match(src, /buildProFeaturesNotice\(/)
  assert.match(src, /proFeaturesNotice,/)
  assert.match(src, /pro_features_notice_failed/)
})

test('a tela de planos mostra o aviso no card do Basic e o de "parou" antes dos planos', () => {
  const src = read('dashboard/app/painel/plano/page.js')
  assert.match(src, /plan\.id === 'basic' && overview\?\.proFeaturesNotice\?\.kind === 'before_choosing'/)
  assert.match(src, /overview\?\.proFeaturesNotice\?\.kind === 'stopped'/)
})

test('o painel inteiro avisa quando o canal está parado pelo plano (sem chamada nova)', () => {
  const src = read('dashboard/app/painel/PainelShell.js')
  assert.match(src, /<ProFeaturesStoppedBanner notice=\{proFeaturesNotice\} \/>/)
  assert.match(src, /group\?\.kind === 'channel'/)
})
