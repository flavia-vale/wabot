'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'

const DEFAULT_BRANDING_CTA_TEXT = 'Participe do grupo:'

function normalizeKeywords(text) {
  return String(text ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .filter((k, i, list) => list.indexOf(k) === i)
}

export default function ConfiguracoesPage() {
  usePainelHeader({ title: 'Configurações', subtitle: 'Preferências gerais do bot' })

  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type, message }

  useEffect(() => {
    let active = true
    api.getConfig()
      .then((cfg) => {
        if (!active) return
        setForm({
          platforms: cfg.platforms ?? 'shopee,amazon,mercadolivre,magazineluiza',
          blockedKeywords: normalizeKeywords(cfg.blockedKeywords ?? '').join(','),
          welcomeMsg: cfg.welcomeMsg ?? '',
          postToStatus: cfg.postToStatus ?? false,
          brandingGroupLink: cfg.brandingGroupLink ?? '',
          brandingCtaText: cfg.brandingCtaText ?? DEFAULT_BRANDING_CTA_TEXT,
        })
      })
      .catch((err) => { if (active) setLoadError(err?.message || 'Não foi possível carregar as configurações.') })
    return () => { active = false }
  }, [])

  function patch(p) { setForm((f) => ({ ...f, ...p })); setFeedback(null) }

  async function save() {
    if (!form) return
    setFeedback(null)

    const brandingGroupLink = String(form.brandingGroupLink).trim()
    const brandingCtaText = String(form.brandingCtaText).trim() || DEFAULT_BRANDING_CTA_TEXT

    setSaving(true)
    try {
      await api.saveConfig({
        platforms: form.platforms,
        blockedKeywords: normalizeKeywords(form.blockedKeywords).join(','),
        welcomeMsg: form.welcomeMsg,
        postToStatus: form.postToStatus,
        brandingGroupLink,
        brandingCtaText,
      })
      setFeedback({ type: 'success', message: 'Configurações salvas com sucesso.' })
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Não foi possível salvar.' })
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="pnl-grid" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="pnl-card" style={{ borderColor: 'color-mix(in oklab, var(--danger) 40%, transparent)' }}>
          <p className="pnl-card-title" style={{ color: 'var(--danger)' }}>Falha ao carregar configurações</p>
          <p className="pnl-card-note">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!form) {
    return <div className="pnl-grid" style={{ maxWidth: 640, margin: '0 auto' }}><div className="pnl-skel" style={{ height: 220 }} /></div>
  }

  return (
    <div className="pnl-grid" style={{ maxWidth: 640, margin: '0 auto' }}>
      <section className="pnl-card">
        <div className="pnl-card-title">Preferências gerais</div>
        <p className="pnl-card-note" style={{ marginBottom: 14 }}>Configure mensagens, plataformas e filtros gerais. A cadência anti-spam fica em Preservação por destino.</p>

        <div className="pnl-field">
          <label className="pnl-label" htmlFor="platforms">Plataformas ativas</label>
          <input id="platforms" className="pnl-input" value={form.platforms} onChange={(e) => patch({ platforms: e.target.value })} disabled={saving} />
        </div>

        <div className="pnl-field" style={{ marginTop: 12 }}>
          <label className="pnl-label" htmlFor="blockedKeywords">Palavras bloqueadas</label>
          <input id="blockedKeywords" className="pnl-input" value={form.blockedKeywords} onChange={(e) => patch({ blockedKeywords: e.target.value })} disabled={saving} />
        </div>

        <div className="pnl-field" style={{ marginTop: 12 }}>
          <label className="pnl-label" htmlFor="welcomeMsg">Mensagem de boas-vindas</label>
          <textarea id="welcomeMsg" className="pnl-input" rows={4} value={form.welcomeMsg} onChange={(e) => patch({ welcomeMsg: e.target.value })} disabled={saving} />
        </div>

        <div className="pnl-field" style={{ marginTop: 12 }}>
          <label className="pnl-label" htmlFor="brandingGroupLink">Link do grupo para CTA</label>
          <input id="brandingGroupLink" className="pnl-input" value={form.brandingGroupLink} onChange={(e) => patch({ brandingGroupLink: e.target.value })} disabled={saving} />
        </div>

        <div className="pnl-field" style={{ marginTop: 12 }}>
          <label className="pnl-label" htmlFor="brandingCtaText">Texto do CTA</label>
          <input id="brandingCtaText" className="pnl-input" value={form.brandingCtaText} onChange={(e) => patch({ brandingCtaText: e.target.value })} disabled={saving} />
        </div>

        <label className="pnl-check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={Boolean(form.postToStatus)} onChange={(e) => patch({ postToStatus: e.target.checked })} disabled={saving} />
          <span>Também postar nos Status</span>
        </label>

        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </section>

      {feedback && <div className={`pnl-note-box is-${feedback.type}`} role="status">{feedback.message}</div>}
    </div>
  )
}
