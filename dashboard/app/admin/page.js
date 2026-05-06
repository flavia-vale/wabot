'use client'
import { useEffect, useState } from 'react'
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
}

export default function AdminPage() {
  const [overview, setOverview] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([api.adminMe(), api.adminOverview()])
      .then(([adminData, overviewData]) => {
        if (!active) return
        setAdmin(adminData)
        setOverview(overviewData)
      })
      .catch((err) => {
        if (active) setError(err.message || 'Não foi possível carregar o painel admin.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  if (loading) return <LoadingState />

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Base segura</p>
            <h1 className="text-3xl font-black text-gray-900">Admin Wabot</h1>
            <p className="mt-1 text-sm text-gray-500">Cockpit inicial com RBAC, auditoria e indicadores para suporte proativo.</p>
          </div>
          <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-100">
            Voltar ao painel
          </Link>
        </div>

        {error && <Alert type="error" title="Acesso admin indisponível" message={error} />}

        {admin && (
          <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
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
                <p className="mt-2 text-3xl font-black text-gray-900">
                  {key === 'revenue30d' ? `R$ ${Number(overview[key] ?? 0).toFixed(2)}` : overview[key] ?? '—'}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
