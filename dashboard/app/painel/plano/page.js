'use client'

/* Plano e cobrança — reskin Menta do corpo. Mesma lógica de
 * Usa os contratos canônicos: api.publicPlans + api.paymentsOverview
 * para mostrar a assinatura atual e os planos; api.paymentsCheckout para o
 * Mercado Pago. Sem mudança no back end.
 * Reusa apenas classes Menta já existentes (não toca em painel.css). */

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { DEFAULT_LANDING_PLANS, SUPPORT_WHATSAPP_URL } from '@/lib/marketing-content'
import { usePainelHeader } from '../PainelShell'

const SUPPORT_PAYMENT_HELP_URL = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent('Oi! Estou com dificuldade no pagamento do BOTinho, pode me ajudar?')}`

const PAID_PLAN_IDS = ['basic', 'pro']
const PLAN_LABELS = { trial: 'Trial', basic: 'Basic', pro: 'Pro' }

const FALLBACK_PLAN_CARDS = DEFAULT_LANDING_PLANS
  .filter((plan) => PAID_PLAN_IDS.includes(plan.id))
  .map((plan) => ({ id: plan.id, name: `Plano ${plan.name}`, price: plan.price, period: plan.period, description: plan.desc, features: plan.features }))

function formatDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCurrency(value) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mergePlanCards(dynamicPlans = []) {
  const byId = new Map((dynamicPlans ?? []).map((plan) => [plan.id, plan]))
  return FALLBACK_PLAN_CARDS.map((fb) => {
    const dyn = byId.get(fb.id)
    return {
      ...fb,
      name: dyn?.title ? `Plano ${dyn.title}` : fb.name,
      price: dyn?.price || fb.price,
      description: dyn?.description || fb.description,
      features: Array.isArray(dyn?.features) && dyn.features.length ? dyn.features : fb.features,
    }
  })
}

export default function PlanoPage() {
  usePainelHeader({ title: 'Plano e cobrança', subtitle: 'Sua assinatura, uso e forma de pagamento' })

  const [plans, setPlans] = useState(FALLBACK_PLAN_CARDS)
  const [overview, setOverview] = useState(null)
  const [selectedPlanId, setSelectedPlanId] = useState('pro')
  const [checkoutPlan, setCheckoutPlan] = useState('')
  const [checkoutError, setCheckoutError] = useState('')

  useEffect(() => {
    let active = true
    Promise.allSettled([api.publicPlans(), api.paymentsOverview()]).then(([p, o]) => {
      if (!active) return
      if (p.status === 'fulfilled') setPlans(mergePlanCards(Array.isArray(p.value?.plans) ? p.value.plans : []))
      if (o.status === 'fulfilled') setOverview(o.value || null)
    })
    return () => { active = false }
  }, [])

  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId) ?? plans[0], [plans, selectedPlanId])

  async function handleCheckout(planId) {
    if (checkoutPlan) return
    setCheckoutError('')
    setCheckoutPlan(planId)
    try {
      const data = await api.paymentsCheckout(planId)
      if (!data?.checkout_url) throw new Error('Checkout indisponível no momento. Tente novamente ou fale com o suporte.')
      window.location.assign(data.checkout_url)
    } catch (err) {
      setCheckoutError(err?.message || 'Não foi possível iniciar o checkout. Tente novamente ou fale com o suporte.')
      setCheckoutPlan('')
    }
  }

  const currentPlanLabel = overview?.plan ? (PLAN_LABELS[overview.plan] ?? overview.plan) : null
  const expiresAtLabel = formatDate(overview?.accessExpiresAt)
  const nextChargeLabel = formatDate(overview?.nextChargeAt)
  const lastAmount = overview?.lastApprovedPayment?.amount != null ? formatCurrency(overview.lastApprovedPayment.amount) : null
  const lastDate = formatDate(overview?.lastApprovedPayment?.createdAt)

  return (
    <div className="pnl-grid" style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Assinatura atual */}
      {overview?.isActive && currentPlanLabel && (
        <section className="pnl-card" style={{ background: 'var(--ink)', color: 'var(--surface)', borderColor: 'var(--ink)' }}>
          <div className="pnl-toolbar" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="pnl-hero-label">Assinatura atual</div>
              <div className="pnl-serif" style={{ fontSize: 30, marginTop: 4 }}>Plano {currentPlanLabel}</div>
            </div>
            {overview.expiresInDays != null && expiresAtLabel && (
              <div style={{ textAlign: 'right' }}>
                <div className="pnl-hero-sub">{overview.autoRenew ? 'Renovação automática em' : 'Renova manualmente em'}</div>
                <div className="pnl-serif" style={{ fontSize: 22 }}>{overview.expiresInDays} {overview.expiresInDays === 1 ? 'dia' : 'dias'}</div>
                <div className="pnl-hero-sub">{overview.autoRenew && nextChargeLabel ? `próxima cobrança em ${nextChargeLabel}` : `até ${expiresAtLabel}`}</div>
              </div>
            )}
          </div>
          <p className="pnl-hero-sub" style={{ marginTop: 12 }}>{overview.billingModel} · Pagamento via {overview.paymentMethod}</p>
          {lastAmount && lastDate && <p className="pnl-hero-sub">Último pagamento: {lastAmount} em {lastDate}</p>}
        </section>
      )}
      {/* Planos */}
      <section className="pnl-card">
        <div className="pnl-card-title" style={{ marginBottom: 4 }}>{overview?.isActive ? 'Renovar ou trocar de plano' : 'Escolha seu plano'}</div>
        <p className="pnl-card-note" style={{ marginBottom: 14 }}>Cobrança a cada 30 dias, sem fidelidade.</p>
        <div className="pnl-presets" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {plans.map((plan) => {
            const selected = plan.id === selectedPlanId
            return (
              <button key={plan.id} type="button" className={`pnl-preset${selected ? ' is-active' : ''}`} onClick={() => setSelectedPlanId(plan.id)} aria-pressed={selected}>
                <div className="pnl-toolbar" style={{ justifyContent: 'space-between' }}>
                  <b>{plan.name}</b>
                  <span className={`pnl-tag ${selected ? 'is-success' : 'is-skip'}`}>{selected ? 'Selecionado' : 'Escolher'}</span>
                </div>
                <span className="pnl-serif" style={{ fontSize: 26, color: 'var(--accent-strong)', display: 'block', margin: '6px 0 2px' }}>{plan.price}<small style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 500 }}> / 30 dias</small></span>
                <small>{plan.description}</small>
                {Array.isArray(plan.features) && plan.features.length > 0 && (
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 5 }}>
                    {plan.features.map((feature) => (
                      <li key={feature} className="pnl-hint" style={{ listStyle: 'disc' }}>{feature}</li>
                    ))}
                  </ul>
                )}
              </button>
            )
          })}
        </div>

        {checkoutError && (
          <div className="pnl-note-box is-warn" style={{ marginTop: 14 }} role="alert">
            <strong style={{ fontWeight: 600 }}>Checkout não iniciado</strong>
            <p style={{ marginTop: 4 }}>{checkoutError}</p>
          </div>
        )}

        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => handleCheckout(selectedPlanId)} disabled={!!checkoutPlan}>
          {checkoutPlan === selectedPlanId ? 'Aguarde…' : `Pagar 30 dias — ${selectedPlan.name}`}
        </button>
        <p className="pnl-hint" style={{ textAlign: 'center', marginTop: 8 }}>Pagamento único de 30 dias via PIX ou cartão. Você renova manualmente ao expirar.</p>
      </section>

      {/* Dificuldades no pagamento */}
      <section className="pnl-card">
        <div className="pnl-card-title" style={{ marginBottom: 4 }}>Dificuldades no pagamento?</div>
        <p className="pnl-card-note" style={{ marginBottom: 14 }}>Fale com o suporte pelo WhatsApp e a gente ajuda a resolver.</p>
        <a
          href={SUPPORT_PAYMENT_HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="pnl-btn is-ghost"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Chamar suporte no WhatsApp
        </a>
      </section>
    </div>
  )
}
