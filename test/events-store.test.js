import test from 'node:test'
import assert from 'node:assert/strict'
import { writeAnalyticsEvent, writeAffiliateClick, writeFollowLog, writeWebhookEvent } from '../src/events/store.js'

function mkDb() {
  const calls = { analyticsEvent: 0, affiliateClick: 0, followLog: 0, webhookEvent: 0 }
  const db = {
    analyticsEvent: { create: async () => { calls.analyticsEvent++ } },
    affiliateClick: { create: async () => { calls.affiliateClick++ } },
    followLog: { create: async () => { calls.followLog++ } },
    webhookEvent: { create: async () => { calls.webhookEvent++ } },
  }
  return { db, calls }
}

test('event store writes OLTP in default mode', async () => {
  delete globalThis.__WABOT_EVENTS_DB__
  delete process.env.EVENT_STORE_MODE
  const { db, calls } = mkDb()
  await writeAnalyticsEvent({ event: 'x' }, { db })
  await writeAffiliateClick({ linkId: 'l' }, { db })
  await writeFollowLog({ userId: 'u' }, { db })
  await writeWebhookEvent({ provider: 'p' }, { db })
  assert.deepEqual(calls, { analyticsEvent: 1, affiliateClick: 1, followLog: 1, webhookEvent: 1 })
})

test('event store dual mode also attempts events DB', async () => {
  process.env.EVENT_STORE_MODE = 'dual'
  const { db, calls } = mkDb()
  const mirror = mkDb()
  globalThis.__WABOT_EVENTS_DB__ = mirror.db
  await writeAnalyticsEvent({ event: 'x' }, { db })
  assert.equal(calls.analyticsEvent, 1)
  assert.equal(mirror.calls.analyticsEvent, 1)
})
