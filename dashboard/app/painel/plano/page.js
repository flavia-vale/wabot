'use client'

/* Plano e cobrança — reskin Menta do corpo. Mesma lógica de
 * Usa os contratos canônicos: api.publicPlans + api.paymentsOverview
 * para mostrar a assinatura atual e os planos; api.paymentsCheckout para o
 * Mercado Pago. Sem mudança no back end.
 * Reusa apenas classes Menta já existentes (não toca em painel.css). */

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { DEFAULT_LANDING_PLANS, SUPPORT_WHATSAPP_URL } from '@/lib/marketing-content'
import { usePainel, usePainelHeader } from '../PainelShell'
import { CONFIG_PRESERVED_NOTE } from '../../../../src/domain/painel/trialNotice.js'
import { buildPricePerOffer, parsePriceToCents } from '../../../../src/domain/painel/pricePerOffer.js'

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
  // 'auto' = renovação automática (assinatura no Mercado Pago);
  // 'once' = pagamento único de 30 dias (comportamento histórico).
  const [billingMode, setBillingMode] = useState('auto')
  const [emailPrompt, setEmailPrompt] = useState(null)
  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [cancelState, setCancelState] = useState('idle')
  const [cancelMessage, setCancelMessage] = useState('')

  async function refreshOverview() {
    try {
      const data = await api.paymentsOverview()
      setOverview(data || null)
    } catch {
      // Falha ao reler o resumo não desfaz a ação que acabou de dar certo.
    }
  }

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

  // D5 do plano de ativação de 2026-09-08: o mesmo preço, medido no uso REAL
  // dela. "R$ 69" é um número solto; "R$ 1,47 por oferta publicada" é a conta
  // que ela consegue refazer sozinha, com o número que é dela.
  const { offersPublished } = usePainel()
  const precoPorOferta = useMemo(
    () => buildPricePerOffer({
      priceCents: parsePriceToCents(selectedPlan?.price),
      offersPublished,
    }),
    [selectedPlan?.price, offersPublished],
  )

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

  async function handleSubscribe(planId) {
    if (checkoutPlan) return
    setCheckoutError('')
    setEmailPrompt(null)
    setCheckoutPlan(planId)
    try {
      const data = await api.paymentsCreateSubscription(planId)
      if (!data?.init_point) throw new Error('Assinatura indisponível no momento. Tente novamente ou fale com o suporte.')
      window.location.assign(data.init_point)
    } catch (err) {
      // O Mercado Pago só aceita assinatura com um e-mail válido e conhecido
      // por ele. Em vez de um erro sem saída, a tela oferece a troca ali mesmo.
      if (err?.needsEmailUpdate) {
        setEmailPrompt({ plan: planId, message: err?.message || 'Confira o e-mail da sua conta para assinar com renovação automática.' })
      } else {
        setCheckoutError(err?.message || 'Não foi possível iniciar a assinatura. Tente novamente ou fale com o suporte.')
      }
      setCheckoutPlan('')
    }
  }

  async function handleSaveEmailAndRetry() {
    if (savingEmail) return
    const email = newEmail.trim()
    if (!email) return
    setSavingEmail(true)
    setCheckoutError('')
    try {
      await api.updateAccountEmail(email)
      const plan = emailPrompt?.plan ?? selectedPlanId
      setEmailPrompt(null)
      setNewEmail('')
      await handleSubscribe(plan)
    } catch (err) {
      setCheckoutError(err?.message || 'Não foi possível salvar o e-mail. Tente novamente.')
    } finally {
      setSavingEmail(false)
    }
  }

  async function handleCancelSubscription() {
    if (cancelState === 'sending') return
    if (cancelState !== 'confirming') {
      setCancelState('confirming')
      return
    }
    setCancelState('sending')
    setCancelMessage('')
    try {
      const data = await api.paymentsCancelSubscription()
      setCancelMessage(data?.message || 'Renovação automática desligada.')
      setCancelState('done')
      await refreshOverview()
    } catch (err) {
      setCancelMessage(err?.message || 'Não conseguimos desligar agora. Tente de novo ou fale com o suporte.')
      setCancelState('error')
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
          {overview.autoRenew && (
            <div style={{ marginTop: 14, borderTop: '1px solid color-mix(in oklab, var(--surface) 25%, transparent)', paddingTop: 12 }}>
              <p className="pnl-hero-sub">
                A cobrança acontece sozinha todo mês{nextChargeLabel ? `, a próxima em ${nextChargeLabel}` : ''}. Você pode desligar quando quiser.
              </p>
              {cancelState !== 'done' && (
                <button
                  type="button"
                  className="pnl-btn is-ghost"
                  style={{ marginTop: 10 }}
                  onClick={handleCancelSubscription}
                  disabled={cancelState === 'sending'}
                >
                  {cancelState === 'sending'
                    ? 'Desligando…'
                    : cancelState === 'confirming'
                      ? 'Confirmar: desligar a cobrança automática'
                      : 'Desligar cobrança automática'}
                </button>
              )}
              {cancelState === 'confirming' && (
                <p className="pnl-hero-sub" style={{ marginTop: 8 }}>
                  Seu acesso continua até {expiresAtLabel ?? 'o fim do período já pago'} — só não será cobrado de novo.
                </p>
              )}
              {cancelMessage && <p className="pnl-hero-sub" style={{ marginTop: 8 }}>{cancelMessage}</p>}
            </div>
          )}
          {/* O texto do checkout em aberto vem do backend: "pending" significa
              coisas opostas conforme já exista pagamento (quem pagou está só
              esperando a confirmação e não tem nada a fazer) — e painel e admin
              precisam dizer a MESMA coisa. */}
          {!overview.autoRenew && overview.subscription?.notice && (
            <p className="pnl-hero-sub" style={{ marginTop: 12 }}>
              {overview.subscription.notice}
            </p>
          )}
        </section>
      )}
      {/* A cobrança automática não passou. A faixa aparece ANTES dos planos:
          resolver isso é a decisão do momento, e o acesso ainda está valendo. */}
      {overview?.chargeFailure && (
        <section className="pnl-note-box is-warn" role="alert">
          <strong style={{ fontWeight: 600 }}>A cobrança automática do seu plano não passou</strong>
          <p style={{ marginTop: 6 }}>{overview.chargeFailure.motivo}</p>
          <p style={{ marginTop: 6 }}>{overview.chargeFailure.oQueFazer}</p>
          {expiresAtLabel && (
            <p style={{ marginTop: 6 }}>Seu robô continua trabalhando até {expiresAtLabel}.</p>
          )}
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

        {emailPrompt && (
          <div className="pnl-note-box is-warn" style={{ marginTop: 14 }} role="alert">
            <strong style={{ fontWeight: 600 }}>Confirme seu e-mail para a cobrança automática</strong>
            <p style={{ marginTop: 4 }}>{emailPrompt.message}</p>
            <input
              type="email"
              className="pnl-input"
              style={{ marginTop: 10, width: '100%' }}
              placeholder="seu@email.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <div className="pnl-toolbar" style={{ marginTop: 10, gap: 8 }}>
              <button type="button" className="pnl-btn is-primary" onClick={handleSaveEmailAndRetry} disabled={savingEmail || !newEmail.trim()}>
                {savingEmail ? 'Salvando…' : 'Salvar e continuar'}
              </button>
              <button type="button" className="pnl-btn is-ghost" onClick={() => { setEmailPrompt(null); setBillingMode('once') }}>
                Pagar uma vez, sem cobrança automática
              </button>
            </div>
          </div>
        )}

        <div className="pnl-presets" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: 16 }}>
          {[
            { id: 'auto', title: 'Cobrança automática', desc: 'Renova sozinho todo mês no cartão. Você desliga quando quiser.' },
            { id: 'once', title: 'Pagar uma vez', desc: '30 dias de acesso via PIX ou cartão. Você renova na mão ao acabar.' },
          ].map((option) => {
            const selected = billingMode === option.id
            return (
              <button key={option.id} type="button" className={`pnl-preset${selected ? ' is-active' : ''}`} onClick={() => setBillingMode(option.id)} aria-pressed={selected}>
                <div className="pnl-toolbar" style={{ justifyContent: 'space-between' }}>
                  <b>{option.title}</b>
                  <span className={`pnl-tag ${selected ? 'is-success' : 'is-skip'}`}>{selected ? 'Selecionado' : 'Escolher'}</span>
                </div>
                <small>{option.desc}</small>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="pnl-btn is-primary"
          style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
          onClick={() => (billingMode === 'auto' ? handleSubscribe(selectedPlanId) : handleCheckout(selectedPlanId))}
          disabled={!!checkoutPlan}
        >
          {checkoutPlan === selectedPlanId
            ? 'Aguarde…'
            : billingMode === 'auto'
              ? `Ligar cobrança automática — ${selectedPlan.name}`
              : `Pagar 30 dias — ${selectedPlan.name}`}
        </button>
        <p className="pnl-hint" style={{ textAlign: 'center', marginTop: 8 }}>
          {billingMode === 'auto'
            ? 'Cobrança automática no cartão, todo mês, sem fidelidade. Desligue quando quiser aqui mesmo.'
            : 'Pagamento único de 30 dias via PIX ou cartão. Você renova manualmente ao expirar.'}
        </p>
        {/* D4 do plano de ativação: o medo de quem para aqui é perder a
            configuração, não o preço. A frase é a MESMA do aviso de fim de
            teste (fonte única em trialNotice.js) — duas redações da mesma
            promessa é como uma delas envelhece errada. */}
        <p className="pnl-hint" style={{ textAlign: 'center', marginTop: 4 }}>
          {CONFIG_PRESERVED_NOTE}
        </p>
        {/* Só aparece para quem JÁ tem ofertas publicadas: sem uso, essa conta
            viraria promessa de volume que a gente não fez. */}
        {precoPorOferta && (
          <p className="pnl-hint" style={{ textAlign: 'center', marginTop: 4, fontWeight: 600 }}>
            {precoPorOferta.texto}
          </p>
        )}
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
