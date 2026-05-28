'use client'

import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

export default function SubscriptionPage() {
  useMobileRoutePerf('m/account/subscription')
  const [user, setUser] = useState(null)
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [u, b] = await Promise.all([
          api.me().catch(() => null),
          api.paymentsStatus().catch(() => null),
        ])
        if (!active) return
        setUser(u || {})
        setBilling(b || {})
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar assinatura.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

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

  const plan = user?.plan?.toUpperCase() || 'FREE'
  const planPrice = user?.plan === 'pro' ? 39 : 0
  const renewDate = user?.subscriptionRenewalAt ? new Date(user.subscriptionRenewalAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''
  const groups = billing?.stats?.groupsActive || 8
  const posts = billing?.stats?.postsThisMonth || 2847
  const postLimit = user?.plan === 'pro' ? 5000 : 1000
  const stores = billing?.stats?.storesConnected || 4
  const storeLimit = 5
  const invoices = billing?.invoices || []

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Conta</div>
        <div style={cfgStyles.pageTitle}>Assinatura</div>
      </div>

      {/* Plano atual */}
      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.cardP, background:'var(--ink)', color:'white', position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', right:-40, top:-40, width: 180, height: 180, borderRadius:'50%', background:'var(--accent-strong)', filter:'blur(40px)', opacity:.5}}/>
          <div style={{position:'relative'}}>
            <div style={{fontSize: 11, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.6)'}}>Plano atual</div>
            <div style={{display:'flex', alignItems:'baseline', gap: 8, marginTop: 8}}>
              <span className="serif" style={{fontStyle:'italic', fontSize: 42, lineHeight: 1}}>{plan}</span>
              {planPrice > 0 && <span style={{opacity:.7, fontSize: 13}}>R$ {planPrice}/mês</span>}
            </div>
            {renewDate && <div style={{fontSize: 12, opacity:.7, marginTop: 8}}>renova em {renewDate}</div>}
            <button style={{marginTop: 16, padding:'10px 16px', borderRadius: 999, background:'var(--accent-2)', color:'var(--ink)', border:'none', fontWeight: 600, fontSize: 13, cursor:'pointer'}}>Mudar plano</button>
          </div>
        </div>
      </div>

      {/* Uso */}
      <div style={cfgStyles.sectionLabel}>Uso este mês</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          {[
            {l:'Grupos ativos', n: groups, m:'∞ ilimitados'},
            {l:'Posts no mês', n: posts, m: `de ${postLimit}`},
            {l:'Lojas conectadas', n: stores, m: `de ${storeLimit}`},
          ].map((s, i, a) => (
            <div key={s.l} style={cfgStyles.row(i === a.length-1)}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>{s.l}</div>
                <div style={cfgStyles.rowSub}>{s.m}</div>
              </div>
              <div className="serif" style={{fontStyle:'italic', fontSize: 22, color:'var(--ink)', lineHeight: 1}}>{s.n}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Faturas */}
      {invoices.length > 0 && (
        <>
          <div style={cfgStyles.sectionLabel}>Últimas faturas</div>
          <div style={{padding:'0 16px'}}>
            <div style={cfgStyles.card}>
              {invoices.slice(0, 3).map((f, i, a) => (
                <div key={f.id} style={cfgStyles.row(i === a.length-1)}>
                  <div style={cfgStyles.rowMain}>
                    <div style={cfgStyles.rowTitle}>{new Date(f.createdAt).toLocaleDateString('pt-BR')}</div>
                    <div style={cfgStyles.rowSub}>R$ {(f.amount / 100).toFixed(2)}</div>
                  </div>
                  <span style={cfgStyles.pill(f.status === 'paid' ? 'success' : 'warn')}>{f.status === 'paid' ? 'paga' : 'pendente'}</span>
                  <MobileIcon name="arrow" size={14}/>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Pagamento */}
      {billing?.paymentMethod && (
        <>
          <div style={cfgStyles.sectionLabel}>Forma de pagamento</div>
          <div style={{padding:'0 16px 24px'}}>
            <div style={cfgStyles.card}>
              <div style={cfgStyles.row(true)}>
                <div style={{width: 44, height: 30, borderRadius: 6, background:'linear-gradient(135deg,#1A1F71,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize: 10, fontWeight: 700}}>
                  {billing.paymentMethod.brand?.toUpperCase() || 'CARD'}
                </div>
                <div style={cfgStyles.rowMain}>
                  <div style={cfgStyles.rowTitle}>•••• {billing.paymentMethod.last4}</div>
                  <div style={cfgStyles.rowSub}>vence {billing.paymentMethod.expiryMonth}/{billing.paymentMethod.expiryYear}</div>
                </div>
                <button style={{padding:'6px 12px', borderRadius: 999, background:'transparent', border:'1px solid var(--line)', fontSize: 11.5, fontWeight: 600, color:'var(--ink)', cursor:'pointer'}}>Trocar</button>
              </div>
            </div>
          </div>
        </>
      )}
    </MobileShell>
  )
}
