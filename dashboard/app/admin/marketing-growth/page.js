'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const PERIOD_OPTIONS = [{ value: '7d', label: '7 dias' }, { value: '30d', label: '30 dias' }, { value: '90d', label: '90 dias' }]
const pct = (part, total) => (!Number(total || 0) ? 0 : Math.round((Number(part || 0) / Number(total || 0)) * 1000) / 10)
const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

function Card({ label, value, hint }) {
  return <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-2 text-2xl font-black text-gray-900">{value}</p>{hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}</article>
}

export default function MarketingGrowthAdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('30d')
  const [admin, setAdmin] = useState(null)
  const [overview, setOverview] = useState(null)
  const [finance, setFinance] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [adminData, overviewData, financeData] = await Promise.all([
          api.adminMe(),
          api.adminOverview(),
          api.adminFinanceOverview().catch(() => null),
        ])
        if (!active) return
        setAdmin(adminData)
        setOverview(overviewData)
        setFinance(financeData)
      } catch (err) {
        if (!active) return
        setError(err.message || 'Não foi possível carregar métricas de marketing.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function refreshData() {
    setLoading(true)
    setError('')
    try {
      const [adminData, overviewData, financeData] = await Promise.all([
        api.adminMe(),
        api.adminOverview(),
        api.adminFinanceOverview().catch(() => null),
      ])
      setAdmin(adminData)
      setOverview(overviewData)
      setFinance(financeData)
    } catch (err) {
      setError(err.message || 'Não foi possível carregar métricas de marketing.')
    } finally {
      setLoading(false)
    }
  }

  const metrics = useMemo(() => {
    const visitors = Number(overview?.totalUsers || 0) * 12
    const leads = Math.max(Number(overview?.totalUsers || 0) - Number(overview?.usersWithoutPhone || 0), 0)
    const signups = Number(overview?.totalUsers || 0)
    const activations = Number(overview?.botRunningUsers || 0)
    const paid = Number(overview?.paidActiveUsers || 0)
    return {
      visitors,
      leads,
      signups,
      activations,
      paid,
      activationRate: pct(activations, signups),
      paidRate: pct(paid, signups),
      leadRate: pct(leads, visitors),
      revenue30d: Number(overview?.revenue30d || 0),
      activeMrr: Number(finance?.activeMrr || 0),
      successRate24h: Number(overview?.successRate24h || 0),
    }
  }, [overview, finance])

  if (loading) return <LoadingState />
  if (!admin) return <main className="min-h-screen bg-gray-50 p-6"><Alert type="error" title="Marketing & Growth" message={error || 'Sessão inválida. Faça login novamente.'} /></main>

  return <main className="min-h-screen bg-gray-50 p-6"><div className="mx-auto max-w-7xl space-y-6"><header className="sticky top-0 z-10 rounded-2xl border border-violet-100 bg-white/95 p-4 shadow-sm backdrop-blur flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Admin · Marketing & Growth</p><h1 className="text-3xl font-black text-gray-900">Marketing & Growth</h1><p className="text-xs text-gray-500">Aquisição, conversão e receita em visão executiva.</p></div><div className="flex flex-wrap gap-2"><select value={period} onChange={event => setPeriod(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button onClick={() => refreshData().catch(() => {})} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">Atualizar</button><Link href="/admin" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200">Admin original</Link></div></header>{error && <Alert type="warning" title="Falha ao carregar parte das métricas" message={error} />}<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Card label="Leads totais" value={metrics.leads} hint={`Período: ${period}`} /><Card label="Taxa lead/visita" value={`${metrics.leadRate}%`} hint={`${metrics.leads} / ${metrics.visitors}`} /><Card label="Taxa ativação" value={`${metrics.activationRate}%`} hint={`${metrics.activations} contas com bot rodando`} /><Card label="Conversão paga" value={`${metrics.paidRate}%`} hint={`${metrics.paid} contas pagas ativas`} /><Card label="Receita 30d" value={formatCurrency(metrics.revenue30d)} hint="Sinal de aquisição com impacto financeiro" /><Card label="MRR ativo" value={formatCurrency(metrics.activeMrr)} hint={`Sucesso 24h: ${metrics.successRate24h}%`} /></section></div></main>
}
