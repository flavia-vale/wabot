'use client'

import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

const DELAY_PRESETS = [
  { id: 'fast', label: 'Rápido', min: 2, max: 5 },
  { id: 'default', label: 'Padrão', min: 5, max: 15 },
  { id: 'safe', label: 'Conservador', min: 15, max: 30 },
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

  async function savePreferences() {
    setSaving(true)
    setError('')
    setSavedMessage('')
    try {
      const delayPayload = {
        delayMin: Math.trunc(Number(draft?.delayMin ?? 5)),
        delayMax: Math.trunc(Number(draft?.delayMax ?? 15)),
      }
      const saved = await api.saveConfig(delayPayload)
      setDraft(saved || { ...(draft || {}), ...delayPayload })
      setSavedMessage('Ritmo de envio salvo.')
    } catch (e) {
      setError(e.message || 'Não foi possível salvar o ritmo de envio.')
    } finally {
      setSaving(false)
    }
  }

  function applyDelayPreset(preset) {
    setDraft((current) => ({ ...(current || {}), delayMin: preset.min, delayMax: preset.max }))
  }

  const delayMin = Number(draft?.delayMin ?? 5)
  const delayMax = Number(draft?.delayMax ?? 15)
  const delayInvalid = delayMin > delayMax

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

      <div style={cfgStyles.sectionLabel}>Delay de envio</div>
      <div style={{padding:'0 16px'}}>
        <div style={{...cfgStyles.cardP, display:'grid', gap: 14}}>
          <div style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
            Tempo aleatório entre envios consecutivos. O bot aguarda entre o mínimo e o máximo antes de cada mensagem.
          </div>
          <div style={{display:'flex', gap: 8}}>
            {DELAY_PRESETS.map((preset) => {
              const isActive = draft?.delayMin === preset.min && draft?.delayMax === preset.max
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyDelayPreset(preset)}
                  style={{
                    flex: 1, padding:'8px 4px', borderRadius: 10,
                    border: isActive ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                    background: isActive ? 'var(--ink)' : 'var(--surface)',
                    color: isActive ? 'white' : 'var(--ink)',
                    fontSize: 12, fontWeight: 600, cursor:'pointer', fontFamily:'inherit',
                  }}
                >
                  {preset.label}
                  <div style={{fontSize: 10.5, opacity: 0.7, marginTop: 2}}>{preset.min}–{preset.max}s</div>
                </button>
              )
            })}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10}}>
            <label style={{display:'grid', gap: 6}}>
              <span style={cfgStyles.label}>Mínimo (segundos)</span>
              <input
                type="number"
                min={0} max={300}
                style={{...cfgStyles.field, borderColor: delayInvalid ? 'var(--danger)' : undefined}}
                value={draft?.delayMin ?? 5}
                onChange={(event) => setDraft((current) => ({ ...(current || {}), delayMin: event.target.value }))}
              />
            </label>
            <label style={{display:'grid', gap: 6}}>
              <span style={cfgStyles.label}>Máximo (segundos)</span>
              <input
                type="number"
                min={0} max={300}
                style={{...cfgStyles.field, borderColor: delayInvalid ? 'var(--danger)' : undefined}}
                value={draft?.delayMax ?? 15}
                onChange={(event) => setDraft((current) => ({ ...(current || {}), delayMax: event.target.value }))}
              />
            </label>
          </div>
          {delayInvalid && (
            <div style={{fontSize: 12, color:'var(--danger)'}}>O mínimo não pode ser maior que o máximo.</div>
          )}
        </div>
      </div>

      <div style={{padding:'18px 16px 24px', display:'grid', gap: 8}}>
        <button type="button" onClick={savePreferences} disabled={saving || delayInvalid} style={{...mobi.btn('primary', true), opacity: (saving || delayInvalid) ? 0.65 : 1}}>{saving ? 'Salvando...' : 'Salvar ritmo'}</button>
        {savedMessage && <div style={{fontSize: 12, color:'var(--success)'}}>{savedMessage}</div>}
        {error && <div style={{fontSize: 12, color:'var(--danger)'}}>{error}</div>}
      </div>
    </MobileShell>
  )
}
