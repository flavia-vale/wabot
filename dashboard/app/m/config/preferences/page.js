'use client'

import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

const preferenceItems = [
  { key: 'notifyNewSale', label: 'Toda nova venda confirmada', sub: 'aviso no WhatsApp privado', defaultValue: true },
  { key: 'notifyDailySummary', label: 'Resumo diário', sub: 'top do dia e comissões', defaultValue: true },
  { key: 'notifyDisconnect', label: 'Bot desconectado', sub: 'alerta urgente', defaultValue: true },
  { key: 'notifyPostLimit', label: 'Limite de posts próximo', sub: 'aviso aos 90%', defaultValue: false },
  { key: 'notifyNews', label: 'Novidades do produto', sub: 'no máximo 1× por mês', defaultValue: false },
]

export default function PreferencesPage() {
  useMobileRoutePerf('m/config/preferences')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const config = await api.getConfig()
        if (active) setDraft(config || {})
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar preferências.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  function toggle(key, fallback) {
    setSavedMessage('')
    setDraft((current) => ({ ...(current || {}), [key]: !(current?.[key] ?? fallback) }))
  }

  async function savePreferences() {
    setSaving(true)
    setError('')
    setSavedMessage('')
    try {
      const saved = await api.saveConfig(draft || {})
      setDraft(saved || draft || {})
      setSavedMessage('Preferências salvas no backoffice.')
    } catch (e) {
      setError(e.message || 'Não foi possível salvar preferências.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando preferências..." /></div>
      </MobileShell>
    )
  }
  if (error && !draft) {
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

      <div style={cfgStyles.sectionLabel}>Notificações no WhatsApp</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          {preferenceItems.map((item, index) => {
            const on = draft?.[item.key] ?? item.defaultValue
            return (
              <button key={item.key} type="button" onClick={() => toggle(item.key, item.defaultValue)} style={cfgStyles.rowButton(index === preferenceItems.length - 1)}>
                <div style={cfgStyles.rowMain}>
                  <div style={cfgStyles.rowTitle}>{item.label}</div>
                  <div style={cfgStyles.rowSub}>{item.sub}</div>
                </div>
                <div style={cfgStyles.toggle(on)}><div style={cfgStyles.toggleKnob(on)}/></div>
              </button>
            )
          })}
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Mensagem e marca</div>
      <div style={{padding:'0 16px'}}>
        <div style={{...cfgStyles.cardP, display:'grid', gap: 12}}>
          <label style={{display:'grid', gap: 6}}>
            <span style={cfgStyles.label}>Mensagem padrão de boas-vindas</span>
            <textarea style={{...cfgStyles.field, minHeight: 80}} value={draft?.welcomeMsg || ''} onChange={(event) => setDraft((current) => ({ ...(current || {}), welcomeMsg: event.target.value }))} />
          </label>
          <label style={{display:'grid', gap: 6}}>
            <span style={cfgStyles.label}>Link do grupo principal</span>
            <input style={cfgStyles.field} value={draft?.brandingGroupLink || ''} onChange={(event) => setDraft((current) => ({ ...(current || {}), brandingGroupLink: event.target.value }))} placeholder="https://chat.whatsapp.com/..." />
          </label>
        </div>
      </div>

      <div style={{padding:'18px 16px 24px', display:'grid', gap: 8}}>
        <button type="button" onClick={savePreferences} disabled={saving} style={{...mobi.btn('primary', true), opacity: saving ? 0.65 : 1}}>{saving ? 'Salvando...' : 'Salvar preferências'}</button>
        {savedMessage && <div style={{fontSize: 12, color:'var(--success)'}}>{savedMessage}</div>}
        {error && <div style={{fontSize: 12, color:'var(--danger)'}}>{error}</div>}
      </div>
    </MobileShell>
  )
}
