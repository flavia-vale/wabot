'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { trackEvent, TRACKING_EVENTS } from '@/lib/analytics'
import { sanitizeAttributionValue } from '@/lib/marketing-attribution'

const OFFER_ID = 'checklist-operacao-whatsapp'
const UTM_CAMPAIGN = 'dia4_conteudo_dor_cluster1'

export function LeadMagnetCard({ origin = 'conteudo_dor_cluster1', compact = false }) {
  const safeOrigin = sanitizeAttributionValue(origin) || 'conteudo_dor_cluster1'
  const [trackedFocus, setTrackedFocus] = useState(false)

  const trackingParams = useMemo(() => ({
    origin: safeOrigin,
    offer_id: OFFER_ID,
    utm_source: 'lead_magnet',
    utm_medium: 'organic',
    utm_campaign: UTM_CAMPAIGN,
    utm_content: safeOrigin,
  }), [safeOrigin])

  function trackLeadMagnetFocus() {
    if (trackedFocus) return
    setTrackedFocus(true)
    trackEvent(TRACKING_EVENTS.LEAD_MAGNET_FORM_FOCUSED, trackingParams)
  }

  function trackLeadMagnetSubmit() {
    trackEvent(TRACKING_EVENTS.LEAD_MAGNET_SUBMITTED, trackingParams)
  }

  useEffect(() => {
    trackEvent(TRACKING_EVENTS.LEAD_MAGNET_VIEWED, trackingParams)
  }, [trackingParams])

  return (
    <aside className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Isca digital</p>
      <h2 className={`${compact ? 'mt-2 text-2xl' : 'mt-3 text-3xl'} font-black tracking-tight text-gray-950`}>
        Checklist de operação para divulgar ofertas no WhatsApp
      </h2>
      <p className="mt-3 text-sm leading-6 text-gray-700">
        Baixe o roteiro de 1 página para padronizar copy, links, horários, grupos de destino e métricas antes de ligar uma automação.
      </p>
      <form
        action="/login"
        method="get"
        className="mt-5 grid gap-3"
        data-crm-stage="Lead"
        data-crm-source={safeOrigin}
        onFocus={trackLeadMagnetFocus}
        onSubmit={trackLeadMagnetSubmit}
      >
        <input type="hidden" name="mode" value="register" />
        <input type="hidden" name="source" value={safeOrigin} />
        <input type="hidden" name="utm_source" value="lead_magnet" />
        <input type="hidden" name="utm_medium" value="organic" />
        <input type="hidden" name="utm_campaign" value={UTM_CAMPAIGN} />
        <input type="hidden" name="utm_content" value={safeOrigin} />
        <input type="hidden" name="conversion_prompt_id" value={OFFER_ID} />
        <label className="text-sm font-bold text-gray-800" htmlFor={`lead-email-${safeOrigin}`}>E-mail para receber o checklist</label>
        <input
          id={`lead-email-${safeOrigin}`}
          name="email"
          type="email"
          required
          placeholder="voce@empresa.com"
          className="min-h-12 rounded-xl border border-emerald-200 bg-white px-4 text-gray-900 outline-none ring-emerald-300 focus:ring-2"
        />
        <label className="text-sm font-bold text-gray-800" htmlFor={`lead-segment-${safeOrigin}`}>Perfil da operação</label>
        <select
          id={`lead-segment-${safeOrigin}`}
          name="segmento"
          defaultValue=""
          className="min-h-12 rounded-xl border border-emerald-200 bg-white px-4 text-gray-900 outline-none ring-emerald-300 focus:ring-2"
        >
          <option value="" disabled>Selecione uma opção</option>
          <option value="admin-grupos-ofertas">Admin de grupos de ofertas</option>
          <option value="afiliado-infoprodutor">Afiliado/infoprodutor</option>
          <option value="ecommerce-local">E-commerce local</option>
          <option value="agencia-growth">Agência de performance/growth</option>
        </select>
        <button className="min-h-12 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700" type="submit">
          Receber checklist e entrar na lista VIP
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-emerald-800">
        <Link
          href="/materiais/checklist-operacao-whatsapp"
          className="underline underline-offset-4"
          onClick={() => trackEvent(TRACKING_EVENTS.LEAD_MAGNET_ONLINE_CLICKED, trackingParams)}
        >
          Ver checklist online
        </Link>
        <a
          href="/materiais/checklist-operacao-whatsapp.pdf"
          className="underline underline-offset-4"
          onClick={() => trackEvent(TRACKING_EVENTS.LEAD_MAGNET_PDF_CLICKED, trackingParams)}
        >
          Baixar PDF
        </a>
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-500">
        Mapeamento CRM: Lead → MQL quando o perfil de operação é preenchido; Trial quando o cadastro é concluído.
      </p>
    </aside>
  )
}
