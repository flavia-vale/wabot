'use client'
import { PresetButtons } from './PresetButtons'

const FIELDS = [
  { key: 'channelMinIntervalSec', label: 'Intervalo mínimo entre envios (segundos)', hint: 'Tempo mínimo antes de enviar 2 mensagens seguidas no MESMO canal.', min: 1, max: 86400 },
  { key: 'channelBurstCap',        label: 'Máximo de envios em um período curto',     hint: 'Quantos envios o bot pode disparar num intervalo curto (anti-flood). Ex: 6 envios em 10 minutos.', min: 1, max: 1000 },
  { key: 'channelBurstWindowSec',  label: 'Duração do período curto (segundos)',      hint: 'Tamanho do intervalo que conta para o limite acima. Ex: 600 = 10 minutos.', min: 60, max: 86400 },
  { key: 'channelDailyCap',        label: 'Limite diário (envios/dia)',               hint: 'Máximo de envios em um dia inteiro para um canal. Deixe vazio para sem limite.', min: 1, max: 10000, nullable: true },
  { key: 'channelStaggerJitterMs', label: 'Atraso aleatório entre canais (ms)',       hint: 'Pequena espera aleatória entre canais diferentes pra parecer humano. 90000 = até 90 segundos.', min: 0, max: 600000 },
]

const PRESETS = [
  {
    label: '🛡️ Conservador',
    tone: 'safe',
    description: 'Mais lento e seguro — recomendado pra contas novas ou que já levaram aviso.',
    values: {
      channelMinIntervalSec: 120,
      channelBurstCap: 3,
      channelBurstWindowSec: 600,
      channelDailyCap: 80,
      channelStaggerJitterMs: 120000,
    },
  },
  {
    label: '⚖️ Médio',
    tone: 'medium',
    description: 'Equilíbrio entre velocidade e segurança. Bom default para contas já aquecidas.',
    values: {
      channelMinIntervalSec: 60,
      channelBurstCap: 6,
      channelBurstWindowSec: 600,
      channelDailyCap: 150,
      channelStaggerJitterMs: 90000,
    },
  },
  {
    label: '⚡ Leve',
    tone: 'aggressive',
    description: 'Mais rápido, com mais risco. Use só se a conta está estável há semanas.',
    values: {
      channelMinIntervalSec: 30,
      channelBurstCap: 10,
      channelBurstWindowSec: 600,
      channelDailyCap: 300,
      channelStaggerJitterMs: 45000,
    },
  },
]

export function ThrottleForm({ value, onChange, disabled }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">⏱️ Espaçamento entre canais</legend>
      <p className="text-xs text-gray-500 mb-3">
        Controla a velocidade com que o bot dispara mensagens. Defaults seguros vêm pré-preenchidos.
      </p>
      <PresetButtons presets={PRESETS} onApply={onChange} disabled={disabled} hint="clique pra aplicar um perfil" />
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(f => (
          <label key={f.key} className="block">
            <span className="text-xs font-medium text-gray-700">{f.label}</span>
            <input
              type="number"
              min={f.min} max={f.max}
              value={value[f.key] ?? ''}
              onChange={e => onChange({ [f.key]: f.nullable && e.target.value === '' ? null : Number(e.target.value) })}
              disabled={disabled}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
            />
            <span className="text-[11px] text-gray-500 mt-1 block">{f.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
