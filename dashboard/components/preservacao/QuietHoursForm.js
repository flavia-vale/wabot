'use client'

const TZ_OPTIONS = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Recife',
  'UTC',
]

function parseQuiet(json) {
  try { return { startHour: 0, endHour: 6, tz: 'America/Sao_Paulo', ...JSON.parse(json || '{}') } }
  catch { return { startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' } }
}

export function QuietHoursForm({ value, onChange, disabled }) {
  const q = parseQuiet(value.channelQuietHoursJson)
  const update = (patch) => onChange({ channelQuietHoursJson: JSON.stringify({ ...q, ...patch }) })

  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🌙 Janela silenciosa</legend>
      <p className="text-xs text-gray-500 mb-3">
        Faixa de horas em que o bot PAUSA envios pra canais. Ideal pra simular um humano que dorme. Ex: 0h a 6h da manhã.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Início (hora)</span>
          <input type="number" min={0} max={23}
            value={q.startHour}
            onChange={e => update({ startHour: Number(e.target.value) })}
            disabled={disabled}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Fim (hora)</span>
          <input type="number" min={0} max={23}
            value={q.endHour}
            onChange={e => update({ endHour: Number(e.target.value) })}
            disabled={disabled}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Fuso horário</span>
          <select value={q.tz}
            onChange={e => update({ tz: e.target.value })}
            disabled={disabled}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50">
            {TZ_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </label>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        Use 0 = meia-noite, 6 = 6h da manhã. O bot retoma envios automaticamente ao final da janela.
      </p>
    </fieldset>
  )
}
