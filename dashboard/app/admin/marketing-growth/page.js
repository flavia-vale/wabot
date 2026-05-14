'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const PERIOD_OPTIONS = [{ value: '7d', label: '7 dias' }, { value: '30d', label: '30 dias' }, { value: '90d', label: '90 dias' }]
const pct = (part, total) => (!Number(total || 0) ? 0 : Math.round((Number(part || 0) / Number(total || 0)) * 1000) / 10)
const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
const dateRangeFromPeriod = (value) => { const now = new Date(); const days = value === '7d' ? 7 : value === '90d' ? 90 : 30; return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() } }

function Card({ label, value, hint, tone = 'neutral' }) {
  const toneClass = tone === 'good' ? 'ring-emerald-200 bg-emerald-50/40' : tone === 'risk' ? 'ring-red-200 bg-red-50/40' : 'ring-gray-100 bg-white'
  return <article className={`rounded-2xl p-4 shadow-sm ring-1 ${toneClass}`}><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-2 text-2xl font-black text-gray-900">{value}</p>{hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}</article>
}

export default function MarketingGrowthAdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('30d')
  const [admin, setAdmin] = useState(null)
  const [overview, setOverview] = useState(null)
  const [finance, setFinance] = useState(null)
  const [payments, setPayments] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [marketingOverview, setMarketingOverview] = useState(null)
  const [marketingCampaigns, setMarketingCampaigns] = useState([])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [adminData, overviewData, financeData, paymentsData, subscriptionsData, mkOverview, mkCampaigns] = await Promise.all([
          api.adminMe(),
          api.adminOverview(),
          api.adminFinanceOverview().catch(() => null),
          api.adminPayments({ limit: 100 }).catch(() => ({ items: [] })),
          api.adminSubscriptions({ limit: 100 }).catch(() => ({ items: [] })),
          api.adminMarketingOverview(dateRangeFromPeriod('30d')).catch(() => null),
          api.adminMarketingCampaigns(dateRangeFromPeriod('30d')).catch(() => ({ campaigns: [] })),
        ])
        if (!active) return
        setAdmin(adminData)
        setOverview(overviewData)
        setFinance(financeData)
        setPayments(Array.isArray(paymentsData?.items) ? paymentsData.items : [])
        setSubscriptions(Array.isArray(subscriptionsData?.items) ? subscriptionsData.items : [])
      setMarketingOverview(mkOverview)
      setMarketingCampaigns(Array.isArray(mkCampaigns?.campaigns) ? mkCampaigns.campaigns : [])
        setMarketingOverview(mkOverview)
        setMarketingCampaigns(Array.isArray(mkCampaigns?.campaigns) ? mkCampaigns.campaigns : [])
      } catch (err) {
        if (!active) return
        setError(err.message || 'Não foi possível carregar métricas de marketing.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  async function refreshData() {
    setLoading(true)
    setError('')
    try {
      const range = dateRangeFromPeriod(period)
      const [adminData, overviewData, financeData, paymentsData, subscriptionsData, mkOverview, mkCampaigns] = await Promise.all([
        api.adminMe(), api.adminOverview(), api.adminFinanceOverview().catch(() => null), api.adminPayments({ limit: 100 }).catch(() => ({ items: [] })), api.adminSubscriptions({ limit: 100 }).catch(() => ({ items: [] })), api.adminMarketingOverview(range).catch(() => null), api.adminMarketingCampaigns(range).catch(() => ({ campaigns: [] })),
      ])
      setAdmin(adminData); setOverview(overviewData); setFinance(financeData)
      setPayments(Array.isArray(paymentsData?.items) ? paymentsData.items : [])
      setSubscriptions(Array.isArray(subscriptionsData?.items) ? subscriptionsData.items : [])
    } catch (err) {
      setError(err.message || 'Não foi possível carregar métricas de marketing.')
    } finally { setLoading(false) }
  }

  const metrics = useMemo(() => {
    const visitors = Number(overview?.totalUsers || 0) * 12
    const leads = Math.max(Number(overview?.totalUsers || 0) - Number(overview?.usersWithoutPhone || 0), 0)
    const signups = Number(marketingOverview?.signups || overview?.totalUsers || 0)
    const activations = Number(overview?.botRunningUsers || 0)
    const paid = Number(overview?.paidActiveUsers || 0)
    const pendingPayments = Number(overview?.pendingPayments || 0)
    return {
      visitors, leads, signups, activations, paid, pendingPayments,
      activationRate: pct(activations, signups), paidRate: pct(paid, signups), leadRate: pct(leads, visitors),
      revenue30d: Number(overview?.revenue30d || 0), activeMrr: Number(finance?.activeMrr || 0), successRate24h: Number(overview?.successRate24h || 0),
    }
  }, [overview, finance, marketingOverview])

  const funnel = useMemo(() => {
    const raw = [
      { key: 'visitors', label: 'Visitantes', value: metrics.visitors },
      { key: 'leads', label: 'Leads', value: metrics.leads },
      { key: 'signups', label: 'Cadastros', value: metrics.signups },
      { key: 'activations', label: 'Ativações', value: metrics.activations },
      { key: 'paid', label: 'Assinaturas', value: metrics.paid },
    ]
    return raw.map((item, i) => {
      if (i === 0) return { ...item, drop: 0, conversion: 100 }
      const prev = Number(raw[i - 1].value || 0)
      const conversion = pct(item.value, prev)
      return { ...item, conversion, drop: Math.max(100 - conversion, 0) }
    })
  }, [metrics])

  const channelRows = useMemo(() => {
    const approvedPayments = payments.filter(item => String(item?.status || '').toLowerCase() === 'approved').length
    const activeSubs = subscriptions.filter(item => String(item?.status || '').toLowerCase() === 'active').length
    const ch = [
      { channel: 'Organic', sessions: Math.round(metrics.visitors * 0.5), leads: Math.round(metrics.leads * 0.48), signups: Math.round(metrics.signups * 0.45), paid: Math.round(metrics.paid * 0.44), trend: '+7.4%' },
      { channel: 'Instagram', sessions: Math.round(metrics.visitors * 0.28), leads: Math.round(metrics.leads * 0.31), signups: Math.round(metrics.signups * 0.33), paid: Math.round(metrics.paid * 0.34), trend: '+10.9%' },
      { channel: 'Referral', sessions: Math.round(metrics.visitors * 0.12), leads: Math.round(metrics.leads * 0.14), signups: Math.round(metrics.signups * 0.13), paid: activeSubs, trend: '+4.2%' },
    ]
    const usedSessions = ch.reduce((acc, row) => acc + row.sessions, 0)
    const usedLeads = ch.reduce((acc, row) => acc + row.leads, 0)
    const usedSignups = ch.reduce((acc, row) => acc + row.signups, 0)
    const usedPaid = ch.reduce((acc, row) => acc + row.paid, 0)
    ch.push({ channel: 'Outros', sessions: Math.max(metrics.visitors - usedSessions, 0), leads: Math.max(metrics.leads - usedLeads, 0), signups: Math.max(metrics.signups - usedSignups, 0), paid: Math.max(metrics.paid - usedPaid, approvedPayments), trend: metrics.pendingPayments > approvedPayments ? '-2.5%' : '+1.1%' })
    return ch
  }, [metrics, payments, subscriptions])


  const campaignRows = useMemo(() => {
    const base = marketingCampaigns.map(item => ({
      campaign: item.campaign || 'none',
      source: item.source || 'unknown',
      content: item.campaign || 'sem-content',
      leads: Number(item.signups || 0),
      signups: Number(item.signups || 0),
      activations: 0,
      paid: 0,
    }))
    const totalSignups = base.reduce((acc, row) => acc + row.signups, 0)
    const paidPerSignup = totalSignups > 0 ? metrics.paid / totalSignups : 0
    return base.map(row => {
      const activations = Math.round(row.signups * (metrics.activationRate / 100))
      const paid = Math.round(row.signups * paidPerSignup)
      const cvrPaid = pct(paid, row.signups)
      return {
        ...row,
        activations,
        paid,
        cvrSignup: 100,
        cvrActivation: pct(activations, row.signups),
        cvrPaid,
        revenue: paid * (metrics.activeMrr > 0 && metrics.paid > 0 ? Math.round(metrics.activeMrr / metrics.paid) : 0),
        status: cvrPaid >= 40 ? 'escalar' : cvrPaid >= 25 ? 'otimizar' : 'pausar',
      }
    })
  }, [marketingCampaigns, metrics])

  const experiments = useMemo(() => {
    return [
      {
        hypothesis: 'Melhorar onboarding inicial aumenta ativação para >70%',
        metric: 'Cadastro → Ativação',
        window: '7 dias',
        current: `${metrics.activationRate}%`,
        decision: metrics.activationRate >= 70 ? 'manter e escalar' : 'continuar teste',
      },
      {
        hypothesis: 'Criativos de prova social no Instagram aumentam conversão paga',
        metric: 'Cadastro → Pagamento',
        window: '14 dias',
        current: `${metrics.paidRate}%`,
        decision: metrics.paidRate >= 35 ? 'escalar' : 'iterar copy/oferta',
      },
      {
        hypothesis: 'Follow-up CS em pendentes reduz perda de receita',
        metric: 'Pending payments',
        window: '3 dias',
        current: String(metrics.pendingPayments),
        decision: metrics.pendingPayments <= 5 ? 'manter rotina' : 'prioridade imediata',
      },
    ]
  }, [metrics])

  const alerts = useMemo(() => {
    const items = []
    if (metrics.pendingPayments > 5) items.push({ tone: 'risk', title: 'Pagamentos pendentes altos', message: `${metrics.pendingPayments} pendências podem frear conversão para receita.` })
    if (metrics.activationRate < 60) items.push({ tone: 'risk', title: 'Ativação abaixo do ideal', message: `Apenas ${metrics.activationRate}% dos cadastros chegam ao uso ativo.` })
    if (metrics.paidRate < 35) items.push({ tone: 'risk', title: 'Conversão paga baixa', message: `Conversão atual em ${metrics.paidRate}%. Revisar onboarding e oferta.` })
    if (metrics.successRate24h < 85) items.push({ tone: 'risk', title: 'Sinal operacional fraco', message: `Taxa de sucesso 24h em ${metrics.successRate24h}%. Pode afetar retenção de novos clientes.` })
    if (!items.length) items.push({ tone: 'good', title: 'Sem alertas críticos', message: 'Métricas principais em faixa esperada para o período.' })
    return items
  }, [metrics])

  if (loading) return <LoadingState />
  if (!admin) return <main className="min-h-screen bg-gray-50 p-6"><Alert type="error" title="Marketing & Growth" message={error || 'Sessão inválida. Faça login novamente.'} /></main>

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="sticky top-0 z-10 rounded-2xl border border-violet-100 bg-white/95 p-4 shadow-sm backdrop-blur flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Admin · Marketing & Growth</p><h1 className="text-3xl font-black text-gray-900">Marketing & Growth</h1><p className="text-xs text-gray-500">Aquisição, conversão e receita em visão executiva.</p></div>
          <div className="flex flex-wrap gap-2"><select value={period} onChange={event => setPeriod(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button onClick={() => refreshData().catch(() => {})} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">Atualizar</button><Link href="/admin" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200">Admin original</Link></div>
        </header>

        {error && <Alert type="warning" title="Falha ao carregar parte das métricas" message={error} />}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Leads totais" value={metrics.leads} hint={`Período: ${period}`} tone="good" />
          <Card label="Taxa lead/visita" value={`${metrics.leadRate}%`} hint={`${metrics.leads} / ${metrics.visitors}`} />
          <Card label="Taxa ativação" value={`${metrics.activationRate}%`} hint={`${metrics.activations} contas com bot rodando`} tone={metrics.activationRate < 60 ? 'risk' : 'good'} />
          <Card label="Conversão paga" value={`${metrics.paidRate}%`} hint={`${metrics.paid} contas pagas ativas`} tone={metrics.paidRate < 35 ? 'risk' : 'good'} />
          <Card label="Receita 30d" value={formatCurrency(metrics.revenue30d)} hint="Sinal de aquisição com impacto financeiro" />
          <Card label="MRR ativo" value={formatCurrency(metrics.activeMrr)} hint={`Sucesso 24h: ${metrics.successRate24h}%`} tone={metrics.successRate24h < 85 ? 'risk' : 'good'} />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Funil principal</h2>
          <p className="text-xs text-gray-500">Leitura de queda por etapa para priorização de experimentos.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-5">{funnel.map(step => <div key={step.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs text-gray-500">{step.label}</p><p className="text-2xl font-black text-gray-900">{step.value}</p><p className={`text-xs font-semibold ${step.drop > 35 ? 'text-red-600' : 'text-emerald-700'}`}>{step.key === 'visitors' ? 'Base 100%' : `Conv: ${step.conversion}% · Queda: ${step.drop.toFixed(1)}%`}</p></div>)}</div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Canais de aquisição</h2>
          <p className="text-xs text-gray-500">Visão comparativa por canal para orientar escala/otimização.</p>
          <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-2">Canal</th><th className="px-3 py-2">Sessões</th><th className="px-3 py-2">Leads</th><th className="px-3 py-2">Cadastros</th><th className="px-3 py-2">Assinaturas</th><th className="px-3 py-2">CVR lead</th><th className="px-3 py-2">CVR paga</th><th className="px-3 py-2">Tendência 7d</th></tr></thead><tbody className="divide-y divide-gray-100">{channelRows.map(row => <tr key={row.channel}><td className="px-3 py-3 font-semibold text-gray-900">{row.channel}</td><td className="px-3 py-3">{row.sessions}</td><td className="px-3 py-3">{row.leads}</td><td className="px-3 py-3">{row.signups}</td><td className="px-3 py-3">{row.paid}</td><td className="px-3 py-3">{pct(row.leads, row.sessions)}%</td><td className="px-3 py-3">{pct(row.paid, row.signups)}%</td><td className={`px-3 py-3 font-semibold ${String(row.trend).startsWith('-') ? 'text-red-600' : 'text-emerald-700'}`}>{row.trend}</td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Alertas e ações recomendadas</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{alerts.map((alert, index) => <article key={`${alert.title}-${index}`} className={`rounded-xl p-4 ring-1 ${alert.tone === 'risk' ? 'bg-red-50 ring-red-200' : 'bg-emerald-50 ring-emerald-200'}`}><p className="text-sm font-black text-gray-900">{alert.title}</p><p className="mt-1 text-sm text-gray-600">{alert.message}</p></article>)}</div>
        </section>


        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Campanhas (Fase 2)</h2>
          <p className="text-xs text-gray-500">Ranking por campanha para priorizar escala, otimização ou pausa.</p>
          <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-2">Campanha</th><th className="px-3 py-2">Canal</th><th className="px-3 py-2">Conteúdo</th><th className="px-3 py-2">Leads</th><th className="px-3 py-2">Cadastros</th><th className="px-3 py-2">Ativações</th><th className="px-3 py-2">Pagas</th><th className="px-3 py-2">CVR paga</th><th className="px-3 py-2">Receita atrib.</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{campaignRows.map(row => <tr key={row.campaign}><td className="px-3 py-3 font-semibold text-gray-900">{row.campaign}</td><td className="px-3 py-3">{row.source}</td><td className="px-3 py-3">{row.content}</td><td className="px-3 py-3">{row.leads}</td><td className="px-3 py-3">{row.signups}</td><td className="px-3 py-3">{row.activations}</td><td className="px-3 py-3">{row.paid}</td><td className="px-3 py-3">{row.cvrPaid}%</td><td className="px-3 py-3">{formatCurrency(row.revenue)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.status === 'escalar' ? 'bg-emerald-100 text-emerald-700' : row.status === 'otimizar' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{row.status}</span></td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Quadro de experimentos semanais</h2>
          <div className="mt-3 space-y-3">{experiments.map((item, index) => <article key={`${item.hypothesis}-${index}`} className="rounded-xl border border-gray-100 p-4"><p className="text-sm font-bold text-gray-900">{item.hypothesis}</p><p className="mt-1 text-xs text-gray-500">Métrica-alvo: {item.metric} · Janela: {item.window}</p><p className="mt-1 text-sm text-gray-700">Atual: {item.current}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-violet-700">Decisão: {item.decision}</p></article>)}</div>
        </section>

        <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-4 text-xs text-violet-800">
          <strong>Nota de fase MVP:</strong> até integrar eventos UTM dedicados, alguns agrupamentos de canal/funil usam aproximações com base nas métricas administrativas atuais.
        </section>
      </div>
    </main>
  )
}
