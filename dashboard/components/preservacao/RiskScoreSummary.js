'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

export function RiskScoreSummary() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [recomputing, setRecomputing] = useState(false)

  async function load() {
    try {
      setError('')
      setData(await api.preservationRiskScore())
    } catch (e) { setError(e.message) }
  }

  useEffect(() => {
    let active = true
    setError('')
    api.preservationRiskScore()
      .then(d => { if (active) setData(d) })
      .catch(e => { if (active) setError(e.message) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function recompute() {
    setRecomputing(true)
    try { await api.preservationRiskScoreRecomputeAll(); await load() }
    catch (e) { setError(e.message) }
    finally { setRecomputing(false) }
  }

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">📊 Risco de denúncia</h3>
          <p className="text-xs text-gray-500">
            Score 0-100 estima a chance de cada canal ser denunciado, baseado em quantidade de posts vs seguidores e diversidade de fontes. Quanto menor, melhor.
          </p>
        </div>
        <button onClick={recompute} disabled={recomputing} className="text-xs text-green-700 hover:underline disabled:opacity-50">
          {recomputing ? 'Recalculando...' : 'Recalcular tudo'}
        </button>
      </header>
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState message="Carregando..." />}
      {data && (
        <>
          <p className="text-2xl font-bold text-gray-800">
            {data.avgScore ?? '—'}<span className="text-sm text-gray-400">/100</span>
          </p>
          <p className="text-xs text-gray-500 mb-3">Média entre {data.items?.length ?? 0} canais.</p>
          {data.items?.length > 0 && (
            <ul className="text-xs space-y-1">
              {data.items.map(it => (
                <li key={it.groupId} className="flex justify-between border-t border-gray-100 py-1">
                  <span className="text-gray-700">{it.name || it.waJid}</span>
                  <span className="font-mono text-gray-600">{it.score ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
