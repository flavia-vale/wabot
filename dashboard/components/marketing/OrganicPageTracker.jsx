'use client'

import { useEffect } from 'react'
import { TRACKING_EVENTS, trackEvent } from '@/lib/analytics'

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

    function handleClick(event) {
      const target = event.target?.closest?.('[data-seo-cta]')
      if (!target) return

      trackEvent(TRACKING_EVENTS.ORGANIC_CTA_CLICK, {
        ...seoContext,
        cta: String(target.getAttribute('data-seo-cta') ?? '').slice(0, 80),
        href: String(target.getAttribute('href') ?? '').slice(0, 120),
      })
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [route])

  return null
}
