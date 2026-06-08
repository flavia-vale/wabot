'use client'

import { useEffect, useMemo, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

const DEFAULT_BRANDING_CTA_TEXT = 'Participe do grupo:'
const MAX_BRANDING_CTA_CHARS = 80

const DELAY_PRESETS = [
  { id: 'fast', label: 'Rápido', min: 2, max: 5 },
  { id: 'default', label: 'Padrão', min: 5, max: 15 },
  { id: 'safe', label: 'Conservador', min: 15, max: 30 },
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

export default function PreferencesPage() {
  useMobileRoutePerf('m/config/preferences')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [kwDraft, setKwDraft] = useState('')

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
  }, [reloadKey])

  function patch(p) { setDraft((current) => ({ ...(current || {}), ...p })); setSavedMessage('') }

  const keywords = useMemo(() => normalizeKeywords(draft?.blockedKeywords), [draft?.blockedKeywords])

  function addKeywords(text = kwDraft) {
    const next = normalizeKeywords([...keywords, ...String(text).split(',')].join(','))
    patch({ blockedKeywords: next.join(',') })
    setKwDraft('')
  }

  function removeKeyword(keyword) {
    patch({ blockedKeywords: keywords.filter((k) => k !== keyword).join(',') })
  }

  async function savePreferences() {
    const delayMin = Math.trunc(Number(draft?.delayMin ?? 5))
    const delayMax = Math.trunc(Number(draft?.delayMax ?? 15))
    if (delayMin > delayMax) {
      setError('O mínimo não pode ser maior que o máximo.')
      return
    }
    const brandingGroupLink = String(draft?.brandingGroupLink ?? '').trim()
    if (brandingGroupLink && !hasHttpProtocol(brandingGroupLink)) {
      setError('Informe um link de grupo válido começando com http:// ou https://')
      return
    }
    const brandingCtaText = String(draft?.brandingCtaText ?? '').trim() || DEFAULT_BRANDING_CTA_TEXT
    if (brandingCtaText.length > MAX_BRANDING_CTA_CHARS) {
      setError(`O texto do CTA deve ter no máximo ${MAX_BRANDING_CTA_CHARS} caracteres.`)
      return
    }

    setSaving(true)
    setError('')
    setSavedMessage('')
    try {
      const payload = {
        delayMin,
        delayMax,
        blockedKeywords: normalizeKeywords(draft?.blockedKeywords).join(','),
        welcomeMsg: String(draft?.welcomeMsg ?? ''),
        brandingGroupLink,
        brandingCtaText,
        // round-trip fiel dos campos não editados aqui
        platforms: draft?.platforms,
        feedGlobal: draft?.feedGlobal,
        postToStatus: draft?.postToStatus,
      }
      const saved = await api.saveConfig(payload)
      setDraft(saved || { ...(draft || {}), ...payload })
      setSavedMessage('Preferências salvas.')
    } catch (e) {
      setError(e.message || 'Não foi possível salvar as preferências.')
    } finally {
      setSaving(false)
    }
  }

  function applyDelayPreset(preset) {
    patch({ delayMin: preset.min, delayMax: preset.max })
  }

  const delayMin = Number(draft?.delayMin ?? 5)
  const delayMax = Number(draft?.delayMax ?? 15)
  const delayInvalid = delayMin > delayMax
  const ctaPreview = String(draft?.brandingCtaText ?? '').trim() || DEFAULT_BRANDING_CTA_TEXT
  const linkPreview = String(draft?.brandingGroupLink ?? '').trim() || '[Link do seu grupo]'

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
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} onRetry={() => setReloadKey((k) => k + 1)} /></div>
      </MobileShell>
    )
  }

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Preferências</div>
      </div>

      {/* Delay */}
      <div style={cfgStyles.sectionLabel}>Ritmo de envio</div>
      <div style={{ padding: '0 16px' }}>
        <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            Tempo aleatório entre envios consecutivos. O bot aguarda entre o mínimo e o máximo antes de cada mensagem.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DELAY_PRESETS.map((preset) => {
              const isActive = draft?.delayMin === preset.min && draft?.delayMax === preset.max
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyDelayPreset(preset)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 10,
                    border: isActive ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                    background: isActive ? 'var(--ink)' : 'var(--surface)',
                    color: isActive ? 'white' : 'var(--ink)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {preset.label}
                  <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 2 }}>{preset.min}–{preset.max}s</div>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={cfgStyles.label}>Mínimo (segundos)</span>
              <input
                type="number"
                min={0} max={300}
                style={{ ...cfgStyles.field, borderColor: delayInvalid ? 'var(--danger)' : undefined }}
                value={draft?.delayMin ?? 5}
                onChange={(event) => patch({ delayMin: event.target.value })}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={cfgStyles.label}>Máximo (segundos)</span>
              <input
                type="number"
                min={0} max={300}
                style={{ ...cfgStyles.field, borderColor: delayInvalid ? 'var(--danger)' : undefined }}
                value={draft?.delayMax ?? 15}
                onChange={(event) => patch({ delayMax: event.target.value })}
              />
            </label>
          </div>
          {delayInvalid && (
            <div style={{ fontSize: 12, color: 'var(--danger)' }}>O mínimo não pode ser maior que o máximo.</div>
          )}
        </div>
      </div>

      {/* Branding */}
      <div style={cfgStyles.sectionLabel}>Marca nas mensagens</div>
      <div style={{ padding: '0 16px' }}>
        <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            Anexa um rodapé com o link do seu grupo no fim de cada mensagem. Deixe o link vazio para não anexar.
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={cfgStyles.label}>Texto antes do link</span>
            <input
              type="text"
              maxLength={MAX_BRANDING_CTA_CHARS}
              placeholder={DEFAULT_BRANDING_CTA_TEXT}
              style={cfgStyles.field}
              value={draft?.brandingCtaText ?? ''}
              onChange={(event) => patch({ brandingCtaText: event.target.value })}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={cfgStyles.label}>Link do seu grupo (opcional)</span>
            <input
              type="url"
              placeholder="https://chat.whatsapp.com/seu-grupo"
              style={cfgStyles.field}
              value={draft?.brandingGroupLink ?? ''}
              onChange={(event) => patch({ brandingGroupLink: event.target.value })}
            />
          </label>
          <div style={{ background: 'var(--bg-soft, #f1f5f3)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>Prévia do rodapé</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{`${ctaPreview} ${linkPreview}`}</div>
          </div>
        </div>
      </div>

      {/* Filtros e boas-vindas */}
      <div style={cfgStyles.sectionLabel}>Filtros e boas-vindas</div>
      <div style={{ padding: '0 16px' }}>
        <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={cfgStyles.label}>Palavras bloqueadas</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="ex: proibido, spam, fora"
                style={{ ...cfgStyles.field, flex: 1 }}
                value={kwDraft}
                onChange={(event) => { const t = event.target.value; if (t.includes(',')) addKeywords(t); else setKwDraft(t) }}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (kwDraft.trim()) addKeywords() } }}
                onBlur={() => { if (kwDraft.trim()) addKeywords() }}
              />
              <button
                type="button"
                onClick={() => addKeywords()}
                disabled={!kwDraft.trim()}
                style={{ ...mobi.btn('ghost'), opacity: kwDraft.trim() ? 1 : 0.5, whiteSpace: 'nowrap' }}
              >
                Adicionar
              </button>
            </div>
          </label>
          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            O bot ignora mensagens monitoradas que contenham qualquer uma dessas palavras (sem diferenciar maiúsculas).
          </div>
          {keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} aria-label="Palavras bloqueadas ativas">
              {keywords.map((k) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-soft, #f1f5f3)', borderRadius: 999, padding: '5px 10px', fontSize: 12.5, color: 'var(--ink)' }}>
                  {k}
                  <button type="button" onClick={() => removeKeyword(k)} aria-label={`Remover ${k}`} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <label style={{ display: 'grid', gap: 6, marginTop: 4 }}>
            <span style={cfgStyles.label}>Mensagem de boas-vindas</span>
            <textarea
              rows={3}
              placeholder="Enviada quando alguém entra num grupo de postagem. Vazio = não envia."
              style={{ ...cfgStyles.field, resize: 'vertical', minHeight: 72 }}
              value={draft?.welcomeMsg ?? ''}
              onChange={(event) => patch({ welcomeMsg: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div style={{ padding: '18px 16px 24px', display: 'grid', gap: 8 }}>
        <button type="button" onClick={savePreferences} disabled={saving || delayInvalid} style={{ ...mobi.btn('primary', true), opacity: (saving || delayInvalid) ? 0.65 : 1 }}>{saving ? 'Salvando...' : 'Salvar preferências'}</button>
        {savedMessage && <div style={{ fontSize: 12, color: 'var(--success)' }}>{savedMessage}</div>}
        {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
      </div>
    </MobileShell>
  )
}
