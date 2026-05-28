'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

export default function SubscriptionPage() {
  useMobileRoutePerf('m/account/subscription')

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
              <span className="serif" style={{fontStyle:'italic', fontSize: 42, lineHeight: 1}}>Pro</span>
              <span style={{opacity:.7, fontSize: 13}}>R$ 39/mês</span>
            </div>
            <div style={{fontSize: 12, opacity:.7, marginTop: 8}}>renova em 14 jun · cartão final 4242</div>
            <button style={{marginTop: 16, padding:'10px 16px', borderRadius: 999, background:'var(--accent-2)', color:'var(--ink)', border:'none', fontWeight: 600, fontSize: 13, cursor:'pointer'}}>Mudar plano</button>
          </div>
        </div>
      </div>

      {/* Uso */}
      <div style={cfgStyles.sectionLabel}>Uso este mês</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          {[
            {l:'Grupos ativos', n:'8', m:'∞ ilimitados'},
            {l:'Posts no mês', n:'2.847', m:'de 5.000'},
            {l:'Lojas conectadas', n:'4', m:'de 5'},
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
      <div style={cfgStyles.sectionLabel}>Últimas faturas</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          {[
            {d:'14 abr 2026', v:'R$ 39,00'},
            {d:'14 mar 2026', v:'R$ 39,00'},
            {d:'14 fev 2026', v:'R$ 39,00'},
          ].map((f, i, a) => (
            <div key={f.d} style={cfgStyles.row(i === a.length-1)}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>{f.d}</div>
                <div style={cfgStyles.rowSub}>{f.v}</div>
              </div>
              <span style={cfgStyles.pill('success')}>paga</span>
              <MobileIcon name="arrow" size={14}/>
            </div>
          ))}
        </div>
      </div>

      {/* Pagamento */}
      <div style={cfgStyles.sectionLabel}>Forma de pagamento</div>
      <div style={{padding:'0 16px 24px'}}>
        <div style={cfgStyles.card}>
          <div style={cfgStyles.row(true)}>
            <div style={{width: 44, height: 30, borderRadius: 6, background:'linear-gradient(135deg,#1A1F71,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize: 10, fontWeight: 700}}>VISA</div>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>•••• 4242</div>
              <div style={cfgStyles.rowSub}>vence 08/28</div>
            </div>
            <button style={{padding:'6px 12px', borderRadius: 999, background:'transparent', border:'1px solid var(--line)', fontSize: 11.5, fontWeight: 600, color:'var(--ink)', cursor:'pointer'}}>Trocar</button>
          </div>
        </div>
      </div>
    </MobileShell>
  )
}
