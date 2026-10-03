import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { OPS_RETENTION_EVENTS } from '../src/observability/operationalSignals.js'
import { purgeOldOpsEvents } from '../src/observability/opsEventRetention.js'

test('lista de retenção é explícita, só ops_* e exclui negócio/marcadores', () => {
  assert.ok(OPS_RETENTION_EVENTS.length > 20)
  for (const e of OPS_RETENTION_EVENTS) assert.match(e, /^ops_/)
  for (const e of ['credential_expiry_alert_sent', 'session_telemetry', 'signup_created', 'whatsapp_connected', 'checkout_started',
    'ops_self_activation_nudge_sent', 'ops_self_welcome_message_sent', 'ops_self_first_offer_message_sent', 'ops_self_trial_decision_sent',
    'ops_unsupported_store_daily', 'ops_billing_config_problem', 'ops_wa_phone_reuse_detected']) {
    assert.ok(!OPS_RETENTION_EVENTS.includes(e), e)
  }
  for (const e of ['ops_mirror_fallback_all_destinations', 'ops_store_photo_over_origin', 'ops_wa_reception_blind']) assert.ok(OPS_RETENTION_EVENTS.includes(e), e)
})

function fakeDb(total) {
  let left = total
  const calls = { find: [], del: 0 }
  return {
    calls,
    analyticsEvent: {
      findMany: async (args) => { calls.find.push(args); return Array.from({ length: Math.min(left, args.take) }, (_, i) => ({ id: String(i) })) },
      deleteMany: async ({ where }) => { left -= where.id.in.length; calls.del += 1; return { count: where.id.in.length } },
    },
  }
}

test('apaga em lotes com cutoff e lista explícita; para quando acaba', async () => {
  const db = fakeDb(12000)
  const now = Date.UTC(2026, 9, 3)
  const r = await purgeOldOpsEvents({ db, now, pauseMs: 0 })
  assert.equal(r.deleted, 12000)
  assert.equal(r.batches, 3)
  assert.equal(r.capped, false)
  const w = db.calls.find[0].where
  assert.deepEqual(w.event.in, OPS_RETENTION_EVENTS)
  assert.equal(w.createdAt.lt.getTime(), now - 90 * 86400000)
})

test('teto de lotes por passada e retenção desligada', async () => {
  const db = fakeDb(100000)
  const r = await purgeOldOpsEvents({ db, maxBatches: 2, batchSize: 5000, pauseMs: 0 })
  assert.deepEqual([r.deleted, r.batches, r.capped], [10000, 2, true])
  const off = await purgeOldOpsEvents({ db, retentionDays: 0 })
  assert.equal(off.deleted, 0)
})

test('server.js liga OPS_EVENT_RETENTION_DAYS (default 90) no sweep diário', () => {
  const src = readFileSync(new URL('../src/api/server.js', import.meta.url), 'utf8')
  assert.match(src, /OPS_EVENT_RETENTION_DAYS/)
  assert.match(src, /purgeOldOpsEvents\(/)
})
