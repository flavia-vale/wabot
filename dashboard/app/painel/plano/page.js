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

const PLAN_PRESENTATION = {
  basic: {
    eyebrow: 'Para começar',
    features: [
      'Espelhamento de grupos',
      'Conversão de links de 6 lojas (Shopee, Mercado Livre, Amazon, SHEIN, Magalu e AliExpress)',
      'Card de oferta clicável',
      'Mensagem reescrita do seu jeito',
      'Envio imediato ou agendado',
      'Relatórios com histórico completo',
    ],
  },
  pro: {
    eyebrow: 'Mais completo',
    featured: true,
    features: [
      'Tudo do plano BASIC',
      'Espelhamento de grupos e CANAIS do WhatsApp',
      'Garimpo automático de ofertas',
      'Filas de ofertas',
      'Sua marca d’água nas ofertas',
      'Horário de descanso, máximo de ofertas por dia, intervalo entre mensagens e variação do texto',
      'Painel de vendas e comissão da Shopee',
    ],
  },
}

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
  usePainelHeader({ title: 'Planos', subtitle: 'Escolha o plano que combina com a sua rotina' })

  const [plans, setPlans] = useState(FALLBACK_PLAN_CARDS)
  const [overview, setOverview] = useState(null)
  const [checkoutPlan, setCheckoutPlan] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
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

  // D5 do plano de ativação de 2026-09-08: o mesmo preço, medido no uso REAL
  // dela. "R$ 69" é um número solto; "R$ 1,47 por oferta publicada" é a conta
  // que ela consegue refazer sozinha, com o número que é dela.
  const { offersPublished } = usePainel()
  const precosPorOferta = useMemo(() => Object.fromEntries(plans.map((plan) => [
    plan.id,
    buildPricePerOffer({ priceCents: parsePriceToCents(plan.price), offersPublished }),
  ])), [plans, offersPublished])

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
      const plan = emailPrompt?.plan ?? 'pro'
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
    <div className="pnl-grid" style={{ maxWidth: 940, margin: '0 auto' }}>
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

      {/* Já no Básico, com canal/automática/fila configurados: isso está
          parado. Antes deste aviso a cliente pagava e descobria pelo canal
          sem receber nada (RCA 2026-09-23). */}
      {overview?.proFeaturesNotice?.kind === 'stopped' && (
        <section className="pnl-note-box is-warn" role="alert">
          <strong style={{ fontWeight: 600 }}>{overview.proFeaturesNotice.title}</strong>
          <p style={{ marginTop: 6 }}>{overview.proFeaturesNotice.body}</p>
          <p style={{ marginTop: 6, fontWeight: 600 }}>{overview.proFeaturesNotice.action}</p>
        </section>
      )}

      {/* Planos */}
      <section>
        <div style={{ marginBottom: 22 }}>
          <div className="pnl-card-title" style={{ marginBottom: 6 }}>{overview?.isActive ? 'Renove ou troque seu plano' : 'Escolha seu plano'}</div>
          <p className="pnl-card-note">Dois planos simples, sem fidelidade. Cancele a cobrança automática quando quiser.</p>
        </div>
        <div className="grid items-stretch gap-5 md:grid-cols-2">
          {plans.map((plan) => {
            const presentation = PLAN_PRESENTATION[plan.id] ?? PLAN_PRESENTATION.basic
            const precoPorOferta = precosPorOferta[plan.id]
            return (
              <article
                key={plan.id}
                className={`flex h-full flex-col rounded-[24px] border bg-white p-6 shadow-[0_12px_36px_rgba(26,64,52,0.07)] sm:p-7 ${presentation.featured ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{presentation.eyebrow}</p>
                  {presentation.featured && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Mais escolhido</span>}
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">{plan.id.toUpperCase()}</h2>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-4xl font-black tracking-tight text-slate-950">{plan.price}</span>
                  <span className="pb-1 text-sm text-slate-500">/ 30 dias</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">{plan.description}</p>

                <ul className="mt-6 flex-1 space-y-3.5">
                  {presentation.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm leading-5 text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700" aria-hidden="true">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {precoPorOferta && (
                  <p className="mt-5 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                    {precoPorOferta.texto}
                  </p>
                )}

                {/* O teste grátis libera tudo do Pro. Sem este aviso, quem usa
                    canal, automática ou fila escolhia o Básico e isso parava em
                    silêncio logo depois de pagar (RCA 2026-09-23). O aviso fica
                    NO card, colado aos botões: é ali que a decisão acontece. */}
                {plan.id === 'basic' && overview?.proFeaturesNotice?.kind === 'before_choosing' && (
                  <div className="mt-5 pnl-note-box is-warn" role="note">
                    <strong style={{ fontWeight: 600 }}>{overview.proFeaturesNotice.title}</strong>
                    <p style={{ marginTop: 4 }}>{overview.proFeaturesNotice.body}</p>
                    <p style={{ marginTop: 4, fontWeight: 600 }}>{overview.proFeaturesNotice.action}</p>
                  </div>
                )}

                <div className="mt-6 grid gap-2.5">
                  <button
                    type="button"
                    className="pnl-btn is-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!checkoutPlan}
                  >
                    {checkoutPlan === plan.id ? 'Aguarde…' : 'Cobrança automática'}
                  </button>
                  <button
                    type="button"
                    className="pnl-btn is-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => handleCheckout(plan.id)}
                    disabled={!!checkoutPlan}
                  >
                    {checkoutPlan === plan.id ? 'Aguarde…' : 'Pagar uma vez'}
                  </button>
                </div>
                <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                  PIX ou cartão · acesso por 30 dias
                </p>
              </article>
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
              <button type="button" className="pnl-btn is-ghost" onClick={() => { const plan = emailPrompt.plan; setEmailPrompt(null); handleCheckout(plan) }}>
                Pagar uma vez, sem cobrança automática
              </button>
            </div>
          </div>
        )}

        {/* D4 do plano de ativação: o medo de quem para aqui é perder a
            configuração, não o preço. A frase é a MESMA do aviso de fim de
            teste (fonte única em trialNotice.js) — duas redações da mesma
            promessa é como uma delas envelhece errada. */}
        <p className="pnl-hint" style={{ textAlign: 'center', marginTop: 4 }}>
          {CONFIG_PRESERVED_NOTE}
        </p>
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
