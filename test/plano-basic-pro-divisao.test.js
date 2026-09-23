// Divisão Basic/PRO (2026-09-23). O que o Basic deixou de ter: marca d'água,
// botão "Ver canal", variação do texto e painel de vendas da Shopee. O Trial
// ativo herda tudo do PRO; premium também.
import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { getPlanEntitlements, buildFeatureGateError, FEATURE_CODES } from '../src/billing/plans.js'
import { destinationImageModeWithoutWatermark } from '../src/core/imageModePolicy.js'
import { configRoutes } from '../src/api/routes/config.js'

const umDia = () => new Date(Date.now() + 86_400_000)
const NOVOS = ['canUseWatermark', 'canUseChannelButton', 'canUseCopyVariation', 'canUseShopeeSales']

test('os quatro recursos novos são do PRO: Basic não, PRO/premium/trial ativo sim', () => {
  for (const key of NOVOS) {
    assert.equal(getPlanEntitlements({ plan: 'basic', accessExpiresAt: umDia() })[key], false, `basic ${key}`)
    assert.equal(getPlanEntitlements({ plan: 'pro' })[key], true, `pro ${key}`)
    assert.equal(getPlanEntitlements({ plan: 'premium' })[key], true, `premium ${key}`)
    assert.equal(getPlanEntitlements({ plan: 'trial', accessExpiresAt: umDia() })[key], true, `trial ${key}`)
    assert.equal(getPlanEntitlements({ plan: 'trial', accessExpiresAt: new Date(Date.now() - 1000) })[key], false, `trial vencido ${key}`)
  }
})

test('mensagem de trava em linguagem leiga, com código FEATURE_REQUIRES_PRO', () => {
  for (const feature of [FEATURE_CODES.WATERMARK, FEATURE_CODES.CHANNEL_BUTTON, FEATURE_CODES.COPY_VARIATION, FEATURE_CODES.SHOPEE_SALES]) {
    const err = buildFeatureGateError(feature)
    assert.equal(err.code, 'FEATURE_REQUIRES_PRO')
    assert.equal(err.feature, feature)
    assert.doesNotMatch(err.error, /watermark|channel_button|copy_variation|imageMode/i)
  }
})

test('sem marca: card com marca vira card, foto com marca vira foto (decisão da dona do produto)', () => {
  assert.equal(destinationImageModeWithoutWatermark('preview_watermark'), 'preview')
  assert.equal(destinationImageModeWithoutWatermark('original_watermark'), 'original')
  assert.equal(destinationImageModeWithoutWatermark('preview'), 'preview')
  assert.equal(destinationImageModeWithoutWatermark('original'), 'original')
  assert.equal(destinationImageModeWithoutWatermark(null), 'original')
})

function configApp(plan) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  const saved = []
  const db = {
    botConfig: {
      findUnique: async () => null,
      upsert: async (args) => { saved.push(args); return { ...args.create } },
    },
    user: { findUnique: async () => plan },
  }
  app.register(configRoutes, { prefix: '/api/config', db })
  return { app, saved }
}

test('Basic não liga a variação do texto; desligar segue liberado', async () => {
  const { app, saved } = configApp({ plan: 'basic', accessExpiresAt: umDia() })
  const liga = await app.inject({ method: 'PUT', url: '/api/config', payload: { copyVariationEnabled: true } })
  assert.equal(liga.statusCode, 403)
  assert.equal(liga.json().feature, 'copy_variation')
  assert.equal(saved.length, 0)
  const desliga = await app.inject({ method: 'PUT', url: '/api/config', payload: { copyVariationEnabled: false } })
  assert.notEqual(desliga.statusCode, 403)
  await app.close()
})

test('PRO liga a variação do texto', async () => {
  const { app } = configApp({ plan: 'pro' })
  const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { copyVariationEnabled: true } })
  assert.notEqual(res.statusCode, 403)
  await app.close()
})

test('planBasicDowngrade: só mexe em quem não tem o PRO, e só no que o Basic perdeu', async () => {
  const { planBasicDowngrade } = await import('../src/billing/basicDowngrade.js')
  const groups = [
    { id: 'a', role: 'post', imageMode: 'preview_watermark', channelButtonJid: 'x@newsletter' },
    { id: 'b', role: 'post', imageMode: 'original_watermark' },
    { id: 'c', role: 'post', imageMode: 'preview' },
    { id: 'm', role: 'monitor', imageMode: 'original_watermark' },
  ]
  const basic = planBasicDowngrade({ planSubject: { plan: 'basic', accessExpiresAt: umDia() }, groups, botConfig: { copyVariationEnabled: true } })
  assert.deepEqual(basic.groupChanges.map(c => [c.id, c.data]), [
    ['a', { imageMode: 'preview', channelButtonJid: null, channelButtonName: null }],
    ['b', { imageMode: 'original' }],
  ])
  assert.deepEqual(basic.configChange, { copyVariationEnabled: false })
  const pro = planBasicDowngrade({ planSubject: { plan: 'pro' }, groups, botConfig: { copyVariationEnabled: true } })
  assert.deepEqual(pro, { groupChanges: [], configChange: null })
})

test('o script importa a regra em vez de reescrevê-la, e é read-only por padrão', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../scripts/basic-sem-recursos-pro.mjs', import.meta.url), 'utf8')
  assert.match(src, /from '\.\.\/src\/billing\/basicDowngrade\.js'/)
  assert.match(src, /const aplicar = process\.argv\.includes\('--aplicar'\)/)
  assert.doesNotMatch(src, /\.catch\(\(\) => \[\]\)/)
})
