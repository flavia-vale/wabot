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

function PlatformInfoCard({ platform }) {
  return (
    <div className="pnl-card">
      {platform.instructions && <p className="pnl-card-note" style={{ marginBottom: 12 }}>{platform.instructions}</p>}
      <PlatformActionLinks links={platform.actionLinks} />
    </div>
  )
}

function SessionWarning({ platformId, sessionStatus }) {
  if (!sessionStatus || sessionStatus.alive !== false) return null
  if (platformId === 'amazon') {
    return (
      <div className="pnl-note-box is-error" style={{ marginBottom: 12 }} role="alert">
        <strong>Cookies da Amazon expirados.</strong> A sessão não está mais autenticando — as ofertas ainda saem,
        mas com o link longo (?tag=) em vez do amzn.to. Exporte um cookie novo da sua sessão logada e salve para
        voltar a gerar o link curto.
      </div>
    )
  }
  return (
    <div className="pnl-note-box is-error" style={{ marginBottom: 12 }} role="alert">
      <strong>Sessão expirada.</strong> O cookie SSID do Mercado Livre não está mais válido — a geração de ofertas do ML está pausada.
      Cole um SSID novo da sua sessão ativa e salve para voltar a funcionar.
    </div>
  )
}

// Explica, na tela onde o dado é pedido, o que fazemos com o cookie de sessão.
// A dúvida "isso expõe meus dados pessoais?" é legítima e não se resolve com
// texto tranquilizador solto: fica junto do campo, com o botão de apagar ao lado.
function CookiePrivacyDetails({ platform }) {
  if (!platform.supportsCookielessMode) return null
  return (
    <details className="pnl-help" style={{ marginBottom: 12 }}>
      <summary>O que o BOTinho faz com esse cookie?</summary>
      <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
        <li>Usamos <strong>só</strong> para gerar o seu link de afiliado com a sua comissão.</li>
        <li>Fica <strong>guardado criptografado</strong> no servidor e nunca é repassado a terceiros.</li>
        <li>Não compramos, não alteramos sua conta e não lemos suas mensagens ou dados pessoais.</li>
        <li>Você pode <strong>apagar quando quiser</strong> no botão abaixo, ou encerrar as sessões na própria loja — o cookie deixa de valer na hora.</li>
        <li>Prefere não dar o cookie? Ligue o <strong>modo sem cookie</strong> abaixo: o robô continua funcionando.</li>
      </ul>
    </details>
  )
}

function PlatformCard({ platform, initialData, onSave, onDelete, disabled, sessionStatus }) {
  const [draft, setDraft] = useState({})
  const [dirty, setDirty] = useState(false)
  const [visible, setVisible] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type, message, warnings }
  const [fieldErrors, setFieldErrors] = useState({})

  const values = dirty ? draft : (initialData ?? {})
  const status = CRED_STATUS[getPlatformStatus(platform, values)]
  const cookieless = !!platform.supportsCookielessMode && values.cookielessMode === true
  const visibleFields = platform.fields.filter((f) => !(cookieless && f.cookieField))
  const hasStoredCredential = !!initialData && Object.keys(initialData).length > 0
  const isDisabled = disabled || saving || deleting

  function update(key, value) {
    setFeedback(null)
    setFieldErrors((cur) => ({ ...cur, [key]: '' }))
    setDraft((cur) => ({ ...(dirty ? cur : (initialData ?? {})), [key]: value }))
    setDirty(true)
  }

  // Ligar o modo sem cookie limpa os campos de sessão no formulário na hora —
  // o backend também os descarta ao salvar (sanitizeCredentialBody), mas a
  // usuária precisa VER o valor sumir, não confiar que sumiu.
  function toggleCookieless(next) {
    setFeedback(null)
    const base = { ...(dirty ? draft : (initialData ?? {})) }
    if (next) {
      for (const f of platform.fields) {
        if (f.cookieField) delete base[f.key]
      }
      setFieldErrors({})
    }
    setDraft({ ...base, cookielessMode: next })
    setDirty(true)
  }

  async function handleDelete() {
    if (!window.confirm(`Apagar as credenciais de ${platform.label}? Os dados dessa loja saem do BOTinho agora.`)) return
    setDeleting(true)
    setFeedback(null)
    try {
      const result = await onDelete(platform.id)
      setDraft({})
      setDirty(false)
      setFeedback({ type: 'success', message: result?.message || 'Credencial apagada.' })
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Não foi possível apagar a credencial.' })
    } finally {
      setDeleting(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    const missing = visibleFields.filter((f) => f.required !== false && !String(values[f.key] ?? '').trim())
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
      {!cookieless && <SessionWarning platformId={platform.id} sessionStatus={sessionStatus} />}
      <PlatformActionLinks links={platform.actionLinks} />
      {platform.platformWarning && !cookieless && <div className="pnl-note-box is-warn" style={{ marginBottom: 12 }}>{platform.platformWarning}</div>}

      <CookiePrivacyDetails platform={platform} />

      {platform.supportsCookielessMode && (
        <div className="pnl-note-box is-info" style={{ marginBottom: 12 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: isDisabled ? 'default' : 'pointer' }}>
            <input
              type="checkbox"
              checked={cookieless}
              onChange={(e) => toggleCookieless(e.target.checked)}
              disabled={isDisabled}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong>Modo sem cookie (mais privado).</strong> Guardamos apenas a sua tag — nenhum dado de sessão da sua conta.
              {platform.cookielessNote && <><br />{platform.cookielessNote}</>}
            </span>
          </label>
        </div>
      )}

      <div className="pnl-grid" style={{ gap: 12 }}>
        {visibleFields.map((f) => {
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

      {hasStoredCredential && (
        <button
          type="button"
          className="pnl-btn"
          style={{ marginTop: 8, width: '100%', justifyContent: 'center', color: 'var(--danger)' }}
          onClick={handleDelete}
          disabled={isDisabled}
        >
          {deleting ? 'Apagando…' : `Apagar credenciais de ${platform.label}`}
        </button>
      )}
    </form>
  )
}

export default function IdsAfiliadaPage() {
  usePainelHeader({ title: 'Minhas credenciais', subtitle: 'Cole o ID de cada plataforma — o bot cuida do resto' })

  const [credMap, setCredMap] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [mlSession, setMlSession] = useState(null)
  const [amazonSession, setAmazonSession] = useState(null)

  // Checa a validade do SSID do ML (sessão de afiliado). Só roda quando há
  // cookie cadastrado — o endpoint faz um request autenticado ao ML.
  function refreshMlSession(data) {
    // Modo sem cookie: não há sessão para checar (o endpoint responde
    // `cookieless_mode`), então nem chamamos — evita request inútil e qualquer
    // chance de alarme "sessão expirada" para quem optou por não dar o SSID.
    if (data?.cookielessMode === true) { setMlSession(null); return }
    if (!(data?.ssid || data?.cookie)) { setMlSession(null); return }
    api.mercadolivreSession()
      .then((status) => setMlSession(status))
      .catch(() => setMlSession(null))
  }

  // Idem para a Amazon: só checa quando há tag + algum portador de cookie
  // (o cookie completo OU o at-acbbr legado). O endpoint faz um getShortUrl
  // autenticado no SiteStripe.
  function refreshAmazonSession(data) {
    if (data?.cookielessMode === true) { setAmazonSession(null); return }
    if (!(data?.tag && (data?.cookie || data?.['at-acbbr']))) { setAmazonSession(null); return }
    api.amazonSession()
      .then((status) => setAmazonSession(status))
      .catch(() => setAmazonSession(null))
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
        refreshAmazonSession(map.amazon)
      })
      .catch((err) => { if (active) setLoadError(err?.message || 'Falha ao carregar credenciais.') })
    return () => { active = false }
  }, [])

  async function handleSave(platform, data) {
    const result = await api.saveCredential(platform, data)
    const savedData = result?.data ?? data
    setCredMap((m) => ({ ...(m || {}), [platform]: savedData }))
    // Ao salvar cookies novos, re-checa a sessão para limpar/atualizar o aviso.
    if (platform === 'mercadolivre') refreshMlSession(savedData)
    if (platform === 'amazon') refreshAmazonSession(savedData)
    return result
  }

  async function handleDelete(platform) {
    const result = await api.deleteCredential(platform)
    setCredMap((m) => {
      const next = { ...(m || {}) }
      delete next[platform]
      return next
    })
    if (platform === 'mercadolivre') setMlSession(null)
    if (platform === 'amazon') setAmazonSession(null)
    return result
  }

  const loading = credMap === null && !loadError

  return (
    <div className="pnl-grid" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="pnl-note-box is-info">
        Esses dados são usados apenas para gerar seus links de afiliado com a sua comissão, ficam guardados criptografados e você pode apagá-los quando quiser.
        Se preferir não cadastrar cookie de sessão, ligue o <strong>modo sem cookie</strong> no cartão da loja — o robô continua funcionando. Não compartilhe suas credenciais fora do painel.
      </div>

      {loadError && (
        <div className="pnl-card" style={{ borderColor: 'color-mix(in oklab, var(--danger) 40%, transparent)' }}>
          <p className="pnl-card-title" style={{ color: 'var(--danger)' }}>Falha ao carregar credenciais</p>
          <p className="pnl-card-note">{loadError}</p>
        </div>
      )}

      {loading
        ? [0, 1, 2, 3].map((k) => <div key={k} className="pnl-skel" style={{ height: 160 }} />)
        : AFFILIATE_PLATFORMS.map((p) =>
            p.type === 'info' ? (
              <PlatformInfoCard key={p.id} platform={p} />
            ) : (
              <PlatformCard
                key={p.id}
                platform={p}
                initialData={credMap?.[p.id]}
                onSave={handleSave}
                onDelete={handleDelete}
                disabled={!!loadError}
                sessionStatus={p.id === 'mercadolivre' ? mlSession : p.id === 'amazon' ? amazonSession : null}
              />
            )
          )}
    </div>
  )
}
