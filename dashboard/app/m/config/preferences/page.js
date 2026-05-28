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

export default function PreferencesPage() {
  useMobileRoutePerf('m/config/preferences')

  const items = [
    {label:'Toda nova venda confirmada', sub:'WhatsApp privado', on:true},
    {label:'Resumo diário às 22h', sub:'top do dia, comissões', on:true},
    {label:'Bot desconectado', sub:'alerta urgente', on:true},
    {label:'Limite de posts próximo', sub:'aviso aos 90%', on:false},
    {label:'Novidades do produto', sub:'no máximo 1× por mês', on:false},
  ];

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Preferências</div>
      </div>

      <div style={cfgStyles.sectionLabel}>Aparência</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          <div style={cfgStyles.row()}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Tema</div>
              <div style={cfgStyles.rowSub}>seguindo o sistema</div>
            </div>
            <span style={{fontSize: 13, color:'var(--ink-soft)'}}>Auto ›</span>
          </div>
          <div style={cfgStyles.row()}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Idioma</div>
            </div>
            <span style={{fontSize: 13, color:'var(--ink-soft)'}}>Português BR ›</span>
          </div>
          <div style={cfgStyles.row(true)}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Fuso horário</div>
            </div>
            <span style={{fontSize: 13, color:'var(--ink-soft)'}}>GMT-3 ›</span>
          </div>
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Notificações no WhatsApp</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          {items.map((n, i, a) => (
            <div key={i} style={cfgStyles.row(i === a.length-1)}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>{n.label}</div>
                <div style={cfgStyles.rowSub}>{n.sub}</div>
              </div>
              <div style={cfgStyles.toggle(n.on)}><div style={cfgStyles.toggleKnob(n.on)}/></div>
            </div>
          ))}
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Conta</div>
      <div style={{padding:'0 16px 24px'}}>
        <div style={cfgStyles.card}>
          <div style={cfgStyles.row()}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Senha</div>
              <div style={cfgStyles.rowSub}>alterada há 23 dias</div>
            </div>
            <span style={{fontSize: 13, color:'var(--ink-soft)'}}>›</span>
          </div>
          <div style={cfgStyles.row(true)}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Verificação em 2 etapas</div>
              <div style={cfgStyles.rowSub}>SMS para login novo</div>
            </div>
            <span style={cfgStyles.pill('success')}>● ativada</span>
          </div>
        </div>
      </div>
    </MobileShell>
  )
}
