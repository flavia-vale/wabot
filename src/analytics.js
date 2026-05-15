import { randomUUID } from 'crypto'
import db from './db.js'

export const ANALYTICS_EVENTS = new Set([
  'signup_created',
  'login_completed',
  'whatsapp_connected',
  'credential_saved',
  'monitor_group_created',
  'post_group_created',
  'checkout_started',
  'payment_pending',
  'payment_approved',
  'payment_failed',
  'first_send_success',
  'send_error',
  'organic_page_view',
  'organic_cta_click',
  'lead_magnet_started',
  'lead_magnet_submitted',
  'signup_started_from_seo',
])

const SENSITIVE_KEY_PATTERN = /(token|secret|password|cookie|credential|csrf|ssid|key|message|text|url|phone|email)/i

export function analyticsEnabled() {
  return process.env.ANALYTICS_ENABLED !== 'false'
}

export function sanitizeAnalyticsMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => value !== undefined && value !== null && !SENSITIVE_KEY_PATTERN.test(key))
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 80) : value])
  )
}

export async function trackAnalyticsEvent({ userId = null, event, metadata = {} }) {
  if (!analyticsEnabled() || !ANALYTICS_EVENTS.has(event)) return { skipped: true }

  const safeMetadata = JSON.stringify(sanitizeAnalyticsMetadata(metadata))
  await db.$executeRaw`
    INSERT INTO AnalyticsEvent (id, userId, event, metadata, createdAt)
    VALUES (${randomUUID()}, ${userId}, ${event}, ${safeMetadata}, ${new Date()})
  `
  return { ok: true }
}

export function trackAnalyticsEventSafe(payload) {
  trackAnalyticsEvent(payload).catch((err) => {
    console.error('Analytics event error:', err.message)
  })
}
