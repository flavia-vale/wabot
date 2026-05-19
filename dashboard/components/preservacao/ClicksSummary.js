'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

export function ClicksSummary() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try { setError(''); setData(await api.preservationClicks()) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">🔗 Cliques nos links</h3>
          <p className="text-xs text-gray-500">
            Cada link enviado pelo bot pode ter um endereço curto rastreável. Aqui aparece quantos cliques aconteceram na janela mais recente.
          </p>
        </div>
        <button onClick={load} className="text-xs text-green-700 hover:underline">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState message="Carregando..." />}
      {data && (
        <p className="text-xs text-gray-700">
          <strong>{data.total ?? 0}</strong> cliques nos últimos <strong>{data.days ?? 7}</strong> dias.
        </p>
      )}
    </section>
  )
}
