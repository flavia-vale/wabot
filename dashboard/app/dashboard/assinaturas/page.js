'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { DEFAULT_LANDING_PLANS } from '@/lib/marketing-content'

const SUPPORT_PHONE = '(32) 99984-4020'
const SUPPORT_WA_NUMBER = '5532999844020'
const PIX_KEY = 'd80c705f-3893-4802-939b-cce5c9338c66'

const PAID_PLAN_IDS = ['basic', 'pro']
const FALLBACK_PLAN_CARDS = DEFAULT_LANDING_PLANS
  .filter((plan) => PAID_PLAN_IDS.includes(plan.id))
  .map((plan) => ({
    id: plan.id,
    name: `Plano ${plan.name}`,
    price: plan.price,
    period: plan.period,
    description: plan.desc,
    features: plan.features,
  }))

const PLAN_LABELS = {
  trial: 'Trial',
  basic: 'Basic',
  pro: 'Pro',
}

function mergePlanCards(dynamicPlans = []) {
  const byId = new Map((dynamicPlans ?? []).map((plan) => [plan.id, plan]))
  return FALLBACK_PLAN_CARDS.map((fallbackPlan) => {
    const dynamicPlan = byId.get(fallbackPlan.id)
    return {
      ...fallbackPlan,
      name: dynamicPlan?.title ? `Plano ${dynamicPlan.title}` : fallbackPlan.name,
      price: dynamicPlan?.price || fallbackPlan.price,
      description: dynamicPlan?.description || fallbackPlan.description,
      features: Array.isArray(dynamicPlan?.features) && dynamicPlan.features.length ? dynamicPlan.features : fallbackPlan.features,
      position: dynamicPlan?.position ?? fallbackPlan.position,
    }
  })
}

function getExpiredAccessCopy(user) {
  if (!user?.accessExpiresAt) return null
  const expiresAt = new Date(user.accessExpiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt >= new Date()) return null

  const dateLabel = expiresAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const planLabel = PLAN_LABELS[user.plan] ?? user.plan ?? 'plano'

  return user.plan === 'trial'
    ? `Seu trial venceu em ${dateLabel}. O bot fica pausado e não envia novas mensagens até a renovação.`
    : `Seu plano ${planLabel} venceu em ${dateLabel}. O bot fica pausado e não envia novas mensagens até a renovação.`
}

export default function AssinaturasPage() {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [email, setEmail] = useState('')
  const [expiredAccessCopy, setExpiredAccessCopy] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('pro')

  useEffect(() => {
    let active = true
    Promise.allSettled([api.me(), api.publicPlans()])
      .then(([userResult, plansResult]) => {
        if (!active) return
        if (userResult.status === 'fulfilled') {
          const user = userResult.value
          setEmail(user?.email || '')
          setExpiredAccessCopy(getExpiredAccessCopy(user) || '')
        } else {
          setEmail('')
          setExpiredAccessCopy('')
        }

        if (plansResult.status === 'fulfilled') {
          const dynamicPlans = Array.isArray(plansResult.value?.plans) ? plansResult.value.plans : []
          setPlans(mergePlanCards(dynamicPlans))
        }
      })
      .catch(() => {
        if (!active) return
        setEmail('')
        setExpiredAccessCopy('')
        setPlans(FALLBACK_PLAN_CARDS)
      })

    return () => {
      active = false
    }
  }, [])

  async function handleCheckout(planId) {
    if (checkoutPlan) return
    setCheckoutError('')
    setCheckoutPlan(planId)
    try {
      const data = await api.paymentsCheckout(planId)
      const checkoutUrl = data?.checkout_url
      if (!checkoutUrl) throw new Error('Checkout indisponível no momento. Use o PIX manual ou fale com o suporte.')
      window.location.assign(checkoutUrl)
    } catch (err) {
      setCheckoutError(err?.message || 'Não foi possível iniciar o checkout. Use o PIX manual ou fale com o suporte.')
      setCheckoutPlan('')
    }
  }

  async function handleCopyPix() {
    setCopyError('')
    try {
      await navigator.clipboard.writeText(PIX_KEY)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (_) {
      setCopyError('Não foi possível copiar automaticamente. Pressione e segure para copiar manualmente.')
    }
  }

  const selectedPlan = useMemo(
    () => PLAN_CARDS.find((plan) => plan.id === selectedPlanId) ?? PLAN_CARDS[0],
    [selectedPlanId],
  )

  const whatsappLink = useMemo(() => {
    const payload = `Olá, acabei de fazer o PIX do ${selectedPlan.name} (${selectedPlan.price}/30 dias). Segue o comprovante para ativação da conta ${email || '[E-MAIL DO USUÁRIO]'}.`
    return `https://wa.me/${SUPPORT_WA_NUMBER}?text=${encodeURIComponent(payload)}`
  }, [email, selectedPlan])

  return (
    <section className="mx-auto w-full max-w-3xl">
      <header className="mb-5 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-800 md:text-2xl">Escolha seu plano</h1>
        <p className="mt-2 text-sm text-gray-600">Pague com checkout seguro para ativação automática. Se o provedor estiver indisponível, use o PIX manual como fallback.</p>
      </header>

      {expiredAccessCopy && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950 shadow-sm" role="alert">
          <p className="text-sm font-bold">Plano vencido: seus envios automáticos estão pausados</p>
          <p className="mt-2 text-sm text-red-900">{expiredAccessCopy}</p>
          <p className="mt-2 text-xs font-semibold text-red-800">Escolha um plano e finalize o checkout para reativar sua conta.</p>
        </div>
      )}

      {checkoutError && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
          <p className="font-bold">Checkout não iniciado</p>
          <p className="mt-1">{checkoutError}</p>
          <p className="mt-1 text-xs font-semibold">Você ainda pode pagar via PIX manual abaixo e enviar o comprovante no WhatsApp.</p>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PLAN_CARDS.map((plan) => {
          const selected = plan.id === selectedPlanId
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              aria-pressed={selected}
              className={`rounded-2xl border p-5 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${selected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-gray-200 bg-white hover:border-emerald-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-gray-800">{plan.name}</h2>
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${selected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{selected ? 'Selecionado' : 'Escolher'}</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-emerald-600">{plan.price}<span className="ml-1 text-xs font-medium text-gray-500">/ 30 dias</span></p>
              <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-800">PIX Copia e Cola · {selectedPlan.name} ({selectedPlan.price}/30 dias)</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={PIX_KEY}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            aria-label="Chave PIX para copiar"
          />
          <button
            type="button"
            onClick={handleCopyPix}
            className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            aria-live="polite"
          >
            {copied ? 'Copiado!' : 'Copiar chave PIX'}
          </button>
        </div>
        {copyError && <p className="mt-2 text-xs text-red-600">{copyError}</p>}

        <p className="mt-4 text-sm text-gray-700">Assim que pagar o PIX do {selectedPlan.name}, envie o comprovante pelo botão abaixo. A mensagem já vai com o plano escolhido para reduzir erros de ativação manual.</p>
        <p className="mt-1 text-sm font-medium text-gray-800">Suporte: {SUPPORT_PHONE}</p>

        <a
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          Enviar comprovante no WhatsApp
        </a>
      </div>
    </section>
  )
}
