'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

export function SnapshotsList() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try { setError(''); const d = await api.preservationSnapshots(); setItems(d.items ?? []) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">📸 Snapshots dos canais</h3>
          <p className="text-xs text-gray-500">
            Todo dia o bot guarda uma foto do estado de cada canal de destino (nome, descrição, link). Útil pra investigar mudanças suspeitas.
          </p>
        </div>
        <button onClick={load} className="text-xs text-green-700 hover:underline">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!items && !error && <LoadingState message="Carregando..." />}
      {items && items.length === 0 && <p className="text-xs text-gray-500">Sem canais de destino.</p>}
      {items && items.length > 0 && (
        <ul className="text-xs space-y-1">
          {items.map(it => (
            <li key={it.groupId} className="flex justify-between border-t border-gray-100 py-1">
              <span className="text-gray-700 truncate max-w-xs">{it.name || it.waJid}</span>
              <span className="text-gray-500">{it.total} snapshots</span>
              <span className="text-gray-400">{it.lastSnapshotAt ? new Date(it.lastSnapshotAt).toLocaleDateString('pt-BR') : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
