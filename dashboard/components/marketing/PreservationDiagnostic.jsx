'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { TRACKING_EVENTS, trackEvent } from '@/lib/analytics'
import { sanitizeAttributionValue } from '@/lib/marketing-attribution'
import { submitLeadBeacon } from '@/lib/free-tools/lead-capture-client'
// Mesma allowlist validada no servidor — ver src/marketing/leadCapture.js.
import { LEAD_SOURCES } from '../../../src/marketing/leadCapture.js'

const questions = [
  {
    id: 'dedicated_chip',
    label: 'Seu bot usa chip dedicado?',
    options: [
      { value: 'dedicated', label: 'Sim, número separado da vida pessoal', score: 0 },
      { value: 'mixed', label: 'Não, uso meu número pessoal ou compartilhado', score: 24 },
    ],
  },
  {
    id: 'publishing_rhythm',
    label: 'Como está a cadência de publicação?',
    options: [
      { value: 'controlled', label: 'Tenho limites, intervalos e horário de silêncio', score: 0 },
      { value: 'bursts', label: 'Publico em rajadas ou tudo no mesmo minuto', score: 20 },
    ],
  },
  {
    id: 'message_variation',
    label: 'As mensagens mudam entre destinos?',
    options: [
      { value: 'varied', label: 'Sim, vario chamada, emojis e ordem dos elementos', score: 0 },
      { value: 'identical', label: 'Não, envio textos praticamente idênticos', score: 18 },
    ],
  },
  {
    id: 'channel_mix',
    label: 'Você depende de um único tipo de destino?',
    options: [
      { value: 'mixed', label: 'Uso grupos e canais com papéis diferentes', score: 0 },
      { value: 'single', label: 'Dependo de poucos grupos ou de um único canal', score: 16 },
    ],
  },
  {
    id: 'monitoring',
    label: 'Você monitora sinais de queda?',
    options: [
      { value: 'tracked', label: 'Acompanho erros, entrega, cliques e alertas', score: 0 },
      { value: 'blind', label: 'Só percebo quando os cliques ou vendas caem', score: 18 },
    ],
  },
  {
    id: 'recovery_plan',
    label: 'Existe plano de recuperação?',
    options: [
      { value: 'planned', label: 'Tenho backup de configuração e plano B', score: 0 },
      { value: 'none', label: 'Se cair, eu resolvo na hora', score: 14 },
    ],
  },
]

const resultBands = [
  {
    id: 'baixo',
    min: 0,
    max: 24,
    label: 'Exposição baixa, mas ainda monitorável',
    tone: 'emerald',
    summary: 'Sua operação já tem algumas camadas de preservação. O próximo passo é documentar limites, manter monitoramento e revisar variações antes de aumentar volume.',
    actions: ['Registre limites por canal e grupo.', 'Mantenha chip dedicado e rotina de revisão.', 'Acompanhe queda de cliques como alerta preventivo.'],
  },
  {
    id: 'moderado',
    min: 25,
    max: 49,
    label: 'Exposição moderada',
    tone: 'amber',
    summary: 'Há sinais de improviso que podem virar risco quando o volume crescer. Priorize cadência, variações e separação clara entre grupos e canais.',
    actions: ['Defina horário de silêncio e intervalo mínimo.', 'Varie chamadas e emojis por destino.', 'Planeje migração gradual para Canais do WhatsApp.'],
  },
  {
    id: 'alto',
    min: 50,
    max: 74,
    label: 'Exposição alta',
    tone: 'orange',
    summary: 'Sua operação depende de muitos pontos frágeis ao mesmo tempo. Antes de postar mais, organize chip, cadência, monitoramento e plano de recuperação.',
    actions: ['Pare rajadas de publicação idêntica.', 'Separe número operacional do número pessoal.', 'Mapeie fontes, destinos e canal reserva.'],
  },
  {
    id: 'critico',
    min: 75,
    max: 110,
    label: 'Exposição crítica',
    tone: 'red',
    summary: 'O risco operacional está concentrado: chip, audiência, cadência e recuperação dependem de improviso. Trate a operação como ativo antes de ampliar divulgação.',
    actions: ['Comece por chip dedicado e redução de volume.', 'Crie plano de recuperação para canais e grupos.', 'Use o BOTinho para estruturar preservação antes de escalar.'],
  },
]

const toneClasses = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  amber: 'border-amber-200 bg-amber-50 text-amber-950',
  orange: 'border-orange-200 bg-orange-50 text-orange-950',
  red: 'border-red-200 bg-red-50 text-red-950',
}

function getResult(score) {
  return resultBands.find((band) => score >= band.min && score <= band.max) ?? resultBands[resultBands.length - 1]
}

function buildSignupHref(result) {
  const params = new URLSearchParams({
    mode: 'register',
    source: 'diagnostico_antiban_whatsapp',
    utm_source: 'seo',
    utm_medium: 'diagnostic',
    utm_campaign: 'canais-preservacao',
    utm_content: `resultado_${result.id}`,
    diagnostic_score_band: result.id,
  })
  return `/login?${params.toString()}`
}

export function PreservationDiagnostic({ origin = 'diagnostico_antiban_whatsapp' }) {
  const safeOrigin = sanitizeAttributionValue(origin) || 'diagnostico_antiban_whatsapp'
  const [answers, setAnswers] = useState(() => Object.fromEntries(questions.map((question) => [question.id, question.options[0].value])))
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState('afiliado-achadinhos')
  const [hasViewedResult, setHasViewedResult] = useState(false)

  const score = useMemo(() => questions.reduce((total, question) => {
    const selected = question.options.find((option) => option.value === answers[question.id]) ?? question.options[0]
    return total + selected.score
  }, 0), [answers])

  const result = useMemo(() => getResult(score), [score])
  const signupHref = useMemo(() => buildSignupHref(result), [result])

  function updateAnswer(question, value) {
    setAnswers((current) => ({ ...current, [question.id]: value }))
    trackEvent(TRACKING_EVENTS.DIAGNOSTIC_ANSWER_CHANGED, {
      origin: safeOrigin,
      diagnostic_id: 'preservacao_avancada_whatsapp',
      question_id: question.id,
      answer: String(value).slice(0, 48),
    })
  }

  function trackResultView() {
    if (hasViewedResult) return
    setHasViewedResult(true)
    trackEvent(TRACKING_EVENTS.DIAGNOSTIC_RESULT_VIEWED, {
      origin: safeOrigin,
      diagnostic_id: 'preservacao_avancada_whatsapp',
      score,
      score_band: result.id,
    })
  }

  function trackSubmit() {
    trackEvent(TRACKING_EVENTS.DIAGNOSTIC_FORM_SUBMITTED, {
      origin: safeOrigin,
      diagnostic_id: 'preservacao_avancada_whatsapp',
      score,
      score_band: result.id,
      profile: sanitizeAttributionValue(profile),
    })

    /* Guarda o lead ANTES da navegação para o cadastro. Sem isto, quem preenche
     * o e-mail aqui e desiste no meio do cadastro não deixa rastro nenhum — e
     * essa pessoa é justamente a mais interessada da página. Beacon porque o
     * submit é um GET para /login e um fetch comum morreria na navegação. */
    // O campo de e-mail é opcional nesta página. Só chamamos com algo plausível
    // para não gerar 400 (e ruído de `tool_lead_rejected`) em cada submit vazio.
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      submitLeadBeacon({
        email: email.trim(),
        source: LEAD_SOURCES.ANTIBAN_DIAGNOSTIC,
        context: { score, band: result.id, profile: sanitizeAttributionValue(profile) },
      })
    }
  }

  function trackCta(cta) {
    trackEvent(TRACKING_EVENTS.DIAGNOSTIC_CTA_CLICKED, {
      origin: safeOrigin,
      diagnostic_id: 'preservacao_avancada_whatsapp',
      score,
      score_band: result.id,
      cta,
    })
  }

  const resultClass = toneClasses[result.tone] ?? toneClasses.emerald

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]" aria-labelledby="diagnostico-form-title">
      <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Diagnóstico gratuito</p>
            <h2 id="diagnostico-form-title" className="mt-2 text-2xl font-black tracking-tight text-gray-950">Responda 6 perguntas rápidas</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">Não pedimos QR Code, senha, link de grupo ou acesso ao WhatsApp. O resultado é uma estimativa de exposição operacional.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-black uppercase tracking-wide text-emerald-800">2 min</span>
        </div>

        <div className="mt-6 space-y-4">
          {questions.map((question, index) => (
            <fieldset key={question.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <legend className="text-sm font-black text-gray-950">{index + 1}. {question.label}</legend>
              <div className="mt-3 grid gap-2">
                {question.options.map((option) => (
                  <label key={option.value} className="flex cursor-pointer gap-3 rounded-xl bg-white p-3 text-sm leading-6 text-gray-700 ring-1 ring-gray-200 transition hover:ring-emerald-300">
                    <input
                      type="radio"
                      name={question.id}
                      value={option.value}
                      checked={answers[question.id] === option.value}
                      onChange={() => updateAnswer(question, option.value)}
                      className="mt-1"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      <aside className="space-y-4" onMouseEnter={trackResultView} onFocus={trackResultView}>
        <div className={`rounded-[2rem] border p-5 shadow-sm md:p-7 ${resultClass}`}>
          <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">Resultado estimado</p>
          <div className="mt-3 flex items-end gap-2">
            <strong className="text-5xl font-black tracking-tight">{score}</strong>
            <span className="pb-2 text-sm font-bold opacity-80">/ 110 pontos de exposição</span>
          </div>
          <h3 className="mt-4 text-2xl font-black tracking-tight">{result.label}</h3>
          <p className="mt-3 text-sm leading-7">{result.summary}</p>
        </div>

        <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-7">
          <h3 className="text-xl font-black tracking-tight text-gray-950">Próximas ações recomendadas</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
            {result.actions.map((action) => (
              <li key={action} className="flex gap-3"><span aria-hidden="true" className="text-emerald-600">•</span><span>{action}</span></li>
            ))}
          </ul>
        </div>

        <form action="/login" method="get" className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm md:p-7" data-crm-stage="MQL" data-crm-source={safeOrigin} onSubmit={trackSubmit}>
          <input type="hidden" name="mode" value="register" />
          <input type="hidden" name="source" value="diagnostico_antiban_whatsapp" />
          <input type="hidden" name="utm_source" value="seo" />
          <input type="hidden" name="utm_medium" value="diagnostic" />
          <input type="hidden" name="utm_campaign" value="canais-preservacao" />
          <input type="hidden" name="utm_content" value={`resultado_${result.id}`} />
          <input type="hidden" name="diagnostic_score" value={score} />
          <input type="hidden" name="diagnostic_score_band" value={result.id} />
          <h3 className="text-xl font-black tracking-tight text-gray-950">Receber plano de preservação no cadastro</h3>
          <p className="mt-2 text-sm leading-6 text-gray-700">Leve o resultado para o cadastro do BOTinho e comece com contexto de risco, cadência e canais.</p>
          <label className="mt-4 block text-sm font-bold text-gray-800" htmlFor="diagnostic-email">E-mail</label>
          <input
            id="diagnostic-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            className="mt-2 min-h-12 w-full rounded-xl border border-emerald-200 bg-white px-4 text-gray-900 outline-none ring-emerald-300 focus:ring-2"
          />
          <label className="mt-3 block text-sm font-bold text-gray-800" htmlFor="diagnostic-profile">Perfil da operação</label>
          <select
            id="diagnostic-profile"
            name="segmento"
            value={profile}
            onChange={(event) => setProfile(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-emerald-200 bg-white px-4 text-gray-900 outline-none ring-emerald-300 focus:ring-2"
          >
            <option value="afiliado-achadinhos">Afiliado de achadinhos</option>
            <option value="admin-canais">Admin de canais/grupos</option>
            <option value="ecommerce-ofertas">E-commerce/ofertas</option>
            <option value="agencia-growth">Agência/growth</option>
          </select>
          <button type="submit" className="mt-4 min-h-12 w-full rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700" onClick={() => trackCta('submit_diagnostic_to_signup')}>
            Salvar resultado e criar conta
          </button>
          <Link
            href={signupHref}
            className="mt-3 inline-flex w-full justify-center rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-100"
            data-seo-cta="diagnostic_direct_signup"
            data-cta-position="result_secondary"
            data-cta-stage="diagnostic"
            data-cta-destination="signup"
            onClick={() => trackCta('direct_signup_without_email')}
          >
            Prefiro ir direto para o cadastro
          </Link>
          <p className="mt-4 text-xs leading-5 text-gray-500">Aviso honesto: este diagnóstico não garante banimento zero. Ele organiza sinais de exposição para reduzir risco com operação responsável.</p>
        </form>
      </aside>
    </section>
  )
}
