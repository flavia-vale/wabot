'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'
import { AFFILIATE_PLATFORMS, CRED_STATUS, getPlatformStatus } from '@/lib/painel/affiliatePlatforms'


function PlatformActionLinks({ links }) {
  if (!links?.length) return null

  return (
    <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 14 }}>
      {links.map((link, index) => (
        <a
          key={link.href}
          className={`pnl-btn ${index === 0 ? 'is-primary' : ''}`}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ justifyContent: 'center', textAlign: 'center' }}
        >
          {link.label}
        </a>
      ))}
    </div>
  )
}

function SessionWarning({ sessionStatus }) {
  if (!sessionStatus || sessionStatus.alive !== false) return null
  return (
    <div className="pnl-note-box is-error" style={{ marginBottom: 12 }} role="alert">
      <strong>Sessão expirada.</strong> O cookie SSID do Mercado Livre não está mais válido — a geração de ofertas do ML está pausada.
      Cole um SSID novo da sua sessão ativa e salve para voltar a funcionar.
    </div>
  )
}

function PlatformCard({ platform, initialData, onSave, disabled, sessionStatus }) {
  const [draft, setDraft] = useState({})
  const [dirty, setDirty] = useState(false)
  const [visible, setVisible] = useState({})
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type, message, warnings }
  const [fieldErrors, setFieldErrors] = useState({})

  const values = dirty ? draft : (initialData ?? {})
  const status = CRED_STATUS[getPlatformStatus(platform, values)]
  const isDisabled = disabled || saving

  function update(key, value) {
    setFeedback(null)
    setFieldErrors((cur) => ({ ...cur, [key]: '' }))
    setDraft((cur) => ({ ...(dirty ? cur : (initialData ?? {})), [key]: value }))
    setDirty(true)
  }

  async function submit(e) {
    e.preventDefault()
    const missing = platform.fields.filter((f) => f.required !== false && !String(values[f.key] ?? '').trim())
    if (missing.length) {
      setFieldErrors(Object.fromEntries(missing.map((f) => [f.key, `${f.label} é obrigatório.`])))
      setFeedback({ type: 'error', message: `Preencha os campos obrigatórios de ${platform.label}.` })
      return
    }
    setSaving(true)
    setFeedback(null)
    try {
      const result = await onSave(platform.id, values)
      const warnings = result?.validation?.warnings || []
      setFeedback({ type: warnings.length ? 'warn' : 'success', message: result?.message || 'Credenciais atualizadas com sucesso.', warnings })
      setDraft({})
      setDirty(false)
    } catch (err) {
      setFeedback({ type: 'error', message: `${err?.message || 'Não foi possível salvar.'} Verifique os campos e tente novamente.` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="pnl-card" onSubmit={submit}>
      <div className="pnl-card-head">
        <div className="pnl-card-title">{platform.label}</div>
        <span className={`pnl-tag ${status.cls}`}>{status.label}</span>
      </div>
      {platform.instructions && <p className="pnl-card-note" style={{ marginBottom: 12 }}>{platform.instructions}</p>}
      <SessionWarning sessionStatus={sessionStatus} />
      <PlatformActionLinks links={platform.actionLinks} />
      {platform.platformWarning && <div className="pnl-note-box is-warn" style={{ marginBottom: 12 }}>{platform.platformWarning}</div>}

      <div className="pnl-grid" style={{ gap: 12 }}>
        {platform.fields.map((f) => {
          const hidden = f.sensitive && !visible[f.key]
          const id = `${platform.id}-${f.key}`
          return (
            <div key={f.key} className="pnl-field">
              <label className="pnl-label" htmlFor={id}>{f.label}</label>
              <div className="pnl-field-row">
                <input
                  id={id}
                  className="pnl-input"
                  type={hidden ? 'password' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={(e) => update(f.key, e.target.value)}
                  disabled={isDisabled}
                  aria-invalid={!!fieldErrors[f.key]}
                />
                {f.sensitive && (
                  <button
                    type="button"
                    className="pnl-btn pnl-btn-sm"
                    onClick={() => setVisible((cur) => ({ ...cur, [f.key]: !cur[f.key] }))}
                    disabled={isDisabled}
                    aria-label={`${visible[f.key] ? 'Ocultar' : 'Mostrar'} ${f.label}`}
                  >
                    {visible[f.key] ? 'Ocultar' : 'Mostrar'}
                  </button>
                )}
              </div>
              {f.hint && <p className="pnl-hint">{f.hint}</p>}
              {f.help && (
                <details className="pnl-help">
                  <summary>Como encontrar?</summary>
                  <p>{f.help}</p>
                </details>
              )}
              {fieldErrors[f.key] && <p className="pnl-field-error" role="alert">{fieldErrors[f.key]}</p>}
            </div>
          )
        })}
      </div>

      {feedback && (
        <div className={`pnl-note-box is-${feedback.type}`} style={{ marginTop: 14 }} role="status">
          {feedback.message}
          {!!feedback.warnings?.length && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
              {feedback.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      <button type="submit" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} disabled={isDisabled}>
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  )
}

export default function IdsAfiliadaPage() {
  usePainelHeader({ title: 'IDs de afiliada', subtitle: 'Cole o ID de cada plataforma — o bot cuida do resto' })

  const [credMap, setCredMap] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [mlSession, setMlSession] = useState(null)

  // Checa a validade do SSID do ML (sessão de afiliado). Só roda quando há
  // cookie cadastrado — o endpoint faz um request autenticado ao ML.
  function refreshMlSession(data) {
    if (!(data?.ssid || data?.cookie)) { setMlSession(null); return }
    api.mercadolivreSession()
      .then((status) => setMlSession(status))
      .catch(() => setMlSession(null))
  }

  useEffect(() => {
    let active = true
    api.credentials()
      .then((list) => {
        if (!active) return
        const map = {}
        for (const c of list) map[c.platform] = c.data
        setCredMap(map)
        refreshMlSession(map.mercadolivre)
      })
      .catch((err) => { if (active) setLoadError(err?.message || 'Falha ao carregar credenciais.') })
    return () => { active = false }
  }, [])

  async function handleSave(platform, data) {
    const result = await api.saveCredential(platform, data)
    const savedData = result?.data ?? data
    setCredMap((m) => ({ ...(m || {}), [platform]: savedData }))
    // Ao salvar um SSID novo, re-checa a sessão para limpar/atualizar o aviso.
    if (platform === 'mercadolivre') refreshMlSession(savedData)
    return result
  }

  const loading = credMap === null && !loadError

  return (
    <div className="pnl-grid" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="pnl-note-box is-info">
        Esses dados são usados apenas para gerar seus links de afiliado com a sua comissão. Não compartilhe suas credenciais fora do painel.
      </div>

      {loadError && (
        <div className="pnl-card" style={{ borderColor: 'color-mix(in oklab, var(--danger) 40%, transparent)' }}>
          <p className="pnl-card-title" style={{ color: 'var(--danger)' }}>Falha ao carregar credenciais</p>
          <p className="pnl-card-note">{loadError}</p>
        </div>
      )}

      {loading
        ? [0, 1, 2, 3].map((k) => <div key={k} className="pnl-skel" style={{ height: 160 }} />)
        : AFFILIATE_PLATFORMS.map((p) => (
            <PlatformCard
              key={p.id}
              platform={p}
              initialData={credMap?.[p.id]}
              onSave={handleSave}
              disabled={!!loadError}
              sessionStatus={p.id === 'mercadolivre' ? mlSession : null}
            />
          ))}
    </div>
  )
}
