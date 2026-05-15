'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { shouldSuppressConversionPrompt, trackEvent, TRACKING_EVENTS } from '@/lib/analytics'
import { buildRegisterHref } from '@/lib/marketing-attribution'

const PROMPT_ID = 'site_checklist_slidein'
const PROMPT_VARIANT = 'p1_default'
const SESSION_KEY = 'wb_conversion_prompt_seen_session'
const DISMISS_KEY = `wb_conversion_prompt_dismissed_${PROMPT_ID}`
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000
const TIME_TRIGGER_MS = 45 * 1000
const SCROLL_TRIGGER_RATIO = 0.5

function promptsEnabled() {
  return String(process.env.NEXT_PUBLIC_CONVERSION_PROMPTS_ENABLED ?? 'false').toLowerCase() === 'true'
}

function canShowAfterDismiss(now = Date.now()) {
  try {
    const dismissedAt = Number(window.localStorage?.getItem(DISMISS_KEY) || 0)
    return !dismissedAt || now - dismissedAt > DISMISS_COOLDOWN_MS
  } catch {
    return true
  }
}

function markDismissed() {
  try { window.localStorage?.setItem(DISMISS_KEY, String(Date.now())) } catch {}
}

function canShowInSession() {
  try { return window.sessionStorage?.getItem(SESSION_KEY) !== '1' } catch { return true }
}

function markShownInSession() {
  try { window.sessionStorage?.setItem(SESSION_KEY, '1') } catch {}
}

export function ConversionPrompt() {
  const pathname = usePathname() || ''
  const [visible, setVisible] = useState(false)
  const [trigger, setTrigger] = useState('')

  const trackingParams = useMemo(() => ({
    prompt_id: PROMPT_ID,
    variant: PROMPT_VARIANT,
    page_path: pathname,
    placement: 'bottom-slide-in',
    trigger,
  }), [pathname, trigger])

  const href = useMemo(() => buildRegisterHref({
    source: 'conversion_prompt',
    campaign: 'p1-conversion-prompts',
    content: PROMPT_ID,
    conversionPromptId: PROMPT_ID,
    conversionPromptVariant: PROMPT_VARIANT,
  }), [])

  useEffect(() => {
    if (!promptsEnabled() || shouldSuppressConversionPrompt(pathname) || !canShowAfterDismiss() || !canShowInSession()) return undefined

    let active = true
    const show = (nextTrigger) => {
      if (!active || visible || !canShowInSession()) return
      markShownInSession()
      setTrigger(nextTrigger)
      setVisible(true)
    }

    const timer = window.setTimeout(() => show('time_45s'), TIME_TRIGGER_MS)
    const onScroll = () => {
      const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      const ratio = Math.min(window.scrollY / scrollable, 1)
      if (ratio >= SCROLL_TRIGGER_RATIO) show('scroll_50')
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => {
      active = false
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [pathname, visible])

  useEffect(() => {
    if (!visible) return
    trackEvent(TRACKING_EVENTS.CONVERSION_PROMPT_VIEWED, trackingParams)
  }, [trackingParams, visible])

  if (!visible) return null

  function dismiss() {
    markDismissed()
    setVisible(false)
    trackEvent(TRACKING_EVENTS.CONVERSION_PROMPT_DISMISSED, trackingParams)
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-3xl border border-emerald-200 bg-white p-5 text-gray-900 shadow-2xl shadow-emerald-950/20 md:bottom-6 md:right-6 md:left-auto md:mx-0"
      aria-labelledby="conversion-prompt-title"
      aria-describedby="conversion-prompt-desc"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Checklist gratuito</p>
          <h2 id="conversion-prompt-title" className="mt-1 text-xl font-black tracking-tight text-gray-950">Padronize a operação antes de automatizar</h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-10 min-w-10 rounded-full border border-gray-200 text-lg font-black text-gray-500 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Fechar prompt de checklist"
        >
          ×
        </button>
      </div>
      <p id="conversion-prompt-desc" className="mt-3 text-sm leading-6 text-gray-700">
        Receba um roteiro de 1 página para revisar copy, links, horários, grupos e métricas antes de ligar uma automação.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={href}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          onClick={() => trackEvent(TRACKING_EVENTS.CONVERSION_PROMPT_CTA_CLICKED, trackingParams)}
        >
          Receber checklist
        </Link>
        <button type="button" onClick={dismiss} className="rounded-xl px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">
          Continuar lendo
        </button>
      </div>
    </aside>
  )
}
