import test from 'node:test'
import assert from 'node:assert/strict'
import { tickOfferAutomations } from '../src/offerAutomation/cron.js'

function database(automation) {
  return {
    offerAutomation: { findMany: async () => [automation] },
    offerAutomationReviewItem: { updateMany: async () => ({ count: 0 }), deleteMany: async () => ({ count: 0 }) },
  }
}

test('cron mantém modo direct no dispatcher legado com feature desligada', async () => {
  let direct = 0
  await tickOfferAutomations({ db: database({ id: 'a', userId: 'u', enabled: true, publicationMode: 'direct', intervalMinutes: 15, lastSentAt: null, instagramDestinations: [] }), env: {}, listRunningBotsFn: async () => ['u'], getPlanAccessFn: async () => ({ entitlements: { canUseOfferAutomations: true } }), runAutomationFn: async () => { direct++ } })
  assert.equal(direct, 1)
})

test('cron nunca converte review em direct quando flags estão desligadas', async () => {
  let direct = 0
  await tickOfferAutomations({ db: database({ id: 'a', userId: 'u', enabled: true, publicationMode: 'review', intervalMinutes: 15, lastSentAt: null, instagramDestinations: [] }), env: {}, listRunningBotsFn: async () => ['u'], getPlanAccessFn: async () => ({ entitlements: { canUseOfferAutomations: true } }), runAutomationFn: async () => { direct++ } })
  assert.equal(direct, 0)
})

test('review descobre sem entregar quando só a primeira flag está ligada', async () => {
  let discovered = 0; let delivered = 0
  await tickOfferAutomations({ db: database({ id: 'a', userId: 'u', enabled: true, publicationMode: 'review', intervalMinutes: 15, lastSentAt: null, lastDiscoveryAt: null, instagramDestinations: [] }), env: { OFFER_AUTOMATION_REVIEW_ENABLED: 'true' }, listRunningBotsFn: async () => [], getPlanAccessFn: async () => ({ entitlements: { canUseOfferAutomations: true, canUseInstagramStories: false } }), discoverReviewItemsFn: async () => { discovered++ }, deliverApprovedReviewItemsFn: async () => { delivered++ } })
  assert.equal(discovered, 1)
  assert.equal(delivered, 0)
})
