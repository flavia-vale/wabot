'use client'
import { PresetButtons } from './PresetButtons'
import { FeatureToggle } from './FeatureToggle'

// Plano B — limites anti-ban POR DESTINO (preset ou override). Opera sobre
// throttleEnabled/minIntervalSec/burstCap/burstWindowSec/dailyCap (≠ campos
// channel* da config global legada).

const FIELDS = [
  { key: 'minIntervalSec', label: 'Intervalo mínimo entre envios (segundos)', hint: 'Tempo mínimo entre 2 mensagens seguidas neste destino.', min: 1, max: 86400 },
  { key: 'burstCap', label: 'Máximo de envios na janela', hint: 'Quantos envios cabem dentro da janela de rajada (anti-flood).', min: 1, max: 1000 },
  { key: 'burstWindowSec', label: 'Janela de rajada (segundos)', hint: 'Tamanho da janela do limite acima. Ex.: 600 = 10 minutos.', min: 60, max: 86400 },
  { key: 'dailyCap', label: 'Limite diário (envios/dia)', hint: 'Máximo por dia. Vazio = sem limite.', min: 1, max: 10000, nullable: true },
]

const PRESETS = [
  { label: '🛡️ Conservador', tone: 'safe', description: 'Lento e seguro — contas novas ou que levaram aviso.', values: { minIntervalSec: 120, burstCap: 3, burstWindowSec: 3600, dailyCap: 80 } },
  { label: '⚖️ Médio', tone: 'medium', description: 'Equilíbrio — bom default para contas aquecidas.', values: { minIntervalSec: 60, burstCap: 6, burstWindowSec: 3600, dailyCap: 150 } },
  { label: '⚡ Leve', tone: 'aggressive', description: 'Mais rápido, mais risco. Só se estável há semanas.', values: { minIntervalSec: 30, burstCap: 10, burstWindowSec: 3600, dailyCap: 300 } },
]

export function PreservationLimitsForm({ value, onChange, disabled }) {
  const enabled = value.throttleEnabled !== false
  const controlsDisabled = disabled || !enabled
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">⏱️ Limites anti-ban</legend>
      <p className="text-xs text-gray-500 mb-3">
        Controla a cadência de envio para proteger a conta. Defaults seguros já vêm preenchidos.
      </p>
      <FeatureToggle checked={enabled} onChange={checked => onChange({ throttleEnabled: checked })} disabled={disabled} label="Alternar limites anti-ban" />
      <div className={enabled ? '' : 'pointer-events-none opacity-50'} aria-disabled={!enabled}>
        <PresetButtons presets={PRESETS} onApply={onChange} disabled={controlsDisabled} hint="clique pra aplicar um perfil" />
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(f => (
            <label key={f.key} className="block">
              <span className="text-xs font-medium text-gray-700">{f.label}</span>
              <input type="number" min={f.min} max={f.max}
                value={value[f.key] ?? ''}
                onChange={e => {
                  if (f.nullable && e.target.value === '') return onChange({ [f.key]: null })
                  onChange({ [f.key]: Number(e.target.value) })
                }}
                disabled={controlsDisabled}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
              <span className="text-[11px] text-gray-500 mt-1 block">{f.hint}</span>
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  )
}
