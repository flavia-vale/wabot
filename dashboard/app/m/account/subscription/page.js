'use client'

import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

function formatDate(value) {
  if (!value) return 'Indisponível'
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(value) {
  if (value == null) return 'Indisponível'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function SubscriptionPage() {
  useMobileRoutePerf('m/account/subscription')
  const [billing, setBilling] = useState(null)
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkoutPlan, setCheckoutPlan] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [status, billingOverview] = await Promise.all([
          api.paymentsStatus().catch(() => null),
          api.paymentsOverview().catch(() => null),
        ])
        if (!active) return
        setBilling(status || {})
        setOverview(billingOverview || null)
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar assinatura.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  async function startCheckout(plan = 'pro') {
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

  const plan = (overview?.plan || billing?.plan || 'trial').toUpperCase()
  const payments = Array.isArray(billing?.payments) ? billing.payments : []
  const lastApproved = overview?.lastApprovedPayment
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
            <span className="serif" style={{fontStyle:'italic', fontSize: 42, lineHeight: 1}}>{plan}</span>
          </div>
          <div style={{fontSize: 12, opacity:.75, marginTop: 8}}>
            {overview?.isActive ? `ativo até ${formatDate(overview.accessExpiresAt)}` : overview?.actionRequired || 'Status de acesso indisponível'}
          </div>
          <button type="button" onClick={() => startCheckout('pro')} disabled={Boolean(checkoutPlan)} style={{marginTop: 16, padding:'10px 16px', borderRadius: 999, background:'var(--accent-2)', color:'var(--ink)', border:'none', fontWeight: 600, fontSize: 13, cursor:'pointer'}}>
            {checkoutPlan ? 'Abrindo checkout...' : 'Renovar ou mudar plano'}
          </button>
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

      <div style={cfgStyles.sectionLabel}>Recuperar pagamento</div>
      <div style={{padding:'0 16px 24px'}}>
        <div style={{...cfgStyles.cardP, display:'grid', gap: 10}}>
          <p style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45}}>Se o Mercado Pago aprovou mas o acesso não atualizou, informe o ID do pagamento.</p>
          <input style={cfgStyles.field} value={paymentId} onChange={(event) => setPaymentId(event.target.value)} placeholder="ID do pagamento" />
          <button type="button" onClick={recoverPayment} style={{...mobi.btn('ghost', true)}}>Recuperar com payment_id</button>
          <a href="https://wa.me/5591999999999" style={{...mobi.btn('accent', true), textDecoration:'none'}}>Falar com suporte</a>
          {feedback && <div style={{fontSize: 12, color: feedback.includes('Não') || feedback.includes('Informe') ? 'var(--danger)' : 'var(--success)'}}>{feedback}</div>}
        </div>
      </div>
    </MobileShell>
  )
}
