'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { DEFAULT_RISK_INPUTS, RISK_INPUT_LIMITS, calculateWhatsAppRisk } from '@/lib/free-tools/risk-calculator'
import { TRACKING_EVENTS, trackEvent } from '@/lib/analytics'

const numericFields = [
  { key: 'channels', label: 'Canais do WhatsApp', suffix: 'canais' },
  { key: 'groups', label: 'Grupos usados na operação', suffix: 'grupos' },
  { key: 'offersPerDay', label: 'Ofertas por dia', suffix: 'ofertas/dia' },
  { key: 'identicalMessageRate', label: '% de mensagens idênticas', suffix: '%' },
  { key: 'minimumIntervalMinutes', label: 'Intervalo mínimo entre posts', suffix: 'min' },
]

const selectFields = [
  {
    key: 'usesDedicatedChip',
    label: 'Usa chip dedicado?',
    options: [
      ['yes', 'Sim, separado da vida pessoal'],
      ['no', 'Não ou ainda misturado'],
    ],
  },
  {
    key: 'monitorsClicks',
    label: 'Monitora sinais de entrega/cliques?',
    options: [
      ['yes', 'Sim, por canal/destino'],
      ['partial', 'Parcialmente'],
      ['no', 'Não monitoro'],
    ],
  },
  {
    key: 'hasRecoveryPlan',
    label: 'Tem plano de recuperação?',
    options: [
      ['yes', 'Sim, documentado'],
      ['partial', 'Parcial'],
      ['no', 'Não tenho'],
    ],
  },
]

const toneClasses = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  amber: 'border-amber-200 bg-amber-50 text-amber-950',
  orange: 'border-orange-200 bg-orange-50 text-orange-950',
  red: 'border-red-200 bg-red-50 text-red-950',
}

function buildSignupHref(result) {
  const params = new URLSearchParams({
    mode: 'register',
    source: 'calculadora_risco_whatsapp',
    utm_source: 'ferramentas',
    utm_medium: 'organic',
    utm_campaign: 'canais-preservacao',
    utm_content: `calculadora_risco_${result.band.id}`,
    risk_score_band: result.band.id,
  })
  return `/login?${params.toString()}`
}

export function WhatsAppRiskCalculator() {
  const [inputs, setInputs] = useState(DEFAULT_RISK_INPUTS)
  const result = useMemo(() => calculateWhatsAppRisk(inputs), [inputs])
  const signupHref = useMemo(() => buildSignupHref(result), [result])
  const resultClass = toneClasses[result.band.tone] ?? toneClasses.emerald

  function updateField(key, value) {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  function resetDefaults() {
    setInputs(DEFAULT_RISK_INPUTS)
  }

  function trackToolCta(cta) {
    trackEvent(TRACKING_EVENTS.DIAGNOSTIC_CTA_CLICKED, {
      origin: 'calculadora_risco_whatsapp',
      diagnostic_id: 'calculadora_risco_whatsapp',
      score: result.score,
      score_band: result.band.id,
      cta,
    })
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]" aria-labelledby="calculadora-risco-title">
      <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Calculadora gratuita</p>
            <h2 id="calculadora-risco-title" className="mt-2 text-2xl font-black tracking-tight text-gray-950">Preencha sua operação atual</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">Use números aproximados. A calculadora não acessa WhatsApp, grupos, canais, QR Code ou links de afiliado.</p>
          </div>
          <button type="button" onClick={resetDefaults} className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50">
            Restaurar exemplo
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {numericFields.map((field) => {
            const limits = RISK_INPUT_LIMITS[field.key]
            return (
              <label key={field.key} className="block rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <span className="text-sm font-bold text-gray-800">{field.label}</span>
                <span className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-emerald-500">
                  <input
                    type="number"
                    min={limits.min}
                    max={limits.max}
                    step="1"
                    value={inputs[field.key]}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    className="w-full border-0 bg-transparent text-lg font-black text-gray-950 outline-none"
                    aria-describedby={`${field.key}-risk-hint`}
                  />
                  <span id={`${field.key}-risk-hint`} className="shrink-0 text-xs font-bold uppercase tracking-wide text-gray-400">{field.suffix}</span>
                </span>
              </label>
            )
          })}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {selectFields.map((field) => (
            <label key={field.key} className="block rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <span className="text-sm font-bold text-gray-800">{field.label}</span>
              <select
                value={inputs[field.key]}
                onChange={(event) => updateField(field.key, event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none ring-emerald-300 focus:ring-2"
              >
                {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-emerald-950 p-5 text-white">
          <p className="text-sm font-bold text-emerald-100">Como calculamos</p>
          <p className="mt-2 text-sm leading-7 text-emerald-50">Somamos fatores de exposição operacional: volume, intervalo, repetição de mensagens, chip dedicado, monitoramento e recuperação. Não é promessa contra banimento; é um mapa de pontos frágeis para reduzir risco.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className={`rounded-[2rem] border p-5 shadow-sm md:p-7 ${resultClass}`}>
          <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">Resultado estimado</p>
          <div className="mt-3 flex items-end gap-2">
            <strong className="text-5xl font-black tracking-tight">{result.score}</strong>
            <span className="pb-2 text-sm font-bold opacity-80">/ 100 pontos</span>
          </div>
          <h3 className="mt-3 text-2xl font-black tracking-tight">{result.band.label}</h3>
          <p className="mt-3 text-sm leading-7">{result.band.summary}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Destinos</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-gray-950">{result.destinations}</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">Canais + grupos informados.</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Posts/dia</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-gray-950">{result.dailyPosts.toLocaleString('pt-BR')}</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">Ofertas × destinos.</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-7">
          <h3 className="text-xl font-black tracking-tight text-gray-950">O que ajustar primeiro</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
            {result.recommendations.map((item) => (
              <li key={item} className="flex gap-3"><span aria-hidden="true" className="text-emerald-600">•</span><span>{item}</span></li>
            ))}
          </ul>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/materiais/checklist-antiban-whatsapp"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700"
              data-seo-cta="risk_calculator_checklist"
              data-cta-position="result_primary"
              data-cta-stage="lead_magnet"
              data-cta-destination="checklist"
              onClick={() => trackToolCta('open_preservation_checklist')}
            >
              Ver checklist de preservação
            </Link>
            <Link
              href={signupHref}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-emerald-200 bg-white px-5 text-sm font-black text-emerald-800 hover:bg-emerald-50"
              data-seo-cta="risk_calculator_signup"
              data-cta-position="result_secondary"
              data-cta-stage="conversion"
              data-cta-destination="signup"
              onClick={() => trackToolCta('signup_from_risk_calculator')}
            >
              Levar resultado para cadastro
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
