'use client'

import { useEffect, useMemo, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileCredentialPlatforms, credentialSummary, isCredentialComplete } from '@/components/mobile/mobileCredentialPlatforms'
import { api } from '@/lib/api'

function MlOAuthSection({ credentialData }) {
  const [renderedAt] = useState(() => Date.now())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const connected = credentialData.oauthAccessToken && renderedAt < (credentialData.oauthTokenExpiry || 0)

  async function handleConnect() {
    setLoading(true)
    setError('')
    try {
      const data = await api.getMlOAuthStartUrl()
      window.location.href = data.url
    } catch (err) {
      setError(err.message || 'Não foi possível iniciar OAuth')
      setLoading(false)
    }
  }

  return (
    <div style={{marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)'}}>
      <div style={{fontSize: 11, color: 'var(--ink-soft)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'}}>OAuth (API de Itens)</div>
      {connected
        ? (
          <span style={{display:'inline-flex', alignItems:'center', gap: 4, fontSize: 12, color: 'var(--success)', fontWeight: 600, background: 'color-mix(in srgb, var(--success) 10%, transparent)', padding: '4px 10px', borderRadius: 999}}>
            OAuth conectado ✓
          </span>
        )
        : (
          <>
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              style={{display:'inline-flex', alignItems:'center', gap: 4, fontSize: 12, color: 'white', fontWeight: 600, background: 'var(--ink)', padding: '8px 14px', borderRadius: 999, border: 'none', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.65 : 1}}
            >
              {loading ? 'Aguarde...' : 'Conectar ML via OAuth'}
            </button>
            {error && <div style={{marginTop: 6, fontSize: 12, color: 'var(--danger)'}}>{error}</div>}
          </>
        )
      }
    </div>
  )
}

function PlatformForm({ platform, credential, onSaved }) {
  const credentialData = credential.data || {}
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(credentialData)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [attempted, setAttempted] = useState(false)
  const complete = isCredentialComplete(platform, credentialData)

  const missingRequired = platform.fields.filter(
    (field) => field.required !== false && !String(draft[field.key] || '').trim(),
  )
  const canSave = missingRequired.length === 0

  // Mensagem de sucesso é efêmera: some sozinha para não poluir a tela ao
  // editar outra plataforma logo em seguida.
  useEffect(() => {
    if (!message.includes('sucesso')) return undefined
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  async function saveCredential() {
    setAttempted(true)
    if (!canSave) {
      setMessage(`Preencha: ${missingRequired.map((field) => field.label).join(', ')}.`)
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const result = await api.saveCredential(platform.id, draft)
      onSaved(platform.id, result?.data || draft)
      setOpen(false)
      setMessage('Credenciais salvas com sucesso.')
    } catch (error) {
      setMessage(error.message || 'Não foi possível salvar as credenciais.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{padding:'14px 16px', borderBottom:'1px solid var(--line)'}}>
      <div style={{display:'flex', alignItems:'center', gap: 12}}>
        <div style={cfgStyles.storeBadge(platform.color)}>{platform.label.slice(0, 2).toUpperCase()}</div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={cfgStyles.rowTitle}>{platform.label}</div>
          <div style={cfgStyles.rowSub}>
            <span style={{color: complete ? 'var(--success)' : 'var(--ink-soft)', fontWeight: complete ? 600 : 400}}>
              {complete ? '● ativo' : `○ ${credentialSummary(platform, credentialData)}`}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { if (!open) setDraft(credentialData); setOpen((value) => !value) }}
          style={{padding:'8px 12px', borderRadius: 999, border:'1px solid var(--line)', background: complete ? 'transparent' : 'var(--ink)', color: complete ? 'var(--ink)' : 'white', fontSize: 12, fontWeight: 600}}
        >
          {open ? 'Fechar' : complete ? 'Editar' : 'Conectar'}
        </button>
      </div>

      {open && (
        <div style={{marginTop: 14, display:'grid', gap: 10}}>
          <p style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45}}>{platform.instructions}</p>
          {platform.fields.map((field) => {
            const required = field.required !== false
            const isEmpty = !String(draft[field.key] || '').trim()
            const invalid = attempted && required && isEmpty
            return (
              <label key={field.key} style={{display:'grid', gap: 6}}>
                <span style={cfgStyles.label}>{field.label}{required ? ' *' : ''}</span>
                <input
                  type={field.sensitive ? 'password' : 'text'}
                  value={draft[field.key] || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                  disabled={saving}
                  aria-invalid={invalid}
                  aria-label={field.label}
                  style={{...cfgStyles.field, borderColor: invalid ? 'var(--danger)' : undefined}}
                  autoComplete="off"
                />
              </label>
            )
          })}
          {message && <div style={{fontSize: 12, color: message.includes('sucesso') ? 'var(--success)' : 'var(--danger)'}}>{message}</div>}
          <button type="button" onClick={saveCredential} disabled={saving || !canSave} style={{...cfgStyles.field, background:'var(--ink)', color:'white', fontWeight: 700, opacity: (saving || !canSave) ? 0.65 : 1}}>
            {saving ? 'Salvando...' : 'Salvar credenciais'}
          </button>
        </div>
      )}

      {platform.id === 'mercadolivre' && (
        <MlOAuthSection credentialData={credentialData} />
      )}
    </div>
  )
}

export default function CredentialsPage() {
  useMobileRoutePerf('m/config/credentials')
  const [credentials, setCredentials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [mlOAuthMsg] = useState(() => {
    if (typeof window === 'undefined') return ''
    const mlOAuthParam = new URLSearchParams(window.location.search).get('ml_oauth')
    if (mlOAuthParam === 'success') return 'ML conectado via OAuth ✓'
    if (mlOAuthParam === 'error') return 'Falha ao conectar ML OAuth'
    return ''
  })

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const list = await api.credentials()
        if (active) setCredentials(Array.isArray(list) ? list : [])
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível carregar as credenciais.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  const credentialByPlatform = useMemo(() => {
    const map = new Map()
    for (const credential of credentials) map.set(credential.platform, credential)
    return map
  }, [credentials])

  function handleSaved(platform, data) {
    setCredentials((current) => {
      const next = current.filter((credential) => credential.platform !== platform)
      return [...next, { platform, data }]
    })
  }

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando credenciais..." /></div>
      </MobileShell>
    )
  }
  if (error) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} onRetry={() => setReloadKey((k) => k + 1)} /></div>
      </MobileShell>
    )
  }

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Credenciais</div>
      </div>

      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        Edite suas chaves de afiliada direto no mobile. Os dados são salvos no mesmo backoffice do painel desktop.
      </div>

      {mlOAuthMsg && (
        <div style={{margin:'10px 16px 0', padding:'10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: mlOAuthMsg.includes('✓') ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)', color: mlOAuthMsg.includes('✓') ? 'var(--success)' : 'var(--danger)'}}>
          {mlOAuthMsg}
        </div>
      )}

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {mobileCredentialPlatforms.map((platform, index) => (
            <PlatformForm
              key={platform.id}
              platform={platform}
              credential={credentialByPlatform.get(platform.id) || { platform: platform.id, data: {} }}
              onSaved={handleSaved}
              last={index === mobileCredentialPlatforms.length - 1}
            />
          ))}
        </div>
      </div>

      <div style={{height: 24}}/>
    </MobileShell>
  )
}
