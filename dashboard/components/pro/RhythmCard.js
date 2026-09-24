'use client'

/* "Ritmo dos envios" na tela do WhatsApp (divisão Basic/PRO, 2026-09-23).
 *
 * NÃO é um limite novo: estes campos SÃO o preset PADRÃO da Preservação
 * (PreservationPreset.isDefault) — o mesmo que /painel/preservacao/destinos
 * edita. Vale para todo grupo e canal que usa o padrão; destino com ajuste
 * próprio continua com a escolha dele (decisão da dona do produto: ligar ao
 * padrão que já existe, sem criar teto de conta).
 *
 * Horário de descanso é o inverso do "horário de funcionamento" gravado:
 * descansa das `endHour` às `startHour`.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainel } from '@/app/painel/PainelShell'
import { ProLock } from './ProGate'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const INTERVALS = [
  [30, '30 segundos'],
  [60, '1 minuto (recomendado)'],
  [120, '2 minutos'],
  [300, '5 minutos'],
]
const DAILY = [
  ['', 'Sem limite'],
  ['60', '60 ofertas'],
  ['120', '120 ofertas'],
  ['150', '150 ofertas'],
  ['250', '250 ofertas'],
]

function parseHours(json) {
  try {
    const parsed = JSON.parse(json || '{}')
    return {
      startHour: Number.isInteger(parsed.startHour) ? parsed.startHour : 8,
      endHour: Number.isInteger(parsed.endHour) ? parsed.endHour : 22,
      tz: parsed.tz || 'America/Sao_Paulo',
    }
  } catch {
    return { startHour: 8, endHour: 22, tz: 'America/Sao_Paulo' }
  }
}

function fromPreset(preset) {
  const hours = parseHours(preset?.operatingHoursJson)
  return {
    restEnabled: Boolean(preset?.operatingHoursEnabled),
    restFrom: hours.endHour,
    restTo: hours.startHour,
    tz: hours.tz,
    minIntervalSec: preset?.throttleEnabled === false ? null : (preset?.minIntervalSec ?? 30), // 30 = HARD_DEFAULT_PRESERVATION
    dailyCap: preset?.dailyCap ?? null,
  }
}

function withCurrent(options, current, label) {
  if (current == null || options.some(([value]) => String(value) === String(current))) return options
  return [...options, [current, label(current)]]
}

function RhythmForm({ value, onChange, disabled }) {
  const intervalOptions = withCurrent(INTERVALS, value.minIntervalSec, v => `${v} segundos`)
  const dailyOptions = withCurrent(DAILY, value.dailyCap == null ? '' : String(value.dailyCap), v => `${v} ofertas`)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <label className="pnl-check">
        <input type="checkbox" checked={value.restEnabled} disabled={disabled} onChange={e => onChange({ restEnabled: e.target.checked })} />
        Horário de descanso
      </label>
      {value.restEnabled && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 13.5 }}>
          Nada é publicado entre
          <select className="pnl-input" style={{ width: 'auto' }} value={value.restFrom} disabled={disabled} onChange={e => onChange({ restFrom: Number(e.target.value) })}>
            {HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
          </select>
          e
          <select className="pnl-input" style={{ width: 'auto' }} value={value.restTo} disabled={disabled} onChange={e => onChange({ restTo: Number(e.target.value) })}>
            {HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
          </select>
        </div>
      )}
      <div className="pnl-field">
        <label className="pnl-label" htmlFor="rhythm-daily">Máximo de ofertas por dia, em cada grupo</label>
        <select id="rhythm-daily" className="pnl-input" value={value.dailyCap == null ? '' : String(value.dailyCap)} disabled={disabled} onChange={e => onChange({ dailyCap: e.target.value === '' ? null : Number(e.target.value) })}>
          {dailyOptions.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div className="pnl-field">
        <label className="pnl-label" htmlFor="rhythm-interval">Intervalo entre mensagens no mesmo grupo</label>
        <select id="rhythm-interval" className="pnl-input" value={value.minIntervalSec == null ? '' : String(value.minIntervalSec)} disabled={disabled} onChange={e => onChange({ minIntervalSec: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">Sem intervalo</option>
          {intervalOptions.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <p className="pnl-hint" style={{ marginTop: 4 }}>Esperar entre uma mensagem e outra faz o número se comportar como uma pessoa.</p>
      </div>
    </div>
  )
}

const EXAMPLE = { restEnabled: true, restFrom: 22, restTo: 8, minIntervalSec: 60, dailyCap: 150 }

export default function RhythmCard() {
  const { isPro } = usePainel()
  const [preset, setPreset] = useState(null)
  const [value, setValue] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isPro) return undefined
    let active = true
    api.preservationPresets()
      .then(data => {
        if (!active) return
        const def = (data?.presets ?? []).find(p => p.isDefault) ?? null
        setPreset(def)
        setValue(fromPreset(def))
      })
      .catch(err => { if (active) setMessage(err.message) })
    return () => { active = false }
  }, [isPro])

  function change(patch) {
    setValue(v => ({ ...v, ...patch }))
    setDirty(true)
    setMessage('')
  }

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const body = {
        operatingHoursEnabled: value.restEnabled,
        operatingHoursJson: JSON.stringify({ startHour: value.restTo, endHour: value.restFrom, tz: value.tz || 'America/Sao_Paulo' }),
        throttleEnabled: value.minIntervalSec != null,
        ...(value.minIntervalSec != null ? { minIntervalSec: value.minIntervalSec } : {}),
        dailyCap: value.dailyCap,
      }
      const res = preset
        ? await api.updatePreservationPreset(preset.id, body)
        : await api.createPreservationPreset({ name: 'Padrão', isDefault: true, ...body })
      setPreset(res?.preset ?? preset)
      setDirty(false)
      setMessage('Salvo. Vale para os grupos e canais que usam o padrão.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="pnl-card" aria-labelledby="rhythm-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h2 id="rhythm-title" className="pnl-card-title" style={{ margin: 0 }}>Ritmo dos envios</h2>
        <span className="pnl-hint">protege o seu número</span>
      </div>
      <p className="pnl-hint" style={{ margin: '6px 0 14px' }}>
        Vale para todos os grupos e canais que usam o padrão. Quem tem ajuste próprio em{' '}
        <Link href="/painel/anti-banimento?parte=ritmo">Anti-banimento</Link> continua com o ajuste dele.
      </p>
      {!isPro ? (
        <ProLock feature="ritmo">
          <RhythmForm value={EXAMPLE} onChange={() => {}} disabled />
        </ProLock>
      ) : !value ? (
        <p className="pnl-hint">{message || 'Carregando…'}</p>
      ) : (
        <>
          <RhythmForm value={value} onChange={change} disabled={saving} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" className="pnl-btn is-primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Salvando…' : 'Salvar ritmo'}</button>
            {message && <span className="pnl-hint" role="status">{message}</span>}
          </div>
        </>
      )}
    </section>
  )
}
