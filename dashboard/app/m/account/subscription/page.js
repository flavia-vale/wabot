'use client'

import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles, tint } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'
import { PIX_KEY, SUPPORT_WA_NUMBER, SUPPORT_PHONE_LABEL, buildPixWaLink } from '@/lib/mobilePixUtils'
import { DEFAULT_LANDING_PLANS } from '@/lib/marketing-content'

function formatDate(value) {
  if (!value) return 'Indisponível'
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(value) {
  if (value == null) return 'Indisponível'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

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
    }
  })
}

export default function SubscriptionPage() {
  useMobileRoutePerf('m/account/subscription')
  const [billing, setBilling] = useState(null)
  const [overview, setOverview] = useState(null)
  const [me, setMe] = useState(null)
  const [plans, setPlans] = useState(FALLBACK_PLAN_CARDS)
  const [selectedPlanId, setSelectedPlanId] = useState('pro')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkoutPlan, setCheckoutPlan] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pixCopied, setPixCopied] = useState(false)
  const [pixFallback, setPixFallback] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [status, billingOverview, meData, plansData] = await Promise.all([
          api.paymentsStatus().catch(() => null),
          api.paymentsOverview().catch(() => null),
          api.me().catch(() => null),
          api.publicPlans().catch(() => null),
        ])
        if (!active) return
        setBilling(status || {})
        setOverview(billingOverview || null)
        setMe(meData || null)
        setPlans(mergePlanCards(Array.isArray(plansData?.plans) ? plansData.plans : []))
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar assinatura.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  async function startCheckout(plan = selectedPlanId) {
    setCheckoutPlan(plan)
    setFeedback('')
    try {
      const data = await api.paymentsCheckout(plan)
      const checkoutUrl = data?.checkout_url || data?.checkoutUrl || data?.init_point
      if (!checkoutUrl) throw new Error('Checkout indisponível. Fale com o suporte para receber o link de pagamento.')
      window.location.assign(checkoutUrl)
    } catch (err) {
      setFeedback(err.message || 'Não foi possível iniciar o checkout.')
      setCheckoutPlan('')
    }
  }

  async function recoverPayment() {
    if (!paymentId.trim()) {
      setFeedback('Informe o ID do pagamento para recuperar.')
      return
    }
    setFeedback('')
    try {
      const result = await api.paymentsRecover(paymentId.trim())
      setFeedback(result?.alreadyApplied ? 'Pagamento já estava aplicado.' : 'Pagamento recuperado. Atualize a tela em alguns instantes.')
    } catch (err) {
      setFeedback(err.message || 'Não foi possível recuperar o pagamento.')
    }
  }

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando assinatura..." /></div>
      </MobileShell>
    )
  }
  if (error) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div>
      </MobileShell>
    )
  }

  const userEmail = me?.email || ''
  const plan = (overview?.plan || billing?.plan || 'trial').toUpperCase()
  const payments = Array.isArray(billing?.payments) ? billing.payments : []
  const lastApproved = overview?.lastApprovedPayment
  const selectedPlan = plans.find((item) => item.id === selectedPlanId) || plans[0] || FALLBACK_PLAN_CARDS[0]
  const usageRows = [
    { l: 'Grupos ativos', n: billing?.stats?.groupsActive ?? 'Indisponível', m: billing?.stats ? 'dados do backoffice' : 'sem métrica disponível' },
    { l: 'Posts no mês', n: billing?.stats?.postsThisMonth ?? 'Indisponível', m: billing?.stats?.postLimit ? `de ${billing.stats.postLimit}` : 'sem limite informado' },
    { l: 'Lojas conectadas', n: billing?.stats?.storesConnected ?? 'Indisponível', m: 'credenciais configuradas' },
  ]

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Conta</div>
        <div style={cfgStyles.pageTitle}>Assinatura</div>
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.cardP, background:'var(--ink)', color:'white', position:'relative', overflow:'hidden'}}>
          <div style={{fontSize: 11, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.6)'}}>Plano atual</div>
          <div style={{display:'flex', alignItems:'baseline', gap: 8, marginTop: 8}}>
            <span style={{fontFamily: "'Instrument Serif', serif", fontStyle:'italic', fontSize: 42, lineHeight: 1}}>{plan}</span>
          </div>
          <div style={{fontSize: 12, opacity:.75, marginTop: 8}}>
            {overview?.isActive ? `ativo até ${formatDate(overview.accessExpiresAt)}` : overview?.actionRequired || 'Status de acesso indisponível'}
          </div>
          <button type="button" onClick={() => startCheckout(selectedPlanId)} disabled={Boolean(checkoutPlan)} style={{marginTop: 16, padding:'10px 16px', borderRadius: 999, background:'var(--accent-2)', color:'var(--ink)', border:'none', fontWeight: 600, fontSize: 13, cursor:'pointer'}}>
            {checkoutPlan ? 'Abrindo checkout...' : `Renovar ${selectedPlan?.name || 'plano'}`}
          </button>
        </div>
      </div>


      <div style={cfgStyles.sectionLabel}>Escolher plano</div>
      <div style={{padding:'0 16px'}}>
        <div style={{display:'grid', gap: 10}}>
          {plans.map((item) => {
            const selected = item.id === selectedPlanId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedPlanId(item.id)}
                aria-pressed={selected}
                style={{
                  ...cfgStyles.cardP,
                  textAlign:'left',
                  border: selected ? '1.5px solid var(--accent-strong)' : '1px solid var(--line)',
                  background: selected ? tint('--accent-2', 30) : 'var(--surface)',
                  cursor:'pointer',
                  fontFamily:'inherit',
                }}
              >
                <div style={{display:'flex', justifyContent:'space-between', gap: 12, alignItems:'flex-start'}}>
                  <div>
                    <div style={{fontSize: 15, fontWeight: 800, color:'var(--ink)'}}>{item.name}</div>
                    <div style={{fontSize: 26, fontWeight: 900, color:'var(--accent-strong)', marginTop: 4}}>{item.price}<span style={{fontSize: 11, color:'var(--ink-soft)', fontWeight: 600}}> /30 dias</span></div>
                  </div>
                  <span style={cfgStyles.pill(selected ? 'success' : 'neutral')}>{selected ? 'selecionado' : 'escolher'}</span>
                </div>
                <div style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45, marginTop: 8}}>{item.description}</div>
                {Array.isArray(item.features) && item.features.length > 0 && (
                  <div style={{display:'grid', gap: 5, marginTop: 10}}>
                    {item.features.slice(0, 4).map((feature) => (
                      <div key={feature} style={{fontSize: 11.5, color:'var(--ink)', lineHeight: 1.35}}>✓ {feature}</div>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Uso este mês</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          {usageRows.map((row, index) => (
            <div key={row.l} style={cfgStyles.row(index === usageRows.length - 1)}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>{row.l}</div>
                <div style={cfgStyles.rowSub}>{row.m}</div>
              </div>
              <div style={{fontSize: 18, color:'var(--ink)', lineHeight: 1, fontWeight: 700}}>{row.n}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Últimos pagamentos</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          {payments.length === 0 && !lastApproved ? (
            <div style={{padding: 16, fontSize: 12, color:'var(--ink-soft)'}}>Indisponível — nenhum pagamento encontrado no backoffice.</div>
          ) : payments.slice(0, 3).map((payment, index) => (
            <div key={payment.id || payment.mpPaymentId} style={cfgStyles.row(index === Math.min(payments.length, 3) - 1)}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>{formatDate(payment.createdAt)}</div>
                <div style={cfgStyles.rowSub}>{formatMoney(payment.amount)} · {payment.status}</div>
              </div>
              <span style={cfgStyles.pill(payment.status === 'approved' ? 'success' : 'warn')}>{payment.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Pagar via PIX</div>
      <div style={{padding:'0 16px'}}>
        <div style={{...cfgStyles.cardP, display:'grid', gap: 12}}>
          <p style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45}}>Prefere pagar por PIX? Copie a chave abaixo, faça o pagamento e envie o comprovante no WhatsApp para ativar sua conta.</p>
          <div style={{display:'flex', alignItems:'center', gap: 10}}>
            <code style={{flex: 1, fontFamily:"'JetBrains Mono', monospace", fontSize: 12, color:'var(--ink)', background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 8, padding:'10px 12px', wordBreak:'break-all'}}>{PIX_KEY}</code>
          </div>
          {pixFallback && (
            <div style={{display:'grid', gap: 6}}>
              <input readOnly style={{...cfgStyles.field, fontFamily:"'JetBrains Mono', monospace", fontSize: 12}} value={PIX_KEY} onFocus={(event) => event.target.select()} />
              <div style={{fontSize: 11.5, color:'var(--ink-soft)'}}>Selecione o campo acima e copie manualmente.</div>
            </div>
          )}
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(PIX_KEY)
                setPixCopied(true)
                window.setTimeout(() => setPixCopied(false), 2500)
              } catch {
                setPixFallback(true)
              }
            }}
            style={{...mobi.btn('ghost', true)}}
          >
            {pixCopied ? 'Chave copiada!' : 'Copiar chave PIX'}
          </button>
          <a
            href={buildPixWaLink(
              selectedPlan?.name || 'Plano Pro',
              selectedPlan?.price || (lastApproved?.amount != null ? formatMoney(lastApproved.amount) : 'R$ —'),
              userEmail,
            )}
            target="_blank"
            rel="noreferrer"
            style={{...mobi.btn('accent', true), textDecoration:'none'}}
          >
            Enviar comprovante no WhatsApp
          </a>
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Recuperar pagamento</div>
      <div style={{padding:'0 16px 24px'}}>
        <div style={{...cfgStyles.cardP, display:'grid', gap: 10}}>
          <p style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45}}>Se o Mercado Pago aprovou mas o acesso não atualizou, informe o ID do pagamento.</p>
          <input style={cfgStyles.field} value={paymentId} onChange={(event) => setPaymentId(event.target.value)} placeholder="ID do pagamento" />
          <button type="button" onClick={recoverPayment} style={{...mobi.btn('ghost', true)}}>Recuperar com payment_id</button>
          <a href={`https://wa.me/${SUPPORT_WA_NUMBER}`} style={{...mobi.btn('accent', true), textDecoration:'none'}}>Falar com suporte ({SUPPORT_PHONE_LABEL})</a>
          {feedback && <div style={{fontSize: 12, color: feedback.includes('Não') || feedback.includes('Informe') ? 'var(--danger)' : 'var(--success)'}}>{feedback}</div>}
        </div>
      </div>
    </MobileShell>
  )
}
