'use client'

export function ImageMutationToggle({ value, onChange, disabled }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🖼️ Mutação de imagem</legend>
      <p className="text-xs text-gray-500 mb-3">
        Quando ligado, o bot corta 1 ou 2 pixels da borda e re-salva a imagem com qualidade levemente diferente. Isso muda o &quot;hash&quot; da imagem sem afetar visualmente, evitando filtros que detectam reenvio.
      </p>
      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value.imageMutationEnabled}
          onChange={e => onChange({ imageMutationEnabled: e.target.checked })}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
        />
        <span className="text-sm text-gray-700">Ativar mutação de imagem</span>
      </label>
    </fieldset>
  )
}
