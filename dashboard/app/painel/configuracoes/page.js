'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'

const DEFAULT_BRANDING_CTA_TEXT = 'Participe do grupo:'
const MAX_BRANDING_CTA_CHARS = 80

const DELAY_PRESETS = [
  { id: 'fast', label: 'Rápido', min: 2, max: 5, desc: 'Baixo volume, operação acompanhada.' },
  { id: 'default', label: 'Padrão', min: 5, max: 15, desc: 'Recomendado para o dia a dia.' },
  { id: 'safe', label: 'Conservador', min: 15, max: 30, desc: 'Alto volume ou maior cautela.' },
]

function hasHttpProtocol(value) {
  return /^https?:\/\//i.test(String(value ?? '').trim())
}

function normalizeKeywords(text) {
  return String(text ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .filter((k, i, list) => list.indexOf(k) === i)
}

export default function ConfiguracoesPage() {
  usePainelHeader({ title: 'Configurações', subtitle: 'Cadência de envio, marca e filtros das mensagens' })

  // form mantém TODOS os campos do config para round-trip fiel no saveConfig.
  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type, message }
  const [kwDraft, setKwDraft] = useState('')

  useEffect(() => {
    let active = true
    api.getConfig()
      .then((cfg) => {
        if (!active) return
        setForm({
          delayMin: cfg.delayMin ?? 5,
          delayMax: cfg.delayMax ?? 15,
          platforms: cfg.platforms ?? 'shopee,amazon,mercadolivre,magazineluiza',
          blockedKeywords: normalizeKeywords(cfg.blockedKeywords ?? '').join(','),
          welcomeMsg: cfg.welcomeMsg ?? '',
          feedGlobal: cfg.feedGlobal ?? false,
          postToStatus: cfg.postToStatus ?? false,
          brandingGroupLink: cfg.brandingGroupLink ?? '',
          brandingCtaText: cfg.brandingCtaText ?? DEFAULT_BRANDING_CTA_TEXT,
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

  const keywords = useMemo(() => normalizeKeywords(form?.blockedKeywords), [form?.blockedKeywords])

  function addKeywords(text = kwDraft) {
    const next = normalizeKeywords([...keywords, ...String(text).split(',')].join(','))
    patch({ blockedKeywords: next.join(',') })
    setKwDraft('')
  }

  function removeKeyword(keyword) {
    patch({ blockedKeywords: keywords.filter((k) => k !== keyword).join(',') })
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

    const brandingGroupLink = String(form.brandingGroupLink).trim()
    const brandingCtaText = String(form.brandingCtaText).trim() || DEFAULT_BRANDING_CTA_TEXT
    if (section === 'branding') {
      if (brandingGroupLink && !hasHttpProtocol(brandingGroupLink)) {
        return setFeedback({ type: 'error', message: 'Informe um link válido começando com http:// ou https://' })
      }
      if (brandingCtaText.length > MAX_BRANDING_CTA_CHARS) {
        return setFeedback({ type: 'error', message: `O texto do CTA deve ter no máximo ${MAX_BRANDING_CTA_CHARS} caracteres.` })
      }
    }

    setSaving(true)
    try {
      await api.saveConfig({
        delayMin: min.value ?? form.delayMin,
        delayMax: max.value ?? form.delayMax,
        platforms: form.platforms,
        blockedKeywords: normalizeKeywords(form.blockedKeywords).join(','),
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

  const ctaPreview = String(form.brandingCtaText).trim() || DEFAULT_BRANDING_CTA_TEXT
  const linkPreview = String(form.brandingGroupLink).trim() || '[Link do seu grupo]'

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
        <div className="pnl-card-title">Marca nas mensagens</div>
        <p className="pnl-card-note" style={{ marginBottom: 14 }}>Anexa um rodapé com o link do seu grupo no final de cada mensagem. Deixe o link vazio para não anexar nada.</p>

        <div className="pnl-field">
          <label className="pnl-label" htmlFor="brandingCtaText">Texto antes do link</label>
          <input
            id="brandingCtaText"
            className="pnl-input"
            type="text"
            maxLength={MAX_BRANDING_CTA_CHARS}
            placeholder={DEFAULT_BRANDING_CTA_TEXT}
            value={form.brandingCtaText}
            onChange={(e) => patch({ brandingCtaText: e.target.value })}
          />
        </div>

        <div className="pnl-field" style={{ marginTop: 12 }}>
          <label className="pnl-label" htmlFor="brandingGroupLink">Link do seu grupo (opcional)</label>
          <input
            id="brandingGroupLink"
            className="pnl-input"
            type="url"
            placeholder="https://chat.whatsapp.com/seu-grupo"
            value={form.brandingGroupLink}
            onChange={(e) => patch({ brandingGroupLink: e.target.value })}
          />
        </div>

        <div className="pnl-note-box" style={{ marginTop: 12 }}>
          <p className="pnl-card-note" style={{ marginBottom: 6, fontWeight: 600 }}>Prévia do rodapé</p>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{`${ctaPreview} ${linkPreview}`}</p>
        </div>

        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => save('branding')} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar marca'}
        </button>
      </section>

      {/* Filtros e boas-vindas */}
      <section className="pnl-card">
        <div className="pnl-card-title">Filtros e boas-vindas</div>

        <div className="pnl-field">
          <label className="pnl-label" htmlFor="kwDraft">Palavras bloqueadas</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="kwDraft"
              className="pnl-input"
              type="text"
              placeholder="ex: proibido, spam, fora"
              value={kwDraft}
              onChange={(e) => { const t = e.target.value; if (t.includes(',')) addKeywords(t); else setKwDraft(t) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (kwDraft.trim()) addKeywords() } }}
              onBlur={() => { if (kwDraft.trim()) addKeywords() }}
            />
            <button type="button" className="pnl-btn" onClick={() => addKeywords()} disabled={!kwDraft.trim() || saving}>Adicionar</button>
          </div>
          <p className="pnl-card-note" style={{ marginTop: 6 }}>O bot ignora mensagens monitoradas que contenham qualquer uma dessas palavras (sem diferenciar maiúsculas).</p>
          {keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }} aria-label="Palavras bloqueadas ativas">
              {keywords.map((k) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-soft, #f1f1f1)', borderRadius: 999, padding: '4px 10px', fontSize: 13 }}>
                  {k}
                  <button type="button" onClick={() => removeKeyword(k)} aria-label={`Remover ${k}`} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--ink-soft, #667)' }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pnl-field" style={{ marginTop: 16 }}>
          <label className="pnl-label" htmlFor="welcomeMsg">Mensagem de boas-vindas</label>
          <textarea
            id="welcomeMsg"
            className="pnl-input"
            rows={3}
            placeholder="Enviada automaticamente quando alguém entra num grupo de postagem. Deixe vazio para não enviar."
            value={form.welcomeMsg}
            onChange={(e) => patch({ welcomeMsg: e.target.value })}
          />
        </div>

        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => save('filters')} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar filtros'}
        </button>
      </section>

      {feedback && <div className={`pnl-note-box is-${feedback.type}`} role="status">{feedback.message}</div>}
    </div>
  )
}
