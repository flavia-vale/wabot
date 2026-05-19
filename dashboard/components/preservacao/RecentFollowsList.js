'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

const STATUS_PT = { ok: '✅ Seguido', failed: '❌ Falhou', rate_limited: '⏳ Limite', pending: '⏳ Em fila' }

export function RecentFollowsList() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try { setError(''); const d = await api.preservationFollows(20); setItems(d.items ?? []) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">👣 Últimos follows</h3>
          <p className="text-xs text-gray-500">
            Lista dos canais que o bot tentou seguir. &quot;Limite&quot; indica que o WhatsApp pediu pra esperar — o bot espera 1h antes de tentar de novo.
          </p>
        </div>
        <button onClick={load} className="text-xs text-green-700 hover:underline">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!items && !error && <LoadingState message="Carregando..." />}
      {items && items.length === 0 && <p className="text-xs text-gray-500">Sem follows registrados ainda.</p>}
      {items && items.length > 0 && (
        <ul className="text-xs space-y-1">
          {items.map(f => (
            <li key={f.id} className="flex justify-between border-t border-gray-100 py-1">
              <span className="text-gray-700 truncate max-w-xs">{f.channelJid}</span>
              <span className="text-gray-500">{STATUS_PT[f.status] ?? f.status}</span>
              <span className="text-gray-400">{new Date(f.followedAt).toLocaleString('pt-BR')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
