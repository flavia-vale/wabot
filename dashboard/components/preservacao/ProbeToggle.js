'use client'

import Link from 'next/link'

export function ProbeToggle({ value, onChange, disabled, probeAccountSessionId }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🔭 Probe externo</legend>
      <p className="text-xs text-gray-500 mb-3">
        Uma segunda conta WhatsApp conectada como observadora confere se suas mensagens chegam nos canais de destino. Se não chega, o bot marca o canal em estado de alerta.
      </p>
      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value.probeEnabled}
          onChange={e => onChange({ probeEnabled: e.target.checked })}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
        />
        <span className="text-sm text-gray-700">Ativar observador externo</span>
      </label>
      <p className="text-[11px] text-gray-500 mt-2">
        Conta probe configurada no servidor: <span className="font-mono">{probeAccountSessionId ?? 'nenhuma'}</span>.
        Pra trocar, fale com o suporte.
      </p>
    </fieldset>
  )
}
