'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const PLATFORM_COLORS = {
  shopee:        'bg-orange-100 text-orange-700',
  amazon:        'bg-yellow-100 text-yellow-700',
  mercadolivre:  'bg-blue-100 text-blue-700',
  magazineluiza: 'bg-purple-100 text-purple-700',
  aliexpress:    'bg-red-100 text-red-700',
}

const STATUS_TABS = [
  ['all', 'Todos'],
  ['queued', 'Na fila'],
  ['sending', 'Enviando'],
  ['success', 'Sucesso'],
  ['error', 'Erros'],
]

const STATUS_META = {
  queued: {
    label: '⏳ Na fila',
    className: 'bg-slate-100 text-slate-600',
  },
  sending: {
    label: '↗ Enviando',
    className: 'bg-blue-100 text-blue-700',
  },
  success: {
    label: '✓ Enviado',
    className: 'bg-green-100 text-green-700',
  },
  error: {
    label: '✗ Erro',
    className: 'bg-red-100 text-red-700',
  },
}

const LIMIT = 20

function getStatusMeta(status) {
  return STATUS_META[status] ?? {
    label: status || 'Desconhecido',
    className: 'bg-gray-100 text-gray-600',
  }
}

function StatusBadge({ log }) {
  const meta = getStatusMeta(log.status)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
      title={log.errorMsg || meta.label}
    >
      {meta.label}
    </span>
  )
}

function formatSentAt(sentAt) {
  if (!sentAt) return '—'
  return new Date(sentAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function LogsPage() {
  const [tab, setTab] = useState('all')
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    let active = true
    async function loadLogs() {
      setLoading(true)
      setError('')
      try {
        const data = await api.logs(tab, page, LIMIT)
        if (!active) return
        setLogs(data.logs)
        setTotal(data.total)
      } catch (e) {
        if (active) setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadLogs()
    return () => { active = false }
  }, [tab, page])

  async function handleClear() {
    setError('')
    try {
      await api.logsClear()
      setPage(1)
      const data = await api.logs(tab, 1, LIMIT)
      setLogs(data.logs)
      setTotal(data.total)
    } catch (e) {
      setError(e.message)
    }
  }

  function changeTab(t) {
    setTab(t)
    setPage(1)
  }

  const totalPages = Math.ceil(total / LIMIT)
  const query = search.trim().toLowerCase()
  const filtered = logs.filter(log => !query || `${log.messageText || ''} ${log.sourceGroupName || ''} ${log.destGroupName || ''} ${log.platform || ''} ${getStatusMeta(log.status).label}`.toLowerCase().includes(query))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 Logs de Envio</h1>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="text-sm text-red-500 hover:text-red-700 transition"
        >
          Limpar logs
        </button>
      </div>

      <div className="flex gap-0 mb-4 border-b border-gray-200 overflow-x-auto">
        {STATUS_TABS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => changeTab(value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
              tab === value
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4"><ErrorState title="Falha ao carregar logs" message={error} /></div>}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por conteúdo, grupo, plataforma ou status"
        className="w-full mb-4 border rounded-lg px-3 py-2 text-sm"
      />

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState message="Nenhum log encontrado." />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {filtered.map(log => (
              <div key={`m-${log.id}`} className="bg-white rounded-xl shadow p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_COLORS[log.platform] || 'bg-gray-100 text-gray-600'}`}>{log.platform}</span>
                  <span className="text-xs text-gray-400">{formatSentAt(log.sentAt)}</span>
                </div>
                <p className="text-gray-700 mt-2"><strong>Origem:</strong> {log.sourceGroupName}</p>
                <p className="text-gray-700"><strong>Destino:</strong> {log.destGroupName}</p>
                <p className="text-gray-600 truncate" title={log.messageText}>{log.messageText}</p>
                <div className="mt-2"><StatusBadge log={log} /></div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
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
                {filtered.map(log => (
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
                      <StatusBadge log={log} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {formatSentAt(log.sentAt)}
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
      <ConfirmDialog open={showClearConfirm} title="Limpar logs" message="Todos os registros serão apagados permanentemente." confirmLabel="Limpar agora" danger onCancel={() => setShowClearConfirm(false)} onConfirm={async () => { setShowClearConfirm(false); await handleClear() }} />
    </div>
  )
}
