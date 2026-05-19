'use client'

const FIELDS = [
  { key: 'channelMinIntervalSec', label: 'Intervalo mínimo entre envios (segundos)', hint: 'Tempo mínimo antes de enviar 2 mensagens seguidas no MESMO canal.', min: 1, max: 86400 },
  { key: 'channelBurstCap',        label: 'Limite por janela de rajada',              hint: 'Máximo de envios em uma janela curta de tempo (controle anti-flood).', min: 1, max: 1000 },
  { key: 'channelBurstWindowSec',  label: 'Janela da rajada (segundos)',              hint: 'Tamanho da janela usada pelo limite acima. Ex: 600 = 10 minutos.', min: 60, max: 86400 },
  { key: 'channelDailyCap',        label: 'Limite diário (envios/dia)',               hint: 'Máximo de envios em um dia inteiro para um canal. Deixe vazio para sem limite.', min: 1, max: 10000, nullable: true },
  { key: 'channelStaggerJitterMs', label: 'Jitter entre canais (ms)',                 hint: 'Pequeno atraso aleatório entre canais diferentes pra parecer humano. 90000 = até 90 segundos.', min: 0, max: 600000 },
]

export function ThrottleForm({ value, onChange, disabled }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">⏱️ Espaçamento entre canais</legend>
      <p className="text-xs text-gray-500 mb-3">
        Controla a velocidade com que o bot dispara mensagens. Defaults seguros vêm pré-preenchidos.
      </p>
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
