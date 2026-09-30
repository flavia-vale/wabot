// RCA 2026-09-30: oferta reenviada depois do reinício do robô saía sem foto
// porque a busca de foto recebia o rótulo "shopee+shopee" como nome de loja.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { primaryPlatformFromLog } from '../src/core/primaryPlatformFromLog.js'
import { createAwinStoreMatcher } from '../src/integrations/awin/storeMatcher.js'

test('rótulo com várias lojas vira a loja do link principal', () => {
  assert.equal(primaryPlatformFromLog({ platform: 'shopee+shopee', originalUrl: 'https://s.shopee.com.br/40gv8e6s3T' }), 'shopee')
  assert.equal(primaryPlatformFromLog({ platform: 'shopee+amazon', originalUrl: 'https://www.amazon.com.br/dp/B09VQ39F41' }), 'amazon')
})

test('link que o detector não enxerga: vale a primeira loja do rótulo', () => {
  assert.equal(primaryPlatformFromLog({ platform: 'awin+shopee', originalUrl: 'https://tidd.ly/x' }), 'awin')
  assert.equal(primaryPlatformFromLog({ platform: 'nolink', originalUrl: '' }), null)
  assert.equal(primaryPlatformFromLog({}), null)
})

test('com as lojas Awin da cliente, página da loja Awin vira "awin"', () => {
  const awin = createAwinStoreMatcher([{ accountId: 'a', publisherId: '1', advertiserId: 17729, name: 'Kabum', domains: ['kabum.com.br'] }])
  assert.equal(primaryPlatformFromLog({ platform: 'shopee+awin', originalUrl: 'https://www.kabum.com.br/produto/1' }, { awin }), 'awin')
})

test('reenvio pós-reinício não passa mais o rótulo cru para a foto', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /const primary = \{ platform: row\.platform/)
  // Com a Rakuten (2026-10-01) as opções levam as duas redes.
  assert.match(src, /platform: primaryPlatformFromLog\(row, \{ \.\.\.awinOfferOptions\(cfg\.credentials\?\.awin\), \.\.\.rakutenOfferOptions\(cfg\.credentials\?\.rakuten\) \}\)/)
})
