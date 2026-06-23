'use client'
import { PresetButtons } from './PresetButtons'
import { FeatureToggle } from './FeatureToggle'

// Plano B — horário de FUNCIONAMENTO (quando o bot ENVIA). Fora da janela, fica
// em silêncio. Opera sobre os campos operatingHoursEnabled/operatingHoursJson
// (preset OU override de destino), diferente da janela silenciosa global legada.

const TZ_OPTIONS = ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Recife', 'UTC']

function parseHours(json) {
  try { return { startHour: 8, endHour: 22, tz: 'America/Sao_Paulo', ...JSON.parse(json || '{}') } }
  catch { return { startHour: 8, endHour: 22, tz: 'America/Sao_Paulo' } }
}

const PRESETS = [
  { label: '🏪 Comercial', tone: 'safe', description: 'Envia 8h–22h — simula horário de loja.', build: h => ({ ...h, startHour: 8, endHour: 22 }) },
  { label: '🌆 Estendido', tone: 'medium', description: 'Envia 8h–0h — mais alcance no fim do dia.', build: h => ({ ...h, startHour: 8, endHour: 0 }) },
  { label: '⚡ Quase 24h', tone: 'aggressive', description: 'Envia 6h–2h — silêncio só de madrugada.', build: h => ({ ...h, startHour: 6, endHour: 2 }) },
]

export function OperatingHoursForm({ value, onChange, disabled }) {
  const enabled = !!value.operatingHoursEnabled
  const controlsDisabled = disabled || !enabled
  const h = parseHours(value.operatingHoursJson)
  const update = (patch) => onChange({ operatingHoursJson: JSON.stringify({ ...h, ...patch }) })
  const applyPreset = (presetValues) => onChange({ operatingHoursJson: JSON.stringify(presetValues) })

  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🕒 Horário de funcionamento</legend>
      <p className="text-xs text-gray-500 mb-3">
        Faixa de horas em que o bot ENVIA para este destino. Fora dela, fica em silêncio (como uma loja: aberto no horário, fechado fora). Desligado = envia 24h.
      </p>
      <FeatureToggle checked={enabled} onChange={checked => onChange({ operatingHoursEnabled: checked })} disabled={disabled} label="Alternar horário de funcionamento" />
      <div className={enabled ? '' : 'pointer-events-none opacity-50'} aria-disabled={!enabled}>
        <PresetButtons presets={PRESETS.map(p => ({ ...p, values: p.build(h) }))} onApply={applyPreset} disabled={controlsDisabled} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Abre (hora)</span>
            <input type="number" min={0} max={23} value={h.startHour}
              onChange={e => update({ startHour: Number(e.target.value) })}
              disabled={controlsDisabled}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Fecha (hora)</span>
            <input type="number" min={0} max={23} value={h.endHour}
              onChange={e => update({ endHour: Number(e.target.value) })}
              disabled={controlsDisabled}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Fuso horário</span>
            <select value={h.tz} onChange={e => update({ tz: e.target.value })}
              disabled={controlsDisabled}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50">
              {TZ_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </label>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Use 0 = meia-noite, 8 = 8h. Janela que cruza a meia-noite é suportada (ex.: abre 8h, fecha 0h).
        </p>
      </div>
    </fieldset>
  )
}
