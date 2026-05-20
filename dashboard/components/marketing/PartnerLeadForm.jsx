'use client'

import { useMemo, useState } from 'react'
import { trackEvent } from '@/lib/analytics'

function sanitize(value = '', max = 80) {
  return String(value || '').trim().slice(0, max)
}

export function PartnerLeadForm() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    partnerType: 'admin_curador',
    channel: 'whatsapp',
    audienceBand: '1k_10k',
    objective: 'piloto_7_dias',
    consent: false,
  })

  const registerHref = useMemo(() => {
    const params = new URLSearchParams({
      mode: 'register',
      source: 'partner_landing',
      utm_source: 'parcerias',
      utm_medium: 'co-marketing',
      utm_campaign: 'partner-program-2026q2',
      utm_content: `${form.partnerType}-${form.channel}-${form.objective}`,
    })
    return `/login?${params.toString()}`
  }, [form])

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!form.consent) {
      setError('Confirme o consentimento para avançar.')
      trackEvent('partner_form_validation_blocked', {
        origin: 'parcerias_page',
        reason: 'missing_consent',
      })
      return
    }

    const payload = {
      event: 'partner_form_submit',
      metadata: {
        page_path: '/parcerias',
        partner_type: sanitize(form.partnerType),
        channel: sanitize(form.channel),
        audience_band: sanitize(form.audienceBand),
        objective: sanitize(form.objective),
        consent: true,
      },
    }

    trackEvent('partner_form_submit', payload.metadata)

    try {
      await fetch('/api/public/v1/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      })
    } catch {
      // best effort
    }

    setSubmitted(true)
    window.location.href = registerHref
  }

  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm" aria-label="Formulário de parceria">
      <h2 className="text-2xl font-black tracking-tight text-gray-950">Quero ser parceiro(a)</h2>
      <p className="mt-2 text-sm leading-6 text-gray-700">Preencha o perfil da parceria para iniciar o fluxo com rastreio e consentimento.</p>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
        <label className="grid gap-1 text-sm font-semibold text-gray-800">
          Tipo de parceiro
          <select value={form.partnerType} onChange={(e) => update('partnerType', e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2">
            <option value="admin_curador">Admin/curador de ofertas</option>
            <option value="creator_comunidade">Creator/comunidade</option>
            <option value="plataforma_adjacente">Plataforma adjacente</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm font-semibold text-gray-800">
          Canal principal
          <select value={form.channel} onChange={(e) => update('channel', e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2">
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
            <option value="instagram">Instagram</option>
            <option value="multicanal">Multicanal</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm font-semibold text-gray-800">
          Tamanho estimado da audiência
          <select value={form.audienceBand} onChange={(e) => update('audienceBand', e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2">
            <option value="lt_1k">Até 1 mil</option>
            <option value="1k_10k">1 mil a 10 mil</option>
            <option value="10k_50k">10 mil a 50 mil</option>
            <option value="gt_50k">Mais de 50 mil</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm font-semibold text-gray-800">
          Objetivo da parceria
          <select value={form.objective} onChange={(e) => update('objective', e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2">
            <option value="piloto_7_dias">Piloto guiado de 7 dias</option>
            <option value="webinar_conjunto">Webinar conjunto</option>
            <option value="checklist_bundle">Checklist + bundle</option>
          </select>
        </label>

        <label className="flex items-start gap-2 text-xs leading-5 text-gray-700">
          <input type="checkbox" checked={form.consent} onChange={(e) => update('consent', e.target.checked)} className="mt-0.5" />
          <span>Autorizo o tratamento dos dados deste formulário para contato sobre a parceria e concordo com compartilhamento entre as partes envolvidas na campanha, conforme consentimento explícito.</span>
        </label>

        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        {submitted && <p className="text-sm font-semibold text-emerald-700">Redirecionando para continuar seu cadastro...</p>}

        <button
          type="submit"
          data-seo-cta="partner-form-submit"
          data-cta-position="mid"
          data-cta-stage="partnership"
          data-cta-destination="login-register"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700"
        >
          Continuar com parceria
        </button>
      </form>
    </section>
  )
}
