'use client'
import { useState } from 'react'

// "Intervalo entre destinos" (specs/018-unificar-protecao-anti-ban, User
// Story 4) — ex-"Atraso entre canais". Config de CONTA (channelStaggerJitterMs
// no banco), separada do ritmo por grupo/canal. FR-022 a FR-026: agora vale
// para GRUPO e canal, e a espera nunca trava a fila de envio (correção de
// causa raiz em src/core/destinationSpacing.js).
const MIN_SEC = 0
const MAX_SEC = 600

export function ChannelStaggerForm({ value, onChange, disabled }) {
  const seconds = typeof value.channelStaggerJitterMs === 'number'
    ? Math.round(value.channelStaggerJitterMs / 1000)
    : ''
  const [rascunho, setRascunho] = useState(null)
  const exibido = rascunho ?? seconds
  const foraDaFaixa = rascunho !== null && rascunho !== '' && (Number(rascunho) < MIN_SEC || Number(rascunho) > MAX_SEC)

  function handleChange(raw) {
    setRascunho(raw)
    if (raw === '') return
    const n = Number(raw)
    if (!Number.isFinite(n) || n < MIN_SEC || n > MAX_SEC) return // fora da faixa: nada é gravado
    onChange({ channelStaggerJitterMs: Math.round(n * 1000) })
    setRascunho(null)
  }

  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🎲 Intervalo entre destinos</legend>
      <p className="text-xs text-gray-500 mb-3">
        Esperar X segundos entre enviar para um grupo ou canal e enviar para o próximo.
      </p>
      <label className="block max-w-xs">
        <span className="text-xs font-medium text-gray-700">Segundos entre um destino e o próximo</span>
        <input
          type="number"
          min={MIN_SEC}
          max={MAX_SEC}
          value={exibido}
          onChange={e => handleChange(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
        />
        {foraDaFaixa ? (
          <span className="text-[11px] text-red-600 mt-1 block">
            Use um valor entre {MIN_SEC} e {MAX_SEC} segundos. Nada foi salvo com o valor fora da faixa.
          </span>
        ) : (
          <span className="text-[11px] text-gray-500 mt-1 block">
            Vale para grupos e canais. É diferente do tempo entre uma oferta e
            outra no mesmo grupo. Com muitos grupos, a oferta leva mais tempo
            para chegar ao último. 0 = sem espera extra.
          </span>
        )}
      </label>
    </fieldset>
  )
}
