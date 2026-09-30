import test from 'node:test'
import assert from 'node:assert/strict'
import { tickOfferAutomations, describeAutomationResult } from '../src/offerAutomation/cron.js'

// RCA 2026-09-30: o cron descartava o retorno de runAutomation. Uma automação
// que rodava no horário e caía em `all_offers_filtered` não deixava rastro
// nenhum — "a automação não executa" sem nenhuma linha para investigar.

test('describeAutomationResult resume cada tipo de retorno em uma palavra', () => {
  assert.equal(describeAutomationResult({ skipped: 'all_offers_filtered' }), 'pulou=all_offers_filtered')
  assert.equal(describeAutomationResult({ error: 'shopee_api_error: 10020' }), 'erro=shopee_api_error: 10020')
  assert.equal(describeAutomationResult({ sent: 2 }), 'enviou=2')
  assert.equal(describeAutomationResult({ sent: 0, failed: 1 }), 'enviou=0 falhou=1')
  assert.equal(describeAutomationResult(undefined), 'sem_retorno')
})

test('cron escreve uma linha por execução direct com o motivo devolvido', async () => {
  const userId = `u-log-${Math.random().toString(16).slice(2)}`
  const linhas = []
  const originalLog = console.log
  console.log = (...args) => { linhas.push(args.join(' ')) }
  try {
    await tickOfferAutomations({
      db: {
        offerAutomation: {
          findMany: async () => [{ id: 'auto-1', userId, enabled: true, intervalMinutes: 30, lastSentAt: null, keyword: 'air fryer', page: 3, publicationMode: 'direct', instagramDestinations: [] }],
        },
      },
      env: {},
      listRunningBotsFn: async () => [userId],
      getPlanAccessFn: async () => ({ entitlements: { canUseOfferAutomations: true } }),
      runAutomationFn: async () => ({ skipped: 'all_offers_filtered' }),
    })
  } finally {
    console.log = originalLog
  }
  const linha = linhas.find((l) => l.includes('[offer-cron] automation auto-1'))
  assert.ok(linha, 'esperava linha de resultado no log')
  assert.match(linha, /keyword="air fryer"/)
  assert.match(linha, /page=3/)
  assert.match(linha, /pulou=all_offers_filtered/)
})
