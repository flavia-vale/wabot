'use client'
import { useMemo, useState } from 'react'

const EXAMPLE_POOL = JSON.stringify({
  greetings: ['', '🔥 ', '💥 ', '⚡ '],
  ctas: ['Confira:', 'Pega já:', 'Olha essa:', 'Não perde:'],
  trailers: ['', ' 👀', ' 💸', ' 🎯'],
}, null, 2)

function tryParse(text) {
  try { JSON.parse(text); return null } catch (e) { return e.message }
}

export function CopyVariationPoolEditor({ value, onChange, disabled }) {
  const current = value.copyVariationPoolJson ?? '{}'
  const parseError = useMemo(() => tryParse(current), [current])
  const [showExample, setShowExample] = useState(false)

  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🎲 Variações de texto</legend>
      <p className="text-xs text-gray-500 mb-3">
        Listas de pedacinhos de texto que o bot intercala em cada envio, pra mensagens nunca saírem 100% iguais. Quanto mais variações, mais natural.
      </p>
      <textarea
        value={current}
        onChange={e => onChange({ copyVariationPoolJson: e.target.value })}
        disabled={disabled}
        rows={10}
        className="w-full font-mono text-xs border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
      />
      {parseError && <p className="text-xs text-red-600 mt-1">JSON inválido: {parseError}</p>}
      <button type="button"
        onClick={() => { setShowExample(!showExample); if (!showExample) onChange({ copyVariationPoolJson: EXAMPLE_POOL }) }}
        disabled={disabled}
        className="mt-2 text-xs text-green-700 hover:underline">
        {showExample ? 'Ocultar exemplo' : 'Restaurar exemplo padrão'}
      </button>
      <p className="text-[11px] text-gray-500 mt-2">
        Formato: JSON com listas. Pelo menos uma string vazia (&quot;&quot;) em cada lista é recomendado, pra não forçar variação em todo envio.
      </p>
    </fieldset>
  )
}
