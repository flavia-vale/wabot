'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'

const FALLBACK = {
  operatingHoursEnabled: true,
  operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
  throttleEnabled: true,
  minIntervalSec: 60,
  burstCap: 6,
  burstWindowSec: 3600,
  dailyCap: 250,
  queueMaxAgeMin: 300,
}

const INTERVALS = [
  { value: 30, label: 'Entre 30 e 36 segundos' },
  { value: 40, label: 'Entre 40 e 48 segundos (recomendado)' },
  { value: 60, label: 'Entre 1 min e 1 min 12 s' },
  { value: 120, label: 'Entre 2 min e 2 min 24 s' },
]

function parseHours(value) {
  try { return { startHour: 8, endHour: 22, tz: 'America/Sao_Paulo', ...JSON.parse(value || '{}') } }
  catch { return { startHour: 8, endHour: 22, tz: 'America/Sao_Paulo' } }
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
}

function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 13) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`
  return digits ? `+${digits}` : 'Número conectado'
}

export function WhatsAppConnectedOverview({ phone, plan, onDisconnect, disconnecting }) {
  const isBasic = plan === 'basic'
  const [preset, setPreset] = useState(FALLBACK)
  const [presetId, setPresetId] = useState(null)
  const [today, setToday] = useState(0)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const hours = useMemo(() => parseHours(preset.operatingHoursJson), [preset.operatingHoursJson])

  useEffect(() => {
    let active = true
    api.logsSummary('today').then((data) => { if (active) setToday(Number(data?.counts?.success) || 0) }).catch(() => {})
    if (!isBasic) {
      api.preservationPresets().then(({ presets = [] }) => {
        if (!active) return
        const selected = presets.find((item) => item.isDefault) || presets[0]
        if (selected) { setPreset({ ...FALLBACK, ...selected }); setPresetId(selected.id) }
      }).catch(() => {})
    }
    return () => { active = false }
  }, [isBasic])

  function patchHours(patch) {
    setPreset((current) => ({ ...current, operatingHoursJson: JSON.stringify({ ...parseHours(current.operatingHoursJson), ...patch }) }))
  }

  async function save() {
    if (isBasic) return
    setSaving(true); setNotice('')
    const body = { ...preset, name: preset.name || 'Proteção padrão', isDefault: true }
    delete body.id; delete body.createdAt; delete body.updatedAt; delete body.userId
    try {
      const response = presetId
        ? await api.updatePreservationPreset(presetId, body)
        : await api.createPreservationPreset(body)
      const saved = response?.preset
      if (saved) { setPreset({ ...FALLBACK, ...saved }); setPresetId(saved.id) }
      setNotice('Preferências salvas.')
    } catch (error) {
      setNotice(error?.message || 'Não foi possível salvar agora.')
    } finally { setSaving(false) }
  }

  const cap = Number(preset.dailyCap) || 250
  const progress = Math.min(100, Math.round((today / Math.max(cap, 1)) * 100))

  return (
    <div className="wa-overview">
      <section className="wa-connected-bar">
        <span className="wa-mark" aria-hidden="true">↗</span>
        <div><strong>WhatsApp conectado</strong><span>{formatPhone(phone)} · pronto para publicar</span></div>
        <button type="button" onClick={onDisconnect} disabled={disconnecting}>{disconnecting ? 'Desconectando…' : 'Desconectar'}</button>
      </section>

      <section className={`wa-protection-card${isBasic ? ' is-locked' : ''}`}>
        {isBasic && (
          <div className="wa-pro-lock" role="status">
            <span><LockIcon /></span>
            <div><strong>Proteção de envio disponível no plano Pro</strong><p>Controle horários, intervalos e limites para publicar com mais segurança.</p></div>
            <Link href="/painel/plano">Conhecer o Pro</Link>
          </div>
        )}
        <div className="wa-protection-body" aria-disabled={isBasic}>
          <div className="wa-metric">
            <label>Publicações hoje</label>
            <p><strong>{today}</strong> de {cap}</p>
            <div className="wa-progress"><i style={{ width: `${progress}%` }} /></div>
            <small>O limite protege o seu número. Ele zera à meia-noite.</small>
          </div>
          <label className="wa-field">
            <span>Intervalo entre as mensagens</span>
            <select value={preset.minIntervalSec} disabled={isBasic} onChange={(e) => setPreset((p) => ({ ...p, minIntervalSec: Number(e.target.value) }))}>
              {INTERVALS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <small>Variar o tempo faz o número se comportar como uma pessoa.</small>
          </label>
          <label className="wa-field wa-cap-field">
            <span>Limite de mensagens por dia</span>
            <input type="number" min="1" max="10000" disabled={isBasic} value={cap} onChange={(e) => setPreset((p) => ({ ...p, dailyCap: Number(e.target.value) }))} />
          </label>
        </div>
      </section>

      <section className={`wa-hours-card${isBasic ? ' is-locked' : ''}`}>
        <header><div><h2>Horário em que o bot publica</h2><p>Defina quando suas ofertas podem ser enviadas.</p></div><span>{preset.operatingHoursEnabled ? `das ${hours.startHour}h às ${hours.endHour}h` : '24 horas'}</span></header>
        <div className="wa-hours-body" aria-disabled={isBasic}>
          <div className="wa-hours-row">
            <div><strong>Pausar fora do horário</strong><p>Nada é publicado antes ou depois da janela escolhida.</p></div>
            <button type="button" className={`wa-switch${preset.operatingHoursEnabled ? ' is-on' : ''}`} disabled={isBasic} aria-pressed={preset.operatingHoursEnabled} aria-label="Pausar fora do horário" onClick={() => setPreset((p) => ({ ...p, operatingHoursEnabled: !p.operatingHoursEnabled }))}><i /></button>
          </div>
          <div className="wa-time-grid">
            <label><span>Começa às</span><select disabled={isBasic || !preset.operatingHoursEnabled} value={hours.startHour} onChange={(e) => patchHours({ startHour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option value={h} key={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
            <label><span>Termina às</span><select disabled={isBasic || !preset.operatingHoursEnabled} value={hours.endHour} onChange={(e) => patchHours({ endHour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option value={h} key={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
          </div>
          {!isBasic && <div className="wa-save-row"><span aria-live="polite">{notice}</span><button type="button" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar preferências'}</button></div>}
        </div>
        {isBasic && <div className="wa-inline-lock"><LockIcon /> Disponível no plano Pro</div>}
      </section>
    </div>
  )
}
