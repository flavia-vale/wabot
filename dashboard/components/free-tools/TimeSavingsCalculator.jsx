'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  DEFAULT_INPUTS,
  INPUT_LIMITS,
  calculateWhatsAppGroupTimeSavings,
  formatCurrency,
  formatHours,
} from '@/lib/free-tools/time-calculator'
import { ToolLeadCapture } from '@/components/free-tools/ToolLeadCapture'
// Mesma allowlist validada no servidor — ver WhatsAppRiskCalculator.
import { LEAD_SOURCES } from '../../../src/marketing/leadCapture.js'

const fields = [
  { key: 'monitorGroups', label: 'Grupos que você monitora', suffix: 'origens' },
  { key: 'destinationGroups', label: 'Grupos onde você publica', suffix: 'destinos' },
  { key: 'offersPerDay', label: 'Ofertas revisadas por dia', suffix: 'ofertas/dia' },
  { key: 'minutesPerOffer', label: 'Minutos manuais por oferta', suffix: 'min/oferta' },
  { key: 'daysPerWeek', label: 'Dias ativos por semana', suffix: 'dias' },
  { key: 'hourlyValue', label: 'Valor da sua hora', suffix: 'R$/h' },
]

const riskToneClasses = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-800',
}

function buildSignupHref(result) {
  const params = new URLSearchParams({
    mode: 'register',
    source: 'tool_time_calculator',
    utm_source: 'ferramentas',
    utm_medium: 'organic',
    utm_campaign: 'free-tools',
    utm_content: 'calculadora-tempo-grupos-whatsapp',
    tool_id: 'time_savings_calculator',
    score_band: result.riskLevel.id,
  })
  return `/login?${params.toString()}`
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-gray-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-gray-600">{hint}</p>
    </div>
  )
}

export function TimeSavingsCalculator() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS)
  const result = useMemo(() => calculateWhatsAppGroupTimeSavings(inputs), [inputs])
  const signupHref = useMemo(() => buildSignupHref(result), [result])

  function updateField(key, value) {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  function resetDefaults() {
    setInputs(DEFAULT_INPUTS)
  }

  const riskClass = riskToneClasses[result.riskLevel.tone] ?? riskToneClasses.emerald
  const summaryText = `Hoje sua rotina manual pode consumir cerca de ${formatHours(result.manualHoursMonth)}h/mês. Com processo organizado, a economia estimada é de ${formatHours(result.savedHoursMonth)}h/mês (${formatCurrency(result.opportunityCost)} em custo de tempo).`

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]" aria-labelledby="calculadora-tempo-title">
      <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Calculadora gratuita</p>
            <h2 id="calculadora-tempo-title" className="mt-2 text-2xl font-black tracking-tight text-gray-950">Preencha sua rotina atual</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">Use apenas números aproximados. A ferramenta não pede cookies, QR Code, links de afiliado nem dados de grupos.</p>
          </div>
          <button type="button" onClick={resetDefaults} className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50">
            Restaurar exemplo
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const limits = INPUT_LIMITS[field.key]
            return (
              <label key={field.key} className="block rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <span className="text-sm font-bold text-gray-800">{field.label}</span>
                <span className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-emerald-500">
                  <input
                    type="number"
                    min={limits.min}
                    max={limits.max}
                    step={field.key === 'hourlyValue' ? '1' : '1'}
                    value={inputs[field.key]}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    className="w-full border-0 bg-transparent text-lg font-black text-gray-950 outline-none"
                    aria-describedby={`${field.key}-hint`}
                  />
                  <span id={`${field.key}-hint`} className="shrink-0 text-xs font-bold uppercase tracking-wide text-gray-400">{field.suffix}</span>
                </span>
              </label>
            )
          })}
        </div>

        <div className="mt-5 rounded-2xl bg-emerald-950 p-5 text-white">
          <p className="text-sm font-bold text-emerald-100">Como calculamos</p>
          <p className="mt-2 text-sm leading-7 text-emerald-50">Estimamos revisão de ofertas, repostagem para destinos, checagem dos grupos de origem e comparamos a rotina manual com uma operação organizada por filtros, cadência e histórico. É uma estimativa operacional, não promessa de ganho financeiro.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className={`rounded-[2rem] border p-5 shadow-sm md:p-7 ${riskClass}`}>
          <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">Diagnóstico</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight">{result.riskLevel.label}</h3>
          <p className="mt-2 text-sm leading-7">{result.riskLevel.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard label="Tempo manual" value={`${formatHours(result.manualHoursMonth)}h/mês`} hint="Estimativa do esforço mensal mantendo o copia-e-cola manual." />
          <MetricCard label="Tempo economizável" value={`${formatHours(result.savedHoursMonth)}h/mês`} hint="Potencial de redução com rotina organizada, filtros, cadência e logs." />
          <MetricCard label="Custo de tempo" value={formatCurrency(result.opportunityCost)} hint="Valor estimado das horas que podem voltar para curadoria e relacionamento." />
          <MetricCard label="Volume mensal" value={`${result.monthlyOfferReviews.toLocaleString('pt-BR')} ofertas`} hint="Ofertas revisadas por mês com base nos seus dias ativos." />
        </div>

        <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-7">
          <h3 className="text-xl font-black tracking-tight text-gray-950">Recomendação inicial</h3>
          <p className="mt-3 text-sm leading-7 text-gray-700">{result.cadenceRecommendation}</p>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
            <li>• Revise preço, cupom, estoque e tag de afiliado antes de escalar.</li>
            <li>• Separe grupos de origem e destino para reduzir erro manual.</li>
            <li>• Use logs para entender quais grupos e horários funcionam melhor.</li>
          </ul>
          <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm leading-7 text-gray-700">
            <strong className="text-gray-950">Resumo:</strong> {summaryText}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href={signupHref} className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
              Começar teste grátis com esta rotina
            </Link>
            <Link href="/ferramentas" className="inline-flex items-center justify-center rounded-xl border border-emerald-200 px-5 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-50">
              Ver outras ferramentas
            </Link>
          </div>
        </div>

        <ToolLeadCapture
          source={LEAD_SOURCES.TIME_CALCULATOR}
          context={{
            manual_hours_month: result.manualHoursMonth,
            saved_hours_month: result.savedHoursMonth,
            risk_level: result.riskLevel.id,
          }}
          question="Quer recuperar essas horas na sua operação?"
          utmCampaign="canais-preservacao"
        />
      </div>
    </section>
  )
}
