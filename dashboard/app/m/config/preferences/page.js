'use client'

import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'
import { buildMobilePreferencesPayload } from '@/lib/mobileConfigContracts'

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

  async function savePreferences() {
    setSaving(true)
    setError('')
    setSavedMessage('')
    try {
      const saved = await api.saveConfig(buildMobilePreferencesPayload(draft || {}))
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

      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        Esta tela mostra apenas campos que têm contrato real no backend. Notificações por WhatsApp ainda não possuem persistência segura e foram removidas para não indicar um salvamento que o sistema ignora.
      </div>

      <div style={cfgStyles.sectionLabel}>Mensagem e marca</div>
      <div style={{padding:'0 16px'}}>
        <div style={{...cfgStyles.cardP, display:'grid', gap: 12}}>
          <label style={{display:'grid', gap: 6}}>
            <span style={cfgStyles.label}>Mensagem padrão de boas-vindas</span>
            <textarea style={{...cfgStyles.field, minHeight: 80}} value={draft?.welcomeMsg || ''} onChange={(event) => setDraft((current) => ({ ...(current || {}), welcomeMsg: event.target.value }))} />
          </label>
          <label style={{display:'grid', gap: 6}}>
            <span style={cfgStyles.label}>Texto antes do link de marca</span>
            <input style={cfgStyles.field} value={draft?.brandingCtaText || ''} onChange={(event) => setDraft((current) => ({ ...(current || {}), brandingCtaText: event.target.value }))} placeholder="Participe do grupo:" />
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
