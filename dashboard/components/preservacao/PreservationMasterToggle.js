'use client'

export function PreservationMasterToggle({ value, onChange, disabled }) {
  const enabled = !!value.preservationEnabled
  return (
    <fieldset className={`rounded-2xl shadow p-5 border-2 ${enabled ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
      <legend className="text-base font-semibold text-gray-800">🛡️ Módulo de Preservação Avançada</legend>
      <p className="text-xs text-gray-500 mb-3">
        Interruptor mestre das defesas anti-banimento. Quando <strong>ligado</strong>, aplica throttle entre canais, espaçamento humano, variação de texto, mutação de imagem, snapshots e follow-guard. Quando <strong>desligado</strong>, nenhum desses controles roda — os envios saem sem proteção.
      </p>
      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onChange({ preservationEnabled: e.target.checked })}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
        />
        <span className="text-sm font-medium text-gray-700">
          {enabled ? 'Preservação ativa' : 'Preservação desligada'}
        </span>
      </label>
      {!enabled && (
        <p className="mt-2 text-xs text-amber-600">
          Os ajustes abaixo só passam a valer depois que você ligar o módulo.
        </p>
      )}
    </fieldset>
  )
}
