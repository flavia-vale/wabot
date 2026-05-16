import test from 'node:test'
import assert from 'node:assert/strict'
import { PUBLIC_ANALYTICS_EVENTS, sanitizeAnalyticsMetadata } from '../src/analytics.js'
import { clearPublicAnalyticsAttempts, consumePublicAnalyticsAttempt, normalizePublicAnalyticsMetadata } from '../src/api/routes/public.js'

test('public analytics events are whitelisted for prompt and lead magnet tracking', () => {
  assert.equal(PUBLIC_ANALYTICS_EVENTS.has('conversion_prompt_viewed'), true)
  assert.equal(PUBLIC_ANALYTICS_EVENTS.has('lead_magnet_submitted'), true)
  assert.equal(PUBLIC_ANALYTICS_EVENTS.has('auth_submit_attempt'), false)
})

test('public analytics metadata strips sensitive fields and normalizes page path', () => {
  const metadata = normalizePublicAnalyticsMetadata({
    prompt_id: 'site_checklist_slidein',
    pathname: '/blog/conferir-converter-link-afiliado-whatsapp',
    email: 'pessoa@example.com',
    token: 'secret',
    finalUrl: 'https://example.com/private',
  })

  assert.deepEqual(metadata, {
    prompt_id: 'site_checklist_slidein',
    pathname: '/blog/conferir-converter-link-afiliado-whatsapp',
    page_path: '/blog/conferir-converter-link-afiliado-whatsapp',
  })
})

test('public analytics rate limit blocks noisy clients', () => {
  clearPublicAnalyticsAttempts()
  const now = Date.now()
  let attempt = null
  for (let i = 0; i < 60; i += 1) {
    attempt = consumePublicAnalyticsAttempt({ ip: '203.0.113.10', now })
    assert.equal(attempt.blocked, false)
  }
  const blocked = consumePublicAnalyticsAttempt({ ip: '203.0.113.10', now })
  assert.equal(blocked.blocked, true)
  clearPublicAnalyticsAttempts()
})

test('analytics sanitizer keeps attribution fields used by signup and prompts', () => {
  assert.deepEqual(
    sanitizeAnalyticsMetadata({
      source: 'conversion_prompt',
      utm_campaign: 'p1-conversion-prompts',
      conversion_prompt_id: 'site_checklist_slidein',
      conversion_prompt_variant: 'p1_default',
      password: 'secret',
    }),
    {
      source: 'conversion_prompt',
      utm_campaign: 'p1-conversion-prompts',
      conversion_prompt_id: 'site_checklist_slidein',
      conversion_prompt_variant: 'p1_default',
    }
  )
})
