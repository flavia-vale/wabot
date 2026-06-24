'use client'

// Plano B / Fase 3: o "atraso entre canais" (channelStaggerJitterMs) é uma
// config de CONTA dedicada — separada da cadência anti-ban, que agora vive por
// destino (presets). Aplica sempre que houver jitter configurado; 0 desliga.
export function ChannelStaggerForm({ value, onChange, disabled }) {
  const seconds = typeof value.channelStaggerJitterMs === 'number'
    ? Math.round(value.channelStaggerJitterMs / 1000)
    : ''
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🎲 Atraso entre canais</legend>
      <p className="text-xs text-gray-500 mb-3">
        Quando uma mesma oferta vai para vários canais de uma vez, o bot dá uma
        espera curta e aleatória entre um canal e outro, pra não disparar tudo no
        mesmo segundo (parece mais humano). Vale para todos os canais da conta.
      </p>
      <label className="block max-w-xs">
        <span className="text-xs font-medium text-gray-700">Espera máxima entre canais (segundos)</span>
        <input
          type="number"
          min={0}
          max={600}
          value={seconds}
          onChange={e => {
            if (e.target.value === '') return onChange({ channelStaggerJitterMs: 0 })
            onChange({ channelStaggerJitterMs: Math.round(Number(e.target.value) * 1000) })
          }}
          disabled={disabled}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
        />
        <span className="text-[11px] text-gray-500 mt-1 block">
          Ex.: 90 = o bot espera de 0 a 90 segundos antes de cada canal seguinte. 0 = sem espera.
        </span>
      </label>
    </fieldset>
  )
}
