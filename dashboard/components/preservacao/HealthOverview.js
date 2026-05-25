'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

const STATUS_LABEL = { green: '🟢 Saudável', yellow: '🟡 Atenção', red: '🔴 Pausado', gray: '⚫ Sem dados' }

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
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">🩺 Saúde dos canais</h3>
          <p className="text-xs text-gray-500">
            Cada canal de destino tem um status: verde envia normal, amarelo está com falhas, vermelho está pausado pelo bot, cinza sem dados ainda.
          </p>
        </div>
        <button onClick={load} className="text-xs text-green-700 hover:underline">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!items && !error && <LoadingState message="Carregando saúde..." />}
      {items && items.length === 0 && <p className="text-xs text-gray-500">Sem canais de destino configurados.</p>}
      {items && items.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-gray-500 text-left">
            <tr><th className="py-1">Canal</th><th>Status</th><th>Última falha</th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.groupId} className="border-t border-gray-100">
                <td className="py-1.5 pr-2 font-medium text-gray-700">{it.name || it.waJid}</td>
                <td>{STATUS_LABEL[it.health?.status ?? 'gray'] ?? '⚫ Sem dados'}</td>
                <td className="text-gray-500">{it.health?.lastFailureAt ? new Date(it.health.lastFailureAt).toLocaleString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
