'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState, EmptyState } from '@/components/States'

const STATUS_LABELS = {
  success: 'Oferta gerada',
  product_not_found: 'Produto não encontrado',
  invalid_input: 'Link inválido',
  error: 'Erro',
}

const STATUS_TONES = {
  success: 'bg-emerald-100 text-emerald-700',
  product_not_found: 'bg-amber-100 text-amber-700',
  invalid_input: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700',
}

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'success', label: 'Sucesso' },
  { value: 'product_not_found', label: 'Não encontrado' },
  { value: 'invalid_input', label: 'Link inválido' },
  { value: 'error', label: 'Erro' },
]

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

const formatRelative = (value) => {
  if (!value) return 'sem eventos ainda'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMs = Date.now() - date.getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'agora há pouco'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `há ${hours}h`
  return `há ${Math.round(hours / 24)}d`
}

function MetricCard({ label, value, helper, tone = 'bg-white' }) {
  return (
    <article className={`rounded-2xl p-5 shadow-sm ring-1 ring-gray-100 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-gray-900">{value}</p>
      {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
    </article>
  )
}

function StatusBadge({ status }) {
  const tone = STATUS_TONES[status] || 'bg-gray-100 text-gray-600'
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{STATUS_LABELS[status] || status}</span>
}

export default function TelegramAdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [admin, setAdmin] = useState(null)
  const [overview, setOverview] = useState(null)
  const [requests, setRequests] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')

  async function loadData(nextStatus = statusFilter) {
    setLoading(true)
    setError('')
    try {
      const [adminData, overviewData, requestsData] = await Promise.all([
        api.adminMe(),
        api.adminTelegramOverview().catch(() => null),
        api.adminTelegramRequests({ limit: 100, status: nextStatus }).catch(() => ({ requests: [] })),
      ])
      setAdmin(adminData)
      setOverview(overviewData)
      setRequests(Array.isArray(requestsData?.requests) ? requestsData.requests : [])
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as métricas do Telegram.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [adminData, overviewData, requestsData] = await Promise.all([
          api.adminMe(),
          api.adminTelegramOverview().catch(() => null),
          api.adminTelegramRequests({ limit: 100, status: 'all' }).catch(() => ({ requests: [] })),
        ])
        if (!active) return
        setAdmin(adminData)
        setOverview(overviewData)
        setRequests(Array.isArray(requestsData?.requests) ? requestsData.requests : [])
      } catch (err) {
        if (!active) return
        setError(err.message || 'Não foi possível carregar as métricas do Telegram.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  function applyStatus(next) {
    setStatusFilter(next)
    loadData(next)
  }

  if (loading && !admin) return <main className="min-h-screen bg-gray-50 p-6"><LoadingState message="Carregando métricas do Telegram..." /></main>
  if (!admin) return <main className="min-h-screen bg-gray-50 p-6"><Alert type="error" title="Bot do Telegram" message={error || 'Sessão inválida. Faça login novamente.'} /></main>

  const config = overview?.config || {}
  const totals = overview?.totals || {}
  const statusCounts = overview?.statusCounts || {}
  const platforms = Array.isArray(overview?.platforms) ? overview.platforms : []

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="sticky top-0 z-10 rounded-2xl border border-sky-100 bg-white/95 p-4 shadow-sm backdrop-blur flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Bot de ofertas · Telegram</p>
            <h1 className="text-3xl font-black text-gray-900">Telegram</h1>
            <p className="mt-1 text-sm text-gray-500">Métricas de geração de ofertas, plataformas e requisições recentes do bot.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => loadData()} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">Atualizar</button>
            <Link href="/admin" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-100">Voltar ao admin</Link>
          </div>
        </div>

        {error && <Alert type="warning" title="Falha ao carregar parte dos dados" message={error} />}

        {/* Status de configuração do bot */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-sm font-black uppercase tracking-wide text-gray-700">Configuração</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${config.tokenConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {config.tokenConfigured ? '✓ Token configurado' : '✕ Token ausente (TELEGRAM_OFFER_BOT_TOKEN)'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
              {config.openToAllChats ? 'Aberto a qualquer chat' : `${config.allowedChatCount} chat(s) autorizado(s)`}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
              Último evento: {formatRelative(overview?.lastEventAt)}
            </span>
          </div>
          {!config.tokenConfigured && (
            <p className="mt-3 text-xs text-red-600">Sem o token no <code>.env</code> o bot não sobe. Confira o processo PM2 <code>telegram-offer-bot</code> e o <code>.env</code> do ambiente.</p>
          )}
        </section>

        {/* Cards de métrica */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Ofertas (24h)" value={totals.count24h ?? 0} helper={`${totals.count7d ?? 0} nos últimos 7 dias`} />
          <MetricCard label="Total de requisições" value={totals.total ?? 0} helper={`${totals.distinctChats ?? 0} chats distintos`} />
          <MetricCard label="Taxa de sucesso" value={`${overview?.successRate ?? 0}%`} helper="entre tentativas de oferta" tone="bg-emerald-50" />
          <MetricCard label="Ofertas com foto" value={`${overview?.withImageRate ?? 0}%`} helper="dos sucessos com imagem" tone="bg-sky-50" />
        </section>

        {/* Breakdown por status */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Sucesso" value={statusCounts.success ?? 0} tone="bg-emerald-50" />
          <MetricCard label="Produto não encontrado" value={statusCounts.product_not_found ?? 0} tone="bg-amber-50" />
          <MetricCard label="Link inválido" value={statusCounts.invalid_input ?? 0} />
          <MetricCard label="Erros" value={statusCounts.error ?? 0} tone={(statusCounts.error ?? 0) > 0 ? 'bg-red-50' : 'bg-white'} />
        </section>

        {/* Plataformas */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-sm font-black uppercase tracking-wide text-gray-700">Plataformas (ofertas geradas)</h2>
          {platforms.length === 0 ? (
            <div className="mt-3"><EmptyState message="Nenhuma oferta gerada ainda." /></div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {platforms.map(item => (
                <span key={item.platform} className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-100">
                  {item.platform}
                  <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs font-black text-white">{item.count}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Requisições recentes */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-700">Requisições recentes</h2>
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => applyStatus(filter.value)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${statusFilter === filter.value ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="mt-4"><EmptyState message="Nenhuma requisição registrada para este filtro." /></div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2">Quando</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Plataforma</th>
                    <th className="px-3 py-2">Foto</th>
                    <th className="px-3 py-2">Link / detalhe</th>
                    <th className="px-3 py-2">Latência</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(row => (
                    <tr key={row.id} className="border-b border-gray-50 align-top hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{formatDateTime(row.createdAt)}</td>
                      <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                      <td className="px-3 py-2 text-gray-600">{row.platform || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{row.withImage ? '🖼️' : '—'}</td>
                      <td className="px-3 py-2 max-w-md truncate text-gray-600" title={row.errorMsg || row.inputUrl}>
                        {row.inputUrl}
                        {row.errorMsg && <span className="block text-xs text-red-500">{row.errorMsg}</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{row.latencyMs != null ? `${row.latencyMs} ms` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
