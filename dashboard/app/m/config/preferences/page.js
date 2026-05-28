'use client'

import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'


export default function PreferencesPage() {
  useMobileRoutePerf('m/config/preferences')
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const c = await api.getConfig().catch(() => null)
        if (!active) return
        setConfig(c || {})
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar preferências.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const items = [
    {label:'Toda nova venda confirmada', sub:'WhatsApp privado', on: config?.notifyNewSale !== false},
    {label:'Resumo diário às 22h', sub:'top do dia, comissões', on: config?.notifyDailySummary !== false},
    {label:'Bot desconectado', sub:'alerta urgente', on: config?.notifyDisconnect !== false},
    {label:'Limite de posts próximo', sub:'aviso aos 90%', on: config?.notifyPostLimit === true},
    {label:'Novidades do produto', sub:'no máximo 1× por mês', on: config?.notifyNews === true},
  ];

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando preferências..." /></div>
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
