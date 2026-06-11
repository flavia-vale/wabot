'use client'
import { FeatureToggle } from './FeatureToggle'

export function ImageMutationToggle({ value, onChange, disabled }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🖼️ Mutação de imagem</legend>
      <p className="text-xs text-gray-500 mb-3">
        Quando ligado, o bot corta 1 ou 2 pixels da borda e re-salva a imagem com qualidade levemente diferente. Isso muda o &quot;hash&quot; da imagem sem afetar visualmente, evitando filtros que detectam reenvio.
      </p>
      <FeatureToggle
        checked={!!value.imageMutationEnabled}
        onChange={checked => onChange({ imageMutationEnabled: checked })}
        disabled={disabled}
        label="Alternar mutação de imagem"
      />
    </fieldset>
  )
}
