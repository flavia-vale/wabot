'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const cfgStyles = {
  pageH: { padding: '18px 20px 0' },
  pageEyebrow: { fontSize: 12, color:'var(--ink-soft)' },
  pageTitle: { fontFamily:"'Instrument Serif', serif", fontStyle:'italic', fontSize: 28, lineHeight: 1.1, letterSpacing:'-0.02em', color:'var(--ink)', marginTop: 2 },
  card: { background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 18 },
  cardP: { background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 18, padding: 18 },
  cardWrap: { padding:'14px 16px 0' },
  field: {
    width:'100%', padding:'12px 14px', fontSize: 14,
    background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 12,
    fontFamily:'inherit', color:'var(--ink)',
  },
  label: { fontSize: 12, fontWeight: 600, color:'var(--ink)', marginBottom: 8 },
  row: (last) => ({
    display:'flex', alignItems:'center', gap: 12,
    padding:'14px 16px',
    borderBottom: last ? 'none' : '1px solid var(--line)',
  }),
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13.5, fontWeight: 500, color:'var(--ink)' },
  rowSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },
  toggle: (on) => ({
    width: 36, height: 20, borderRadius: 999,
    background: on ? 'var(--accent-strong)' : 'var(--bg-soft)',
    position:'relative', flexShrink: 0, cursor:'pointer',
  }),
  toggleKnob: (on) => ({
    width: 16, height: 16, borderRadius:'50%', background:'white',
    position:'absolute', top: 2, left: on ? 18 : 2,
    boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
  }),
  pill: (tone) => ({
    display:'inline-flex', alignItems:'center', gap: 5,
    fontSize: 10.5, fontWeight: 600,
    padding:'3px 8px', borderRadius: 999,
    background: tone === 'success' ? 'color-mix(in oklab, var(--success) 18%, var(--surface))'
              : tone === 'danger'  ? 'color-mix(in oklab, var(--danger) 18%, var(--surface))'
              : 'var(--bg-soft)',
    color: tone === 'success' ? 'var(--success)' : tone === 'danger' ? 'var(--danger)' : 'var(--ink)',
    border:'1px solid var(--line)',
  }),
  sectionLabel: { padding:'20px 20px 8px', fontSize: 11, fontWeight: 600, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.08em' },
  storeBadge: (color) => ({
    width: 32, height: 32, borderRadius: 8,
    background: color,
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', fontWeight: 700, fontSize: 10.5, flexShrink: 0,
  }),
};

export default function CredentialsPage() {
  useMobileRoutePerf('m/config/credentials')
  const lojas = [
    {nome:'Shopee', cor:'#EE4D2D', on:true, id:'sol_almeida_aff'},
    {nome:'Mercado Livre', cor:'#FFE600', on:true, id:'MLB-12903847'},
    {nome:'Amazon', cor:'#FF9900', on:true, id:'solalmeida-20'},
    {nome:'Magalu', cor:'#0086FF', on:true, id:'magazinevoce.com.br/solalmeida'},
    {nome:'AliExpress', cor:'#E62E04', on:false, id:''},
  ];
  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Credenciais</div>
      </div>

      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        Cole seu ID de afiliada de cada plataforma. O bot usa esses dados para reescrever os links.
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {lojas.map((l, i, a) => (
            <div key={l.nome} style={{padding:'14px 16px', borderBottom: i < a.length-1 ? '1px solid var(--line)' : 'none'}}>
              <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: l.on ? 10 : 0}}>
                <div style={cfgStyles.storeBadge(l.cor)}>{l.nome.slice(0,2).toUpperCase()}</div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={cfgStyles.rowTitle}>{l.nome}</div>
                  <div style={cfgStyles.rowSub}>
                    {l.on ? <span style={{color:'var(--success)', fontWeight: 600}}>● ativo</span> : <span>○ não conectado</span>}
                  </div>
                </div>
                {l.on
                  ? <button style={{padding:'6px 12px', borderRadius: 999, background:'transparent', border:'1px solid var(--line)', fontSize: 11.5, fontWeight: 600, color:'var(--ink-soft)', cursor:'pointer'}}>Editar</button>
                  : <button style={{padding:'6px 12px', borderRadius: 999, background:'var(--ink)', color:'white', border:'none', fontSize: 11.5, fontWeight: 600, cursor:'pointer'}}>Conectar</button>}
              </div>
              {l.on && (
                <div style={{fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5, color:'var(--ink-soft)', padding:'8px 12px', background:'var(--bg-soft)', borderRadius: 8, wordBreak:'break-all'}}>
                  {l.id}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{height: 24}}/>
    </MobileShell>
  )
}
