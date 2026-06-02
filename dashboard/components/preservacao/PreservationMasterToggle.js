'use client'

export function PreservationMasterToggle({ value, onChange, disabled }) {
  const enabled = !!value.preservationEnabled
  return (
    <fieldset className={`rounded-2xl shadow p-5 border-2 ${enabled ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
      <legend className="text-base font-semibold text-gray-800">🛡️ Módulo de Preservação Avançada</legend>
      <p className="text-xs text-gray-500 mb-3">
        Interruptor mestre das defesas anti-banimento. Quando <strong>ligado</strong>, aplica throttle entre canais, espaçamento humano, variação de texto, mutação de imagem, snapshots e follow-guard. Quando <strong>desligado</strong>, nenhum desses controles roda — os envios saem sem proteção.
      </p>
      <div className="inline-flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Alternar Módulo de Preservação Avançada"
          disabled={disabled}
          onClick={() => onChange({ preservationEnabled: !enabled })}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${enabled ? 'border-green-500 bg-green-500 shadow-sm shadow-green-200' : 'border-gray-300 bg-gray-200'}`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {enabled ? 'Preservação ativa' : 'Preservação desligada'}
        </span>
      </div>
      {!enabled && (
        <p className="mt-2 text-xs text-amber-600">
          Os ajustes abaixo só passam a valer depois que você ligar o módulo.
        </p>
      )}
    </fieldset>
  )
}
