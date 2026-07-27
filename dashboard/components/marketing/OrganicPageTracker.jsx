'use client'

import { useEffect } from 'react'
import { TRACKING_EVENTS, trackEvent } from '@/lib/analytics'
import { captureFirstTouchLandingPage } from '@/lib/marketing-attribution'

function sanitizeSeoRoute(route = {}) {
  return {
    slug: String(route.slug ?? '').slice(0, 96),
    path: String(route.path ?? '').slice(0, 120),
    cluster: String(route.cluster ?? '').slice(0, 64),
    intent: String(route.intent ?? '').slice(0, 96),
    template: String(route.template ?? '').slice(0, 64),
    variant: String(route.variant ?? '').slice(0, 64),
  }
}

export function OrganicPageTracker({ route }) {
  useEffect(() => {
    const seoContext = sanitizeSeoRoute(route)
    trackEvent(TRACKING_EVENTS.ORGANIC_PAGE_VIEW, seoContext)
    captureFirstTouchLandingPage(`${window.location.pathname}${window.location.search}`)

    function handleClick(event) {
      const target = event.target?.closest?.('[data-seo-cta]')
      if (!target) return

      const href = String(target.getAttribute('href') ?? '').slice(0, 240)
      const utmContent = (() => {
        try {
          const parsed = new URL(href, window.location.origin)
          return String(parsed.searchParams.get('utm_content') ?? '').slice(0, 96)
        } catch {
          return ''
        }
      })()

      trackEvent(TRACKING_EVENTS.ORGANIC_CTA_CLICK, {
        ...seoContext,
        cta: String(target.getAttribute('data-seo-cta') ?? '').slice(0, 80),
        cta_position: String(target.getAttribute('data-cta-position') ?? '').slice(0, 64),
        cta_stage: String(target.getAttribute('data-cta-stage') ?? '').slice(0, 64),
        cta_destination: String(target.getAttribute('data-cta-destination') ?? '').slice(0, 64),
        utm_content: utmContent,
        href,
      })
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [route])

  return null
}
