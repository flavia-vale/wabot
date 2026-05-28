'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'


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
