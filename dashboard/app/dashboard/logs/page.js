'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

const PLATFORM_COLORS = {
  shopee:        'bg-orange-100 text-orange-700',
  amazon:        'bg-yellow-100 text-yellow-700',
  mercadolivre:  'bg-blue-100 text-blue-700',
  magazineluiza: 'bg-purple-100 text-purple-700',
  aliexpress:    'bg-red-100 text-red-700',
}

const LIMIT = 20

export default function LogsPage() {
  const [tab, setTab] = useState('all')
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.logs(tab, page, LIMIT)
      setLogs(data.logs)
      setTotal(data.total)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => { load() }, [load])

  async function handleClear() {
    if (!confirm('Limpar todos os logs? Esta ação não pode ser desfeita.')) return
    setError('')
    try {
      await api.logsClear()
      setPage(1)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  function changeTab(t) {
    setTab(t)
    setPage(1)
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 Logs de Envio</h1>
        <button
          onClick={handleClear}
          className="text-sm text-red-500 hover:text-red-700 transition"
        >
          Limpar logs
        </button>
      </div>

      <div className="flex gap-0 mb-4 border-b border-gray-200">
        {[['all', 'Todos'], ['success', 'Sucesso'], ['error', 'Erros']].map(([value, label]) => (
          <button
            key={value}
            onClick={() => changeTab(value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === value
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum log encontrado.</p>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Plataforma</th>
                  <th className="text-left px-4 py-3">Origem</th>
                  <th className="text-left px-4 py-3">Destino</th>
                  <th className="text-left px-4 py-3">Preview</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_COLORS[log.platform] || 'bg-gray-100 text-gray-600'}`}>
                        {log.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate" title={log.sourceGroupName}>
                      {log.sourceGroupName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate" title={log.destGroupName}>
                      {log.destGroupName}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={log.messageText}>
                      {log.messageText}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.status === 'success' ? (
                        <span className="text-green-600 font-medium">✓ Enviado</span>
                      ) : (
                        <span className="text-red-500 font-medium" title={log.errorMsg || ''}>
                          ✗ Erro
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {new Date(log.sentAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>{total} registro{total !== 1 ? 's' : ''}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span>{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Próxima →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
