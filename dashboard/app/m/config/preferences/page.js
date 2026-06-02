'use client'

import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'
import { buildMobilePreferencesPayload } from '@/lib/mobileConfigContracts'

const DELAY_PRESETS = [
  { id: 'fast', label: 'Rápido', min: 2, max: 5 },
  { id: 'default', label: 'Padrão', min: 5, max: 15 },
  { id: 'safe', label: 'Conservador', min: 15, max: 30 },
]

const PLATFORM_OPTIONS = [
  { id: 'shopee', label: 'Shopee' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'mercadolivre', label: 'Mercado Livre' },
  { id: 'magazineluiza', label: 'Magalu' },
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
      const saved = await api.saveConfig(buildMobilePreferencesPayload(draft || {}))
      setDraft(saved || draft || {})
      setSavedMessage('Preferências salvas no backoffice.')
    } catch (e) {
      setError(e.message || 'Não foi possível salvar preferências.')
    } finally {
      setSaving(false)
    }
  }

  function applyDelayPreset(preset) {
    setDraft((current) => ({ ...(current || {}), delayMin: preset.min, delayMax: preset.max }))
  }

  function togglePlatform(platformId) {
    setDraft((current) => {
      const list = Array.isArray(current?.platforms) ? current.platforms : []
      const next = list.includes(platformId) ? list.filter((id) => id !== platformId) : [...list, platformId]
      return { ...(current || {}), platforms: next }
    })
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

      <div style={cfgStyles.sectionLabel}>Lojas e destinos globais</div>
      <div style={{padding:'0 16px'}}>
        <div style={{...cfgStyles.cardP, display:'grid', gap: 14}}>
          <div style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
            Mesmo contrato usado no desktop: escolha as plataformas aceitas pelo espelhamento e se o bot publica no feed/status quando o backend permitir.
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8}}>
            {PLATFORM_OPTIONS.map((platform) => {
              const checked = Array.isArray(draft?.platforms) && draft.platforms.includes(platform.id)
              return (
                <label key={platform.id} style={{display:'flex', alignItems:'center', gap: 8, fontSize: 13, color:'var(--ink)', cursor:'pointer'}}>
                  <input type="checkbox" checked={checked} onChange={() => togglePlatform(platform.id)} style={{width: 17, height: 17}} />
                  {platform.label}
                </label>
              )
            })}
          </div>
          <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap: 12}}>
            <span>
              <span style={{display:'block', fontSize: 13, fontWeight: 650, color:'var(--ink)'}}>Feed global</span>
              <span style={{display:'block', fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>Replica para o feed global quando estiver habilitado no backend.</span>
            </span>
            <button type="button" role="switch" aria-checked={!!draft?.feedGlobal} onClick={() => setDraft((current) => ({ ...(current || {}), feedGlobal: !current?.feedGlobal }))} style={cfgStyles.toggle(!!draft?.feedGlobal)}>
              <div style={cfgStyles.toggleKnob(!!draft?.feedGlobal)} />
            </button>
          </label>
          <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap: 12}}>
            <span>
              <span style={{display:'block', fontSize: 13, fontWeight: 650, color:'var(--ink)'}}>Postar no Status</span>
              <span style={{display:'block', fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>Mantém paridade com o toggle do dashboard desktop.</span>
            </span>
            <button type="button" role="switch" aria-checked={!!draft?.postToStatus} onClick={() => setDraft((current) => ({ ...(current || {}), postToStatus: !current?.postToStatus }))} style={cfgStyles.toggle(!!draft?.postToStatus)}>
              <div style={cfgStyles.toggleKnob(!!draft?.postToStatus)} />
            </button>
          </label>
        </div>
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

      <div style={cfgStyles.sectionLabel}>Palavras bloqueadas</div>
      <div style={{padding:'0 16px'}}>
        <div style={{...cfgStyles.cardP, display:'grid', gap: 10}}>
          <div style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
            Mensagens que contêm essas palavras serão ignoradas pelo bot. Separe por vírgula.
          </div>
          <label style={{display:'grid', gap: 6}}>
            <span style={cfgStyles.label}>Palavras bloqueadas</span>
            <textarea
              style={{...cfgStyles.field, minHeight: 72}}
              value={draft?.blockedKeywords || ''}
              onChange={(event) => setDraft((current) => ({ ...(current || {}), blockedKeywords: event.target.value }))}
              placeholder="proibido, spam, casino"
            />
          </label>
          <div style={{fontSize: 11, color:'var(--ink-soft)'}}>Separe por vírgula. Maiúsculas e espaços são normalizados ao salvar.</div>
        </div>
      </div>

      <div style={{padding:'18px 16px 24px', display:'grid', gap: 8}}>
        <button type="button" onClick={savePreferences} disabled={saving || delayInvalid} style={{...mobi.btn('primary', true), opacity: (saving || delayInvalid) ? 0.65 : 1}}>{saving ? 'Salvando...' : 'Salvar preferências'}</button>
        {savedMessage && <div style={{fontSize: 12, color:'var(--success)'}}>{savedMessage}</div>}
        {error && <div style={{fontSize: 12, color:'var(--danger)'}}>{error}</div>}
      </div>
    </MobileShell>
  )
}
