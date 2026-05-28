'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingState, ErrorState } from '@/components/States'

const STATE_LABEL = {
  disconnected: 'Desconectada',
  connecting: 'Conectando',
  qr_pending: 'Aguardando QR',
  connected: 'Conectada',
  error: 'Erro',
}

export function ProbeStatus() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try { setError(''); setData(await api.preservationProbe()) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => {
    let active = true
    api.preservationProbe()
      .then(d => { if (active) setData(d) })
      .catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [])

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">🔭 Observador externo</h3>
          <p className="text-xs text-gray-500">
            A conta observadora confirma entrega por canal e expõe latência de confirmação para identificar risco antes de queda total.
          </p>
        </div>
        <button onClick={load} className="text-xs text-green-700 hover:underline">Atualizar</button>
      </header>
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState message="Carregando..." />}
      {data && (
        <>
          <p className="text-xs text-gray-700 mb-2">
            Estado: <strong>{data.enabled ? 'Ativado' : 'Desativado'}</strong>
            <span className="ml-2 text-gray-500">Sessão: {STATE_LABEL[data.sessionState] || 'Desconhecida'}</span>
          </p>
          {data.items?.length > 0 && (
            <ul className="text-xs space-y-1">
              {data.items.map(it => (
                <li key={it.groupId} className="border-t border-gray-100 py-1">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-700 truncate max-w-xs">{it.name || it.waJid}</span>
                    <span className="text-gray-400">{it.lastProbeSeenAt ? `visto ${new Date(it.lastProbeSeenAt).toLocaleString('pt-BR')}` : 'nunca'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Latência: {it.lastLatencyMs != null ? `${Math.round(it.lastLatencyMs / 1000)}s` : '—'} · misses 24h: {it.misses24h ?? 0}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
