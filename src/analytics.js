import { randomUUID } from 'crypto'
import db from './db.js'
import { writeAnalyticsEvent } from './events/store.js'

export const PUBLIC_ANALYTICS_EVENTS = new Set([
  'conversion_prompt_viewed',
  'conversion_prompt_dismissed',
  'conversion_prompt_cta_clicked',
  'lead_magnet_viewed',
  'lead_magnet_form_focused',
  'lead_magnet_submitted',
  'lead_magnet_pdf_clicked',
  'lead_magnet_online_clicked',
  'comparison_page_view',
  'comparison_scroll_50',
  'comparison_cta_click',
  'partner_form_submit',
  'partner_form_validation_blocked',
])

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
  'comparison_page_view',
  'comparison_scroll_50',
  'comparison_cta_click',
  'partner_form_submit',
  'partner_form_validation_blocked',
  'public_analytics_accepted',
  'public_analytics_invalid_event',
  'public_analytics_blocked_429',
  'cs_risk_detected',
  'cs_contact_attempted',
  'cs_contact_connected',
  'cs_offer_shown',
  'cs_offer_accepted',
  'cs_retained_7d',
  'cs_retained_30d',
  'login_failed',
  'login_blocked',
  // Sinais operacionais (auditoria/WABOT-010): gatilhos de escala observáveis.
  'ops_sqlite_busy',
  'ops_dedup_fail_open',
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
  await writeAnalyticsEvent({
    id: randomUUID(),
    userId,
    event,
    metadata: safeMetadata,
    createdAt: new Date(),
  }, { db })
  return { ok: true }
}

export function trackAnalyticsEventSafe(payload) {
  trackAnalyticsEvent(payload).catch((err) => {
    console.error('Analytics event error:', err.message)
  })
}
