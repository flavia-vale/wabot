'use client'

import { useEffect } from 'react'
import { api } from '@/lib/api'

function getOrCreateAffiliateVisitorId() {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem('aff_visitor_id')
    if (existing) return existing
    const generated = (window.crypto?.randomUUID?.() || `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`).slice(0, 120)
    window.localStorage.setItem('aff_visitor_id', generated)
    return generated
  } catch {
    return `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`.slice(0, 120)
  }
}

function persistAffiliateCookies({ code, visitorId, hours = 24 }) {
  const expires = new Date(Date.now() + hours * 3600 * 1000).toUTCString()
  document.cookie = `aff_code=${encodeURIComponent(code)}; expires=${expires}; path=/; SameSite=Lax`
  document.cookie = `aff_visitor_id=${encodeURIComponent(visitorId)}; expires=${expires}; path=/; SameSite=Lax`
}

export function AffiliateLandingTracker({ affiliateCode = '', source = 'affiliate_landing' }) {
  useEffect(() => {
    if (!affiliateCode) return
    const visitorId = getOrCreateAffiliateVisitorId()
    const landingPage = `${window.location.pathname}${window.location.search}`.slice(0, 500)
    const persistCode = (hours = 24) => persistAffiliateCookies({ code: affiliateCode, visitorId, hours })

    api.affiliateConfig()
      .then(cfg => persistCode(cfg?.attributionWindowDays ? cfg.attributionWindowDays * 24 : (cfg?.cookieDurationHours ?? 24)))
      .catch(() => persistCode(24))

    api.affiliateTrack({
      affiliateCode,
      visitorId,
      source,
      medium: 'landing',
      campaign: 'affiliate_landing',
      landingPage,
    }).catch(() => {})
  }, [affiliateCode, source])

  return null
}
