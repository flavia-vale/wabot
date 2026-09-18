'use client'

import { useEffect } from 'react'
import { TRACKING_EVENTS, trackEvent } from '@/lib/analytics'
import { captureFirstTouchLandingPage } from '@/lib/marketing-attribution'
import { classifyReferrer, shouldTrackReferral } from '@/lib/ai-referral'

// Registro de "de onde a pessoa veio" para as páginas públicas que NÃO usam o
// OrganicPageTracker: /alternativas/* (ComparisonPageTracker), os posts do blog
// (ArticleShell) e páginas institucionais.
//
// RCA 2026-09-18: só 15 templates emitiam `referral_visit` e gravavam o cookie
// de primeira página (first-touch). As comparações carregam 47% das impressões
// do site e os 19 posts são a linha que mais converte em pagante — e nenhuma
// dessas páginas media chegada por IA nem gravava a landing page do cadastro.
// O "35-43% dos cadastros vêm do ChatGPT" estava subcontado exatamente onde a
// estratégia de IA aposta.
//
// Mesma regra do OrganicPageTracker (não regredir): só dispara para quem veio
// de FORA (IA, busca, social) e guarda apenas o HOST do referenciador, nunca a
// URL completa — URL de buscador carrega o termo pesquisado, que é dado da
// pessoa.
export function trackPublicReferral(context = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  captureFirstTouchLandingPage(`${window.location.pathname}${window.location.search}`)
  const referral = classifyReferrer(document.referrer, window.location.hostname)
  if (!shouldTrackReferral(referral)) return null
  const payload = {
    path: String(window.location.pathname ?? '').slice(0, 120),
    template: String(context.template ?? '').slice(0, 64),
    slug: String(context.slug ?? '').slice(0, 96),
    referrer_kind: referral.kind,
    referrer_source: referral.source,
    referrer_host: referral.host.slice(0, 96),
  }
  trackEvent(TRACKING_EVENTS.REFERRAL_VISIT, payload)
  return payload
}

export function PublicReferralTracker({ template = '', slug = '' }) {
  useEffect(() => {
    trackPublicReferral({ template, slug })
  }, [template, slug])

  return null
}
