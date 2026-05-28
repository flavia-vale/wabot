'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'


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
