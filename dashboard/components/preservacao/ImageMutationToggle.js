'use client'
import { FeatureToggle } from './FeatureToggle'

export function ImageMutationToggle({ value, onChange, disabled }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🖼️ Variação leve da imagem</legend>
      <p className="text-xs text-gray-500 mb-3">
        Mudar levemente a foto em cada envio para os canais — o bot corta 1 ou 2 pixels da borda e salva de novo com qualidade levemente diferente. Isso não muda o que se vê, só evita que a imagem pareça idêntica a um reenvio anterior. Vale tanto para canais quanto para grupos de destino.
      </p>
      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
        ⚠️ Por enquanto este recurso <strong>não se aplica às mensagens espelhadas</strong> (encaminhamento ao vivo de um grupo monitorado para outro grupo, que reaproveita a imagem original). Atua nas imagens re-processadas — ofertas automáticas, envios em massa e agendados.
      </p>
      <FeatureToggle
        checked={!!value.imageMutationEnabled}
        onChange={checked => onChange({ imageMutationEnabled: checked })}
        disabled={disabled}
        label="Alternar variação leve da imagem"
      />
    </fieldset>
  )
}
