'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'

const DEFAULT_CTA = 'Participe do grupo:'
const MAX_CTA = 80

const DELAY_PRESETS = [
  { id: 'fast', label: 'Rápido', min: 2, max: 5, desc: 'Baixo volume, operação acompanhada.' },
  { id: 'default', label: 'Padrão', min: 5, max: 15, desc: 'Recomendado para o dia a dia.' },
  { id: 'safe', label: 'Conservador', min: 15, max: 30, desc: 'Alto volume ou maior cautela.' },
]

const hasHttp = (v) => /^https?:\/\//i.test(String(v ?? '').trim())

export default function ConfiguracoesPage() {
  usePainelHeader({ title: 'Configurações', subtitle: 'Ajuste a cadência de envio e o branding das mensagens' })

  // form mantém TODOS os campos do config para round-trip fiel no saveConfig.
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
          delayMin: cfg.delayMin ?? 5,
          delayMax: cfg.delayMax ?? 15,
          platforms: cfg.platforms ?? 'shopee,amazon,mercadolivre,magazineluiza',
          blockedKeywords: cfg.blockedKeywords ?? '',
          welcomeMsg: cfg.welcomeMsg ?? '',
          feedGlobal: cfg.feedGlobal ?? false,
          postToStatus: cfg.postToStatus ?? false,
          brandingGroupLink: cfg.brandingGroupLink ?? '',
          brandingCtaText: cfg.brandingCtaText ?? DEFAULT_CTA,
        })
      })
      .catch((err) => { if (active) setLoadError(err?.message || 'Não foi possível carregar as configurações.') })
    return () => { active = false }
  }, [])

  function patch(p) { setForm((f) => ({ ...f, ...p })); setFeedback(null) }

  function parseDelay(value, label) {
    const n = Number(String(value).trim())
    if (!Number.isInteger(n) || n < 0 || n > 300) return { error: `${label} deve ser um inteiro entre 0 e 300.` }
    return { value: n }
  }

  async function save(section) {
    if (!form) return
    setFeedback(null)

    const min = parseDelay(form.delayMin, 'Mínimo')
    const max = parseDelay(form.delayMax, 'Máximo')
    if (section === 'delay') {
      if (min.error) return setFeedback({ type: 'error', message: min.error })
      if (max.error) return setFeedback({ type: 'error', message: max.error })
      if (min.value > max.value) return setFeedback({ type: 'error', message: 'O mínimo não pode ser maior que o máximo.' })
    }

    const brandingGroupLink = form.brandingGroupLink.trim()
    const brandingCtaText = form.brandingCtaText.trim() || DEFAULT_CTA
    if (section === 'branding') {
      if (brandingGroupLink && !hasHttp(brandingGroupLink)) return setFeedback({ type: 'error', message: 'Informe um link começando com http:// ou https://' })
      if (brandingCtaText.length > MAX_CTA) return setFeedback({ type: 'error', message: `O texto do CTA deve ter no máximo ${MAX_CTA} caracteres.` })
    }

    setSaving(true)
    try {
      await api.saveConfig({
        delayMin: min.value ?? form.delayMin,
        delayMax: max.value ?? form.delayMax,
        platforms: form.platforms,
        blockedKeywords: form.blockedKeywords,
        welcomeMsg: form.welcomeMsg,
        feedGlobal: form.feedGlobal,
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
    return <div className="pnl-grid" style={{ maxWidth: 640, margin: '0 auto' }}>{[0, 1].map((k) => <div key={k} className="pnl-skel" style={{ height: 220 }} />)}</div>
  }

  const ctaText = form.brandingCtaText.trim() || DEFAULT_CTA
  const previewLink = form.brandingGroupLink.trim() || '[Link do seu grupo]'

  return (
    <div className="pnl-grid" style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Delay */}
      <section className="pnl-card">
        <div className="pnl-card-title">Cadência entre envios</div>
        <p className="pnl-card-note" style={{ marginBottom: 14 }}>O bot sorteia um tempo dentro do intervalo antes de cada envio, evitando uma cadência robótica.</p>

        <div className="pnl-presets">
          {DELAY_PRESETS.map((p) => {
            const active = Number(form.delayMin) === p.min && Number(form.delayMax) === p.max
            return (
              <button key={p.id} type="button" className={`pnl-preset${active ? ' is-active' : ''}`} onClick={() => patch({ delayMin: p.min, delayMax: p.max })} disabled={saving}>
                <b>{p.label}</b>
                <span>{p.min}–{p.max}s</span>
                <small>{p.desc}</small>
              </button>
            )
          })}
        </div>

        <div className="pnl-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div className="pnl-field">
            <label className="pnl-label" htmlFor="delayMin">Mínimo (segundos)</label>
            <input id="delayMin" className="pnl-input" type="number" min="0" max="300" step="1" value={form.delayMin} onChange={(e) => patch({ delayMin: e.target.value })} />
          </div>
          <div className="pnl-field">
            <label className="pnl-label" htmlFor="delayMax">Máximo (segundos)</label>
            <input id="delayMax" className="pnl-input" type="number" min="0" max="300" step="1" value={form.delayMax} onChange={(e) => patch({ delayMax: e.target.value })} />
          </div>
        </div>

        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => save('delay')} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar cadência'}
        </button>
      </section>

      {/* Branding */}
      <section className="pnl-card">
        <div className="pnl-card-title">Branding das mensagens</div>
        <p className="pnl-card-note" style={{ marginBottom: 14 }}>Anexe o link do seu grupo no final das mensagens. Deixe em branco para não adicionar rodapé.</p>

        <div className="pnl-field" style={{ marginBottom: 12 }}>
          <label className="pnl-label" htmlFor="cta">Mensagem antes do link</label>
          <input id="cta" className="pnl-input" type="text" maxLength={MAX_CTA} placeholder={DEFAULT_CTA} value={form.brandingCtaText} onChange={(e) => patch({ brandingCtaText: e.target.value })} />
          <p className="pnl-hint">Pré-preenchido como “{DEFAULT_CTA}”. Se apagar, o padrão é usado.</p>
        </div>

        <div className="pnl-field">
          <label className="pnl-label" htmlFor="groupLink">Link do seu grupo (opcional)</label>
          <input id="groupLink" className="pnl-input" type="url" placeholder="https://chat.whatsapp.com/seu-grupo" value={form.brandingGroupLink} onChange={(e) => patch({ brandingGroupLink: e.target.value })} />
        </div>

        <div className="pnl-note-box is-info" style={{ marginTop: 14 }}>
          <strong style={{ fontWeight: 600 }}>Prévia do rodapé</strong>
          <p style={{ marginTop: 6 }}>{ctaText} {previewLink}</p>
        </div>

        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => save('branding')} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar branding'}
        </button>
      </section>

      {feedback && <div className={`pnl-note-box is-${feedback.type}`} role="status">{feedback.message}</div>}
    </div>
  )
}
