'use client'
import { PresetButtons } from './PresetButtons'

const PRESETS = [
  { label: '🛡️ Conservador', tone: 'safe', description: 'Pouquíssimas seguidas/dia — ideal pra contas recém-criadas.', values: { maxDailyFollows: 5 } },
  { label: '⚖️ Médio', tone: 'medium', description: 'Ritmo equilibrado pra contas já aquecidas.', values: { maxDailyFollows: 15 } },
  { label: '⚡ Leve', tone: 'aggressive', description: 'Crescimento mais rápido, com mais risco.', values: { maxDailyFollows: 30 } },
]

export function FollowGuardForm({ value, onChange, disabled }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">👣 Limite de seguidas por dia</legend>
      <p className="text-xs text-gray-500 mb-3">
        Quantos canais novos o bot pode começar a seguir em um único dia. Vai começando devagar pra contas novas — esse limite é o teto.
      </p>
      <PresetButtons presets={PRESETS} onApply={onChange} disabled={disabled} />
      <label className="block">
        <span className="text-xs font-medium text-gray-700">Máximo diário</span>
        <input
          type="number"
          min={1} max={50}
          value={value.maxDailyFollows ?? ''}
          onChange={e => onChange({ maxDailyFollows: Number(e.target.value) })}
          disabled={disabled}
          className="mt-1 w-full max-w-xs border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
        />
        <span className="text-[11px] text-gray-500 mt-1 block">
          Se o WhatsApp pedir pra esperar (rate limit), o bot pausa novas seguidas por 1 hora.
        </span>
      </label>
    </fieldset>
  )
}
