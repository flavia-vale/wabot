'use client'

/* Plano e cobrança — reskin Menta do corpo. Mesma lógica de
 * Usa os contratos canônicos: api.me + api.publicPlans + api.paymentsOverview
 * para mostrar a assinatura atual e os planos; api.paymentsCheckout para o
 * Mercado Pago; PIX manual + comprovante no WhatsApp. Sem mudança no back end.
 * Reusa apenas classes Menta já existentes (não toca em painel.css). */

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { DEFAULT_LANDING_PLANS } from '@/lib/marketing-content'
import { usePainelHeader } from '../PainelShell'

const SUPPORT_PHONE = '(32) 99984-4020'
const SUPPORT_WA_NUMBER = '5532999844020'
const PIX_KEY = 'd80c705f-3893-4802-939b-cce5c9338c66'

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

function getExpiredCopy(user) {
  if (!user?.accessExpiresAt) return ''
  const expiresAt = new Date(user.accessExpiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt >= new Date()) return ''
  const dateLabel = formatDate(expiresAt)
  const planLabel = PLAN_LABELS[user.plan] ?? user.plan ?? 'plano'
  return user.plan === 'trial'
    ? `Seu trial venceu em ${dateLabel}. O bot fica pausado e não envia novas mensagens até a renovação.`
    : `Seu plano ${planLabel} venceu em ${dateLabel}. O bot fica pausado e não envia novas mensagens até a renovação.`
}

export default function PlanoPage() {
  usePainelHeader({ title: 'Plano e cobrança', subtitle: 'Sua assinatura, uso e forma de pagamento' })

  const [plans, setPlans] = useState(FALLBACK_PLAN_CARDS)
  const [overview, setOverview] = useState(null)
  const [email, setEmail] = useState('')
  const [expiredCopy, setExpiredCopy] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('pro')
  const [checkoutPlan, setCheckoutPlan] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')

  useEffect(() => {
    let active = true
    Promise.allSettled([api.me(), api.publicPlans(), api.paymentsOverview()]).then(([u, p, o]) => {
      if (!active) return
      if (u.status === 'fulfilled') { setEmail(u.value?.email || ''); setExpiredCopy(getExpiredCopy(u.value)) }
      if (p.status === 'fulfilled') setPlans(mergePlanCards(Array.isArray(p.value?.plans) ? p.value.plans : []))
      if (o.status === 'fulfilled') setOverview(o.value || null)
    })
    return () => { active = false }
  }, [])

  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId) ?? plans[0], [plans, selectedPlanId])

  const whatsappLink = useMemo(() => {
    const payload = `Olá, acabei de fazer o PIX do ${selectedPlan.name} (${selectedPlan.price}/30 dias). Segue o comprovante para ativação da conta ${email || '[E-MAIL DO USUÁRIO]'}.`
    return `https://wa.me/${SUPPORT_WA_NUMBER}?text=${encodeURIComponent(payload)}`
  }, [email, selectedPlan])

  async function handleCheckout(planId) {
    if (checkoutPlan) return
    setCheckoutError('')
    setCheckoutPlan(planId)
    try {
      const data = await api.paymentsCheckout(planId)
      if (!data?.checkout_url) throw new Error('Checkout indisponível no momento. Use o PIX manual ou fale com o suporte.')
      window.location.assign(data.checkout_url)
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
    } catch {
      setCopyError('Não foi possível copiar automaticamente. Pressione e segure para copiar manualmente.')
    }
  }

  const currentPlanLabel = overview?.plan ? (PLAN_LABELS[overview.plan] ?? overview.plan) : null
  const expiresAtLabel = formatDate(overview?.accessExpiresAt)
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
                <div className="pnl-hero-sub">Renova manualmente em</div>
                <div className="pnl-serif" style={{ fontSize: 22 }}>{overview.expiresInDays} {overview.expiresInDays === 1 ? 'dia' : 'dias'}</div>
                <div className="pnl-hero-sub">até {expiresAtLabel}</div>
              </div>
            )}
          </div>
          <p className="pnl-hero-sub" style={{ marginTop: 12 }}>{overview.billingModel} · Pagamento via {overview.paymentMethod}</p>
          {lastAmount && lastDate && <p className="pnl-hero-sub">Último pagamento: {lastAmount} em {lastDate}</p>}
        </section>
      )}

      {expiredCopy && (
        <div className="pnl-note-box is-error" role="alert">
          <strong style={{ fontWeight: 600 }}>Plano vencido: seus envios automáticos estão pausados</strong>
          <p style={{ marginTop: 6 }}>{expiredCopy}</p>
          <p style={{ marginTop: 6, fontWeight: 600 }}>Escolha um plano e finalize o checkout para reativar sua conta.</p>
        </div>
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
              </button>
            )
          })}
        </div>

        {checkoutError && (
          <div className="pnl-note-box is-warn" style={{ marginTop: 14 }} role="alert">
            <strong style={{ fontWeight: 600 }}>Checkout não iniciado</strong>
            <p style={{ marginTop: 4 }}>{checkoutError}</p>
            <p style={{ marginTop: 4 }}>Você ainda pode pagar via PIX manual abaixo e enviar o comprovante no WhatsApp.</p>
          </div>
        )}

        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => handleCheckout(selectedPlanId)} disabled={!!checkoutPlan}>
          {checkoutPlan === selectedPlanId ? 'Aguarde…' : `Assinar ${selectedPlan.name} com Mercado Pago`}
        </button>
        <p className="pnl-hint" style={{ textAlign: 'center', marginTop: 8 }}>Você será redirecionado para o Mercado Pago para concluir o pagamento.</p>
      </section>

      {/* PIX manual */}
      <section className="pnl-card">
        <div className="pnl-card-title">Prefere pagar via PIX manual?</div>
        <p className="pnl-card-note" style={{ marginBottom: 12 }}>Copie a chave PIX abaixo e envie o comprovante no WhatsApp.</p>
        <p className="pnl-label" style={{ marginBottom: 8 }}>PIX Copia e Cola · {selectedPlan.name} ({selectedPlan.price}/30 dias)</p>
        <div className="pnl-inline-form">
          <input className="pnl-input" readOnly value={PIX_KEY} aria-label="Chave PIX para copiar" />
          <button type="button" className="pnl-btn is-primary" style={{ justifyContent: 'center' }} onClick={handleCopyPix} aria-live="polite">{copied ? 'Copiado!' : 'Copiar chave PIX'}</button>
        </div>
        {copyError && <p className="pnl-field-error" style={{ marginTop: 8 }}>{copyError}</p>}

        <p className="pnl-card-note" style={{ marginTop: 14 }}>Assim que pagar o PIX do {selectedPlan.name}, envie o comprovante pelo botão abaixo — a mensagem já vai com o plano escolhido. Suporte: {SUPPORT_PHONE}</p>
        <a className="pnl-btn is-primary" style={{ marginTop: 12, justifyContent: 'center' }} href={whatsappLink} target="_blank" rel="noreferrer">Enviar comprovante no WhatsApp</a>
      </section>
    </div>
  )
}
