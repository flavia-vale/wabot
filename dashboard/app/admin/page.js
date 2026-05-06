'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const STAT_LABELS = {
  totalUsers: 'Clientes totais',
  activeUsers: 'Clientes ativos',
  usersWithoutPhone: 'Sem celular',
  paidActiveUsers: 'Pagos ativos',
  expiringInSevenDays: 'Expiram em 7 dias',
  staleOperationalUsers: 'Pagos parados 48h',
  pendingPayments: 'Pagamentos pendentes',
  revenue30d: 'Receita 30d',
  messages24h: 'Envios 24h',
  errors24h: 'Erros 24h',
  successRate24h: 'Sucesso 24h (%)',
  connectedSessions: 'WhatsApp conectados',
  botRunningUsers: 'Bots rodando',
  missingCredentials: 'Sem credenciais',
  usersMissingMonitorGroup: 'Sem grupo origem',
  usersMissingPostGroup: 'Sem grupo destino',
}

const RISK_LABELS = {
  missing_phone: 'Sem celular',
  suspended: 'Suspenso',
  banned: 'Banido',
  expired: 'Expirado',
  expiring_soon: 'Expira em 7d',
  paid_stale_48h: 'Pago parado 48h',
  bot_not_running: 'Bot parado',
  wa_disconnected: 'WhatsApp off',
  no_credentials: 'Sem credenciais',
  no_monitor_group: 'Sem origem',
  no_post_group: 'Sem destino',
  no_success_log: 'Sem sucesso',
  high_errors_24h: 'Muitos erros',
}

const RISK_FILTERS = [
  ['', 'Todos'],
  ['stale', 'Parados 48h'],
  ['missing_phone', 'Sem celular'],
  ['expiring_soon', 'Expiram em 7d'],
  ['missing_credentials', 'Sem credenciais'],
  ['missing_monitor', 'Sem origem'],
  ['missing_post', 'Sem destino'],
]

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))
}

function statValue(key, value) {
  if (key === 'revenue30d') return formatCurrency(value)
  if (key === 'successRate24h') return value === null || value === undefined ? '—' : `${value}%`
  return value ?? '—'
}

function RiskBadges({ flags = [] }) {
  if (!flags.length) return <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-bold text-green-700">OK</span>
  return (
    <div className="flex flex-wrap gap-1">
      {flags.slice(0, 4).map(flag => (
        <span key={flag} className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700">{RISK_LABELS[flag] ?? flag}</span>
      ))}
      {flags.length > 4 && <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600">+{flags.length - 4}</span>}
    </div>
  )
}

function DetailPanel({ detail, onClose }) {
  if (!detail) return null
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Drill-down do cliente</p>
          <h2 className="text-xl font-black text-gray-900">{detail.email}</h2>
          <p className="text-sm text-gray-500">{detail.contactPhone || 'Sem celular'} · {detail.plan} · {detail.accessStatus}</p>
        </div>
        <button onClick={onClose} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200">Fechar</button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">LTV</p><p className="text-lg font-black">{formatCurrency(detail.ltv)}</p></div>
        <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Bot</p><p className="text-lg font-black">{detail.botRunning ? 'Rodando' : 'Parado'}</p></div>
        <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">WhatsApp</p><p className="text-lg font-black">{detail.waSession?.status || '—'}</p></div>
        <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Erros 24h</p><p className="text-lg font-black">{detail.errorCount24h}</p></div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-800">Riscos</h3>
          <RiskBadges flags={detail.riskFlags} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-800">Configuração</h3>
          <p className="text-sm text-gray-600">Origem: {detail.groupCounts?.monitor ?? 0} · Destino: {detail.groupCounts?.post ?? 0} · Credenciais: {detail.credentials?.length ?? 0}</p>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-800">Atividade</h3>
          <p className="text-sm text-gray-600">Última atividade: {formatDate(detail.lastActivityAt)}</p>
          <p className="text-sm text-gray-600">Expiração: {formatDate(detail.trialExpiresAt)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-800">Pagamentos recentes</h3>
          <div className="space-y-2">
            {(detail.payments || []).slice(0, 5).map(payment => (
              <div key={payment.id} className="rounded-xl border border-gray-100 p-3 text-xs text-gray-600">
                <span className="font-bold text-gray-900">{payment.status}</span> · {payment.plan} · {formatCurrency(payment.amount)} · {formatDate(payment.createdAt)}
              </div>
            ))}
            {!detail.payments?.length && <p className="text-sm text-gray-400">Sem pagamentos.</p>}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-800">Últimos logs</h3>
          <div className="space-y-2">
            {(detail.recentLogs || []).slice(0, 5).map(log => (
              <div key={log.id} className="rounded-xl border border-gray-100 p-3 text-xs text-gray-600">
                <span className={`font-bold ${log.status === 'error' ? 'text-red-600' : 'text-green-700'}`}>{log.status}</span> · {log.platform} · {formatDate(log.sentAt)}
                {log.errorMsg && <p className="mt-1 text-red-500">{log.errorMsg}</p>}
              </div>
            ))}
            {!detail.recentLogs?.length && <p className="text-sm text-gray-400">Sem logs.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function AdminPage() {
  const [overview, setOverview] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [users, setUsers] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [logs, setLogs] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [risk, setRisk] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadAdminData(nextRisk = risk, nextSearch = search) {
    setError('')
    const [adminData, overviewData, usersData, sessionsData, logsData] = await Promise.all([
      api.adminMe(),
      api.adminOverview(),
      api.adminUsers({ risk: nextRisk, search: nextSearch, limit: 20 }),
      api.adminSessions({ limit: 10 }),
      api.adminLogs({ limit: 10, status: 'all' }),
    ])
    setAdmin(adminData)
    setOverview(overviewData)
    setUsers(usersData)
    setSessions(sessionsData)
    setLogs(logsData)
  }

  useEffect(() => {
    let active = true
    Promise.all([
      api.adminMe(),
      api.adminOverview(),
      api.adminUsers({ limit: 20 }),
      api.adminSessions({ limit: 10 }),
      api.adminLogs({ limit: 10, status: 'all' }),
    ])
      .then(([adminData, overviewData, usersData, sessionsData, logsData]) => {
        if (!active) return
        setAdmin(adminData)
        setOverview(overviewData)
        setUsers(usersData)
        setSessions(sessionsData)
        setLogs(logsData)
      })
      .catch((err) => { if (active) setError(err.message || 'Não foi possível carregar o painel admin.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const atRiskUsers = useMemo(() => users?.users?.filter(user => user.riskFlags?.length) ?? [], [users])

  async function applyFilters(e) {
    e?.preventDefault()
    setLoading(true)
    try {
      await loadAdminData(risk, search)
    } catch (err) {
      setError(err.message || 'Falha ao aplicar filtros.')
    } finally {
      setLoading(false)
    }
  }

  async function openUserDetail(id) {
    setError('')
    try {
      setSelectedUser(await api.adminUserDetail(id))
    } catch (err) {
      setError(err.message || 'Falha ao carregar cliente.')
    }
  }

  if (loading) return <LoadingState />

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Visão operacional · Etapa 2</p>
            <h1 className="text-3xl font-black text-gray-900">Admin Wabot</h1>
            <p className="mt-1 text-sm text-gray-500">Cockpit executivo, clientes em risco, sessões, logs e drill-down operacional.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => applyFilters()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Atualizar</button>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-100">Voltar ao painel</Link>
          </div>
        </div>

        {error && <Alert type="error" title="Painel admin" message={error} />}

        {admin && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="text-sm font-bold text-gray-800">Sessão admin</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">Role: {admin.role}</span>
              {admin.bootstrap && <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">Bootstrap via ADMIN_EMAILS</span>}
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">Permissões: {admin.permissions?.length ?? 0}</span>
            </div>
          </section>
        )}

        {overview && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(STAT_LABELS).map(([key, label]) => (
              <article key={key} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                <p className="mt-2 text-3xl font-black text-gray-900">{statValue(key, overview[key])}</p>
              </article>
            ))}
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-gray-900">Gestão de clientes</h2>
              <p className="text-sm text-gray-500">{users?.total ?? 0} clientes encontrados · {atRiskUsers.length} com alertas nesta página</p>
            </div>
            <form onSubmit={applyFilters} className="flex flex-col gap-2 sm:flex-row">
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por email" className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
              <select value={risk} onChange={event => setRisk(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400">
                {RISK_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">Filtrar</button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Plano</th>
                  <th className="px-3 py-2">Operação</th>
                  <th className="px-3 py-2">Atividade</th>
                  <th className="px-3 py-2">Riscos</th>
                  <th className="px-3 py-2">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(users?.users ?? []).map(user => (
                  <tr key={user.id} className="align-top">
                    <td className="px-3 py-3">
                      <p className="font-bold text-gray-900">{user.email}</p>
                      <p className="text-xs text-gray-500">{user.contactPhone || 'Sem celular'} · {user.status}</p>
                    </td>
                    <td className="px-3 py-3"><p className="font-semibold">{user.plan}</p><p className="text-xs text-gray-500">{user.accessStatus}</p></td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      <p>Bot: {user.botRunning ? 'rodando' : 'parado'}</p>
                      <p>WA: {user.waSession?.status || '—'}</p>
                      <p>Origem/Destino: {user.groupCounts?.monitor ?? 0}/{user.groupCounts?.post ?? 0}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      <p>Última: {formatDate(user.lastActivityAt)}</p>
                      <p>Erros 24h: {user.errorCount24h}</p>
                    </td>
                    <td className="px-3 py-3"><RiskBadges flags={user.riskFlags} /></td>
                    <td className="px-3 py-3"><button onClick={() => openUserDetail(user.id)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Drill-down</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <DetailPanel detail={selectedUser} onClose={() => setSelectedUser(null)} />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-lg font-black text-gray-900">Sessões WhatsApp</h2>
            <div className="space-y-3">
              {(sessions?.sessions ?? []).map(session => (
                <div key={session.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-gray-900">{session.user.email}</p>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${session.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{session.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Bot: {session.botRunning ? 'rodando' : 'parado'} · Atualizado: {formatDate(session.updatedAt)}</p>
                </div>
              ))}
              {!sessions?.sessions?.length && <p className="text-sm text-gray-400">Sem sessões.</p>}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-lg font-black text-gray-900">Logs recentes</h2>
            <div className="space-y-3">
              {(logs?.logs ?? []).map(log => (
                <div key={log.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-gray-900">{log.user?.email}</p>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${log.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{log.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{log.platform} · {formatDate(log.sentAt)}</p>
                  {log.errorMsg && <p className="mt-1 text-xs text-red-500">{log.errorMsg}</p>}
                </div>
              ))}
              {!logs?.logs?.length && <p className="text-sm text-gray-400">Sem logs.</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
