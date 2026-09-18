'use client'

import { useEffect, useRef } from 'react'
import { TRACKING_EVENTS, trackEvent } from '@/lib/analytics'
import { trackPublicReferral } from './PublicReferralTracker'

export function ComparisonPageTracker({ slug = '', format = '' }) {
  const didTrackScroll50 = useRef(false)

  useEffect(() => {
    const context = {
      page_slug: String(slug).slice(0, 120),
      page_format: String(format || 'comparison').slice(0, 32),
    }

    trackEvent(TRACKING_EVENTS.COMPARISON_PAGE_VIEW, context)
    // Chegada por IA/busca + first-touch (RCA 2026-09-18: as comparações
    // carregam 47% das impressões e não mediam origem nenhuma).
    trackPublicReferral({ template: 'comparison', slug })

    function onScroll() {
      if (didTrackScroll50.current) return
      const doc = document.documentElement
      const maxScrollable = doc.scrollHeight - window.innerHeight
      if (maxScrollable <= 0) return
      const progress = (window.scrollY / maxScrollable) * 100
      if (progress >= 50) {
        didTrackScroll50.current = true
        trackEvent(TRACKING_EVENTS.COMPARISON_SCROLL_50, context)
      }
    }

    function onClick(event) {
      const target = event.target?.closest?.('[data-comparison-cta]')
      if (!target) return
      trackEvent(TRACKING_EVENTS.COMPARISON_CTA_CLICK, {
        ...context,
        cta: String(target.getAttribute('data-comparison-cta') ?? '').slice(0, 80),
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('click', onClick)
    }
  }, [slug, format])

  return null
}
