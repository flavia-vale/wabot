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

export default function WhatsAppPage() {
  useMobileRoutePerf('m/config/whatsapp')
  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Conexão WhatsApp</div>
      </div>

      {/* Status conectado */}
      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.cardP, background:'color-mix(in oklab, var(--success) 12%, var(--surface))', border:'1px solid color-mix(in oklab, var(--success) 30%, var(--line))'}}>
          <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: 14}}>
            <div style={{width: 40, height: 40, borderRadius: 12, background:'var(--success)', display:'flex', alignItems:'center', justifyContent:'center', color:'white'}}>
              <MobileIcon name="check" size={20} stroke={3}/>
            </div>
            <div style={{flex: 1}}>
              <div style={{fontSize: 14, fontWeight: 600, color:'var(--ink)'}}>WhatsApp conectado</div>
              <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>+55 11 9 8765-4321 · 47 dias ativos</div>
            </div>
          </div>
          <div style={{display:'flex', gap: 8}}>
            <button style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5, padding:'10px 14px'}}>Sincronizar</button>
            <button style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5, padding:'10px 14px', color:'var(--danger)'}}>Desconectar</button>
          </div>
        </div>
      </div>

      {/* Limites */}
      <div style={cfgStyles.sectionLabel}>Limites e cadência</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          <div style={cfgStyles.row()}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Posts hoje</div>
              <div style={cfgStyles.rowSub}>127 de 250 · 51% do limite</div>
              <div style={{height: 5, background:'var(--bg-soft)', borderRadius: 999, marginTop: 8, overflow:'hidden'}}>
                <div style={{width:'51%', height:'100%', background:'var(--accent-strong)'}}/>
              </div>
            </div>
          </div>
          <div style={cfgStyles.row()}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Tempo mínimo entre posts</div>
              <div style={cfgStyles.rowSub}>recomendado para evitar bloqueios</div>
            </div>
            <div style={{fontSize: 13, fontWeight: 600, color:'var(--ink)'}}>45 s</div>
          </div>
          <div style={cfgStyles.row(true)}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Modo soneca · 23h–7h</div>
              <div style={cfgStyles.rowSub}>bot não posta no período noturno</div>
            </div>
            <div style={cfgStyles.toggle(true)}><div style={cfgStyles.toggleKnob(true)}/></div>
          </div>
        </div>
      </div>

      <div style={{height: 24}}/>
    </MobileShell>
  )
}
