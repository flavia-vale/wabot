'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'
import { describeChannelHealthStatus } from '../../../src/core/channelHealth.js'

export function HealthOverview() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      setError('')
      const data = await api.preservationHealth()
      setItems(data.items ?? [])
    } catch (e) { setError(e.message) }
  }

  useEffect(() => {
    let active = true
    api.preservationHealth()
      .then(data => { if (active) setItems(data.items ?? []) })
      .catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [])

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="mb-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">🩺 Saúde dos canais</h3>
          <p className="break-words text-xs text-gray-500">
            Cada canal de destino tem um status: verde envia normal, amarelo está com falhas, vermelho está pausado pelo bot, cinza sem dados ainda.
          </p>
        </div>
        <button onClick={load} className="min-h-11 rounded-lg px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 hover:underline sm:min-h-0 sm:px-0 sm:py-0">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!items && !error && <LoadingState message="Carregando saúde..." />}
      {items && items.length === 0 && <p className="text-xs text-gray-500">Sem canais de destino configurados.</p>}
      {items && items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map(it => {
            const desc = describeChannelHealthStatus(it.health)
            return (
              <li key={it.groupId} className="rounded-xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-700 text-xs break-words">{it.name || it.waJid}</span>
                  <span className="text-xs font-semibold whitespace-nowrap">{desc.emoji} {desc.label}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">{desc.motivo}</p>
                {desc.oQueFazer !== 'Nada a fazer.' && (
                  <p className="text-[11px] text-gray-700 mt-0.5"><strong>O que fazer:</strong> {desc.oQueFazer}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
