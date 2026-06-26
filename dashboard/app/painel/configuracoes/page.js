'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
import { usePainelHeader } from '../PainelShell'

const DEFAULT_BRANDING_CTA_TEXT = 'Participe do grupo:'
const DELAY_PRESETS = [
  { id: 'fast', label: 'Rápido', min: 2, max: 5, desc: 'Baixo volume, operação acompanhada.' },
  { id: 'default', label: 'Padrão', min: 5, max: 15, desc: 'Recomendado para o dia a dia.' },
  { id: 'safe', label: 'Conservador', min: 15, max: 30, desc: 'Alto volume ou maior cautela.' },
]

function normalizeKeywords(text) {
  return String(text ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .filter((k, i, list) => list.indexOf(k) === i)
}

export default function ConfiguracoesPage() {
  usePainelHeader({ title: 'Configurações', subtitle: 'Cadência de envio das mensagens' })

  // form mantém TODOS os campos do config para round-trip fiel no saveConfig.
  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type, message }
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    let active = true
    Promise.all([api.getConfig(), loadTemplateStore().catch(() => ({}))])
      .then(([cfg, templateStore]) => {
        if (!active) return
        setTemplates(composeTemplates(templateStore))
        setForm({
          delayMin: cfg.delayMin ?? 5,
          delayMax: cfg.delayMax ?? 15,
          platforms: cfg.platforms ?? 'shopee,amazon,mercadolivre,magazineluiza',
          blockedKeywords: normalizeKeywords(cfg.blockedKeywords ?? '').join(','),
          welcomeMsg: cfg.welcomeMsg ?? '',
          postToStatus: cfg.postToStatus ?? false,
          brandingGroupLink: cfg.brandingGroupLink ?? '',
          brandingCtaText: cfg.brandingCtaText ?? DEFAULT_BRANDING_CTA_TEXT,
          mirrorTemplateKeyDefault: cfg.mirrorTemplateKeyDefault ?? '',
          primaryLinkTargetDefault: cfg.primaryLinkTargetDefault ?? 'first',
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

  async function save() {
    if (!form) return
    setFeedback(null)

    const min = parseDelay(form.delayMin, 'Mínimo')
    const max = parseDelay(form.delayMax, 'Máximo')
    if (min.error) return setFeedback({ type: 'error', message: min.error })
    if (max.error) return setFeedback({ type: 'error', message: max.error })
    if (min.value > max.value) return setFeedback({ type: 'error', message: 'O mínimo não pode ser maior que o máximo.' })

    const brandingGroupLink = String(form.brandingGroupLink).trim()
    const brandingCtaText = String(form.brandingCtaText).trim() || DEFAULT_BRANDING_CTA_TEXT

    setSaving(true)
    try {
      await api.saveConfig({
        delayMin: min.value ?? form.delayMin,
        delayMax: max.value ?? form.delayMax,
        platforms: form.platforms,
        blockedKeywords: normalizeKeywords(form.blockedKeywords).join(','),
        welcomeMsg: form.welcomeMsg,
        postToStatus: form.postToStatus,
        brandingGroupLink,
        brandingCtaText,
        mirrorTemplateKeyDefault: String(form.mirrorTemplateKeyDefault ?? '').trim() || null,
        primaryLinkTargetDefault: form.primaryLinkTargetDefault === 'last' ? 'last' : 'first',
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

        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar cadência'}
        </button>
      </section>

      {/* Padrão global do espelhamento com template */}
      <section className="pnl-card">
        <div className="pnl-card-title">Espelhamento com template (padrão global)</div>
        <p className="pnl-card-note" style={{ marginBottom: 14 }}>Aplicado a todos os grupos monitorados que não definem o próprio template. Cada grupo pode sobrescrever isto na aba Grupos (inclusive optar por manter o texto original).</p>

        <div className="pnl-field">
          <label className="pnl-label" htmlFor="mirrorTemplateKeyDefault">Template padrão</label>
          <select id="mirrorTemplateKeyDefault" className="pnl-input" value={form.mirrorTemplateKeyDefault ?? ''} onChange={(e) => patch({ mirrorTemplateKeyDefault: e.target.value })} disabled={saving}>
            <option value="">Sem template (manter texto original convertido)</option>
            {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </div>

        <div className="pnl-field" style={{ marginTop: 12 }}>
          <label className="pnl-label" htmlFor="primaryLinkTargetDefault">Link a converter quando há vários</label>
          <select id="primaryLinkTargetDefault" className="pnl-input" value={form.primaryLinkTargetDefault ?? 'first'} onChange={(e) => patch({ primaryLinkTargetDefault: e.target.value })} disabled={saving}>
            <option value="first">Primeiro link da mensagem</option>
            <option value="last">Último link da mensagem</option>
          </select>
        </div>

        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar padrão de espelhamento'}
        </button>
      </section>

      {feedback && <div className={`pnl-note-box is-${feedback.type}`} role="status">{feedback.message}</div>}
    </div>
  )
}
