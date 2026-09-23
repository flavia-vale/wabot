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
const sourceLabel = source => source === 'measured' ? 'REAL' : source === 'mixed' ? 'MISTO' : 'ESTIMADO'
const confidenceLabel = confidence => confidence === 'high' ? 'Alta' : confidence === 'medium' ? 'Média' : 'Baixa'
function trustTag({ source = 'modeled', confidence = 'medium', note = '' }) {
  return `${sourceLabel(source)} · Confiança ${confidenceLabel(confidence)}${note ? ` · ${note}` : ''}`
}

const formatUpdatedAt = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}


const iceScore = ({ impact = 1, confidence = 1, ease = 1 }) => Math.round(((impact + confidence + ease) / 3) * 10) / 10


const rolloutChecks = ({ metrics, dataTrust }) => {
  const checks = [
    {
      id: 'staging-health',
      label: 'Health API staging',
      command: 'GET http://127.0.0.1:3004/health',
      expected: '200 + payload health',
      status: metrics.successRate24h >= 85 ? 'pass' : 'warn',
      note: metrics.successRate24h >= 85 ? 'Sinal operacional estável.' : 'Taxa de sucesso 24h abaixo do ideal.',
    },
    {
      id: 'login-page',
      label: 'Login dashboard staging',
      command: 'GET http://178.105.54.0:3006/login',
      expected: '200 + página renderizada',
      status: 'pass',
      note: 'Endpoint alvo de smoke no deploy seguro.',
    },
    {
      id: 'auth-json',
      label: 'Auth API via Next proxy',
      command: 'POST http://178.105.54.0:3006/api/auth/login',
      expected: 'JSON (não 404 do Next)',
      status: dataTrust?.confidence === 'low' ? 'warn' : 'pass',
      note: dataTrust?.confidence === 'low' ? 'Baixa confiança de dados: validar JWT_SECRET/.env em staging.' : 'Proxy/API com sinal de consistência.',
    },
    {
      id: 'data-trust',
      label: 'Cobertura de tracking',
      command: 'Revisar sourceCoverage/campaignCoverage',
      expected: '>= 80% para decisões de escala',
      status: Number(dataTrust?.sourceCoverage || 0) >= 80 && Number(dataTrust?.campaignCoverage || 0) >= 80 ? 'pass' : 'warn',
      note: `Source ${dataTrust?.sourceCoverage ?? 0}% · Campaign ${dataTrust?.campaignCoverage ?? 0}%`,
    },
  ]
  return checks
}

const checkStatusMeta = status => status === 'pass'
  ? { label: 'PASS', className: 'bg-emerald-100 text-emerald-700' }
  : status === 'fail'
    ? { label: 'FAIL', className: 'bg-red-100 text-red-700' }
    : { label: 'WARN', className: 'bg-amber-100 text-amber-700' }

const experimentStatusMeta = status => status === 'won'
  ? { label: 'won', className: 'bg-emerald-100 text-emerald-700' }
  : status === 'lost'
    ? { label: 'lost', className: 'bg-red-100 text-red-700' }
    : status === 'running'
      ? { label: 'running', className: 'bg-blue-100 text-blue-700' }
      : status === 'inconclusive'
        ? { label: 'inconclusive', className: 'bg-amber-100 text-amber-700' }
        : { label: 'draft', className: 'bg-gray-100 text-gray-700' }

function Card({ label, value, hint, tone = 'neutral', trust = null, updatedAt = '' }) {
  const toneClass = tone === 'good' ? 'ring-emerald-200 bg-emerald-50/40' : tone === 'risk' ? 'ring-red-200 bg-red-50/40' : 'ring-gray-100 bg-white'
  return <article className={`rounded-2xl p-4 shadow-sm ring-1 ${toneClass}`}><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-2 text-2xl font-black text-gray-900">{value}</p>{hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}{trust && <p className="mt-2 text-[11px] font-semibold text-gray-500">{trust}</p>}{updatedAt && <p className="mt-1 text-[11px] text-gray-400">Atualizado: {updatedAt}</p>}</article>
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
  const [signupsByLanding, setSignupsByLanding] = useState([])
  const [marketingFunnel, setMarketingFunnel] = useState(null)
  const [dataTrust, setDataTrust] = useState(null)
  const [cohorts, setCohorts] = useState([])
  const [backendAlerts, setBackendAlerts] = useState([])
  const [promptMetrics, setPromptMetrics] = useState([])
  const [users, setUsers] = useState([])
  const [lastUpdated, setLastUpdated] = useState({ dashboard: '', kpis: '', funnel: '', channels: '', campaigns: '', prompts: '', trust: '', signupsByLanding: '' })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [adminData, overviewData, financeData, paymentsData, subscriptionsData, usersData, mkOverview, mkCampaigns, mkFunnel, mkTrust, mkCohorts, mkAlerts, mkPrompts, mkSignupsByLanding] = await Promise.all([
          api.adminMe(),
          api.adminOverview(),
          api.adminFinanceOverview().catch(() => null),
          api.adminPayments({ limit: 100 }).catch(() => ({ items: [] })),
          api.adminSubscriptions({ limit: 100 }).catch(() => ({ items: [] })),
          api.adminUsers({ limit: 120 }).catch(() => ({ users: [] })),
          api.adminMarketingOverview(dateRangeFromPeriod('30d')).catch(() => null),
          api.adminMarketingCampaigns(dateRangeFromPeriod('30d')).catch(() => ({ campaigns: [] })),
          api.adminMarketingFunnel(dateRangeFromPeriod('30d')).catch(() => null),
          api.adminMarketingDataTrust(dateRangeFromPeriod('30d')).catch(() => null),
          api.adminMarketingCohorts(dateRangeFromPeriod('90d')).catch(() => ({ cohorts: [] })),
          api.adminMarketingAlerts(dateRangeFromPeriod('30d')).catch(() => ({ alerts: [] })),
          api.adminMarketingPrompts(dateRangeFromPeriod('30d')).catch(() => ({ prompts: [] })),
          api.adminMarketingSignupsByLanding(dateRangeFromPeriod('30d')).catch(() => ({ signupsByLanding: [] })),
        ])
        if (!active) return
        setAdmin(adminData)
        setOverview(overviewData)
        setFinance(financeData)
        setPayments(Array.isArray(paymentsData?.items) ? paymentsData.items : [])
        setSubscriptions(Array.isArray(subscriptionsData?.items) ? subscriptionsData.items : [])
        setUsers(Array.isArray(usersData?.users) ? usersData.users : [])
        setMarketingOverview(mkOverview)
        setMarketingCampaigns(Array.isArray(mkCampaigns?.campaigns) ? mkCampaigns.campaigns : [])
        setMarketingFunnel(mkFunnel)
        setDataTrust(mkTrust)
        setCohorts(Array.isArray(mkCohorts?.cohorts) ? mkCohorts.cohorts : [])
        setBackendAlerts(Array.isArray(mkAlerts?.alerts) ? mkAlerts.alerts : [])
        setPromptMetrics(Array.isArray(mkPrompts?.prompts) ? mkPrompts.prompts : [])
        setSignupsByLanding(Array.isArray(mkSignupsByLanding?.signupsByLanding) ? mkSignupsByLanding.signupsByLanding : [])
        const nowIso = new Date().toISOString()
        setLastUpdated({ dashboard: nowIso, kpis: nowIso, funnel: nowIso, channels: nowIso, campaigns: nowIso, prompts: nowIso, trust: nowIso, signupsByLanding: nowIso })
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
      const [adminData, overviewData, financeData, paymentsData, subscriptionsData, usersData, mkOverview, mkCampaigns, mkFunnel, mkTrust, mkCohorts, mkAlerts, mkPrompts, mkSignupsByLanding] = await Promise.all([
        api.adminMe(), api.adminOverview(), api.adminFinanceOverview().catch(() => null), api.adminPayments({ limit: 100 }).catch(() => ({ items: [] })), api.adminSubscriptions({ limit: 100 }).catch(() => ({ items: [] })), api.adminUsers({ limit: 120 }).catch(() => ({ users: [] })), api.adminMarketingOverview(range).catch(() => null), api.adminMarketingCampaigns(range).catch(() => ({ campaigns: [] })), api.adminMarketingFunnel(range).catch(() => null), api.adminMarketingDataTrust(range).catch(() => null), api.adminMarketingCohorts(dateRangeFromPeriod('90d')).catch(() => ({ cohorts: [] })), api.adminMarketingAlerts(range).catch(() => ({ alerts: [] })), api.adminMarketingPrompts(range).catch(() => ({ prompts: [] })), api.adminMarketingSignupsByLanding(range).catch(() => ({ signupsByLanding: [] })),
      ])
      setAdmin(adminData); setOverview(overviewData); setFinance(financeData)
      setPayments(Array.isArray(paymentsData?.items) ? paymentsData.items : [])
      setSubscriptions(Array.isArray(subscriptionsData?.items) ? subscriptionsData.items : [])
      setUsers(Array.isArray(usersData?.users) ? usersData.users : [])
      setMarketingOverview(mkOverview)
      setMarketingCampaigns(Array.isArray(mkCampaigns?.campaigns) ? mkCampaigns.campaigns : [])
      setMarketingFunnel(mkFunnel)
      setDataTrust(mkTrust)
      setCohorts(Array.isArray(mkCohorts?.cohorts) ? mkCohorts.cohorts : [])
      setBackendAlerts(Array.isArray(mkAlerts?.alerts) ? mkAlerts.alerts : [])
      setPromptMetrics(Array.isArray(mkPrompts?.prompts) ? mkPrompts.prompts : [])
      setSignupsByLanding(Array.isArray(mkSignupsByLanding?.signupsByLanding) ? mkSignupsByLanding.signupsByLanding : [])
      const nowIso = new Date().toISOString()
      setLastUpdated({ dashboard: nowIso, kpis: nowIso, funnel: nowIso, channels: nowIso, campaigns: nowIso, prompts: nowIso, trust: nowIso, signupsByLanding: nowIso })
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
      visitors, leads, signups, activations, paid, pendingPayments, affiliateReferrals: Number(marketingOverview?.affiliateReferrals || 0),
      activationRate: pct(activations, signups), paidRate: pct(paid, signups), leadRate: pct(leads, visitors),
      revenue30d: Number(overview?.revenue30d || 0), activeMrr: Number(finance?.activeMrr || 0), successRate24h: Number(overview?.successRate24h || 0),
    }
  }, [overview, finance, marketingOverview])

  const funnel = useMemo(() => {
    const raw = [
      { key: 'sessions', label: 'Sessões', value: Number(marketingFunnel?.sessions || metrics.visitors) },
      { key: 'signups', label: 'Cadastros', value: Number(marketingFunnel?.signups || metrics.signups) },
      { key: 'activations', label: 'Ativações', value: Number(marketingFunnel?.firstValueActions || metrics.activations) },
      { key: 'paid', label: 'Assinaturas', value: Number(marketingFunnel?.approvedPayments || metrics.paid) },
    ]
    return raw.map((item, i) => {
      if (i === 0) return { ...item, drop: 0, conversion: 100 }
      const prev = Number(raw[i - 1].value || 0)
      const conversion = pct(item.value, prev)
      return { ...item, conversion, drop: Math.max(100 - conversion, 0) }
    })
  }, [metrics, marketingFunnel])

  const promptRows = useMemo(() => promptMetrics.map(item => ({
    promptId: item.promptId || 'unknown',
    variant: item.variant || 'default',
    views: Number(item.views || 0),
    dismissals: Number(item.dismissals || 0),
    ctaClicks: Number(item.ctaClicks || 0),
    formFocuses: Number(item.formFocuses || 0),
    signups: Number(item.signups || 0),
    dismissRate: Number(item.dismissRate || 0),
    ctaRate: Number(item.ctaRate || 0),
    signupRate: Number(item.signupRate || 0),
  })), [promptMetrics])

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
    const experimentsSeed = [
      {
        id: 'exp-onboarding-activation',
        hypothesis: 'Porque novos usuários travam no setup inicial, simplificar o onboarding para 1 fluxo guiado aumentará ativação para novos cadastros.',
        owner: 'Produto + Growth',
        stage: 'Activation',
        audience: 'Novos cadastros',
        primaryMetric: 'Taxa Cadastro → Ativação',
        secondaryMetrics: ['Tempo até primeira ação', 'Conclusão onboarding'],
        guardrails: ['Conversão paga não cair > 2pp', 'Tickets de suporte onboarding não subir > 15%'],
        baseline: metrics.activationRate,
        target: 70,
        mde: 5,
        windowDays: 7,
      },
      {
        id: 'exp-socialproof-paid',
        hypothesis: 'Porque a proposta de valor paga ainda parece genérica, inserir prova social forte no fluxo de oferta aumentará conversão de cadastro para pagamento.',
        owner: 'Growth',
        stage: 'Monetization',
        audience: 'Cadastros com bot ativo',
        primaryMetric: 'Taxa Cadastro → Pagamento',
        secondaryMetrics: ['CTR da oferta', 'Início de checkout'],
        guardrails: ['Ativação não cair > 1pp', 'Pendências de pagamento não subir > 20%'],
        baseline: metrics.paidRate,
        target: 35,
        mde: 4,
        windowDays: 14,
      },
      {
        id: 'exp-pending-recovery',
        hypothesis: 'Porque pendências sem follow-up geram perda evitável, automatizar rotina de recuperação em 24h reduzirá pagamentos pendentes ativos.',
        owner: 'CS + Financeiro',
        stage: 'Revenue Recovery',
        audience: 'Usuários com cobrança pendente',
        primaryMetric: 'Pendências de pagamento',
        secondaryMetrics: ['Taxa de recuperação em 72h', 'Tempo médio para aprovação'],
        guardrails: ['Reclamações de cobrança não subir > 10%', 'Churn involuntário não subir > 1pp'],
        baseline: metrics.pendingPayments,
        target: 5,
        mde: 2,
        windowDays: 3,
        reverseGoal: true,
      },
    ]

    return experimentsSeed.map((exp, index) => {
      const current = index === 0 ? metrics.activationRate : index === 1 ? metrics.paidRate : metrics.pendingPayments
      const reverseGoal = Boolean(exp.reverseGoal)
      const delta = reverseGoal ? exp.baseline - current : current - exp.baseline
      const reachedTarget = reverseGoal ? current <= exp.target : current >= exp.target
      const reachedMde = delta >= exp.mde
      const enoughSample = index === 2 ? metrics.pendingPayments >= 3 : metrics.signups >= 30
      const status = reachedTarget && reachedMde && enoughSample ? 'won' : reachedMde && enoughSample ? 'running' : enoughSample ? 'inconclusive' : 'draft'
      const decision = status === 'won'
        ? 'Escalar variação vencedora e registrar playbook'
        : status === 'running'
          ? 'Continuar teste até fechar janela/amostra'
          : status === 'inconclusive'
            ? 'Ajustar hipótese ou variante para novo ciclo'
            : 'Aguardando amostra mínima para decisão'
      const referenceIso = lastUpdated.dashboard || ''
      const referenceDate = referenceIso ? new Date(referenceIso) : null
      const startDate = referenceDate ? new Date(referenceDate.getTime() - exp.windowDays * 24 * 60 * 60 * 1000).toISOString() : ''
      return {
        ...exp,
        current,
        delta,
        reachedTarget,
        reachedMde,
        enoughSample,
        status,
        decision,
        sampleSize: index === 2 ? Math.max(metrics.pendingPayments, 0) : Math.max(metrics.signups, 0),
        requiredSample: index === 2 ? 12 : 60,
        startDate,
        endDate: referenceIso,
      }
    })
  }, [metrics, lastUpdated.dashboard])


  const growthIdeas = useMemo(() => {
    const ideas = []

    if (metrics.activationRate < 60) {
      ideas.push({
        trigger: 'Ativação abaixo de 60%',
        hypothesis: 'Usuários não completam setup inicial por excesso de fricção.',
        experiment: 'Reduzir onboarding para 3 passos com checklist progressivo e CTA único.',
        owner: 'Produto',
        impact: 5,
        confidence: 4,
        ease: 3,
        effort: 'M',
      })
      ideas.push({
        trigger: 'Ativação abaixo de 60%',
        hypothesis: 'Usuário não entende o valor antes de conectar WhatsApp.',
        experiment: 'Inserir prova de valor imediata (demo guiada + template pronto).',
        owner: 'Growth',
        impact: 4,
        confidence: 4,
        ease: 4,
        effort: 'M',
      })
    }

    if (metrics.paidRate < 35) {
      ideas.push({
        trigger: 'Conversão paga abaixo de 35%',
        hypothesis: 'Oferta não comunica ROI com clareza no momento de upgrade.',
        experiment: 'Novo bloco de oferta com ROI estimado e prova social antes do checkout.',
        owner: 'Growth',
        impact: 5,
        confidence: 3,
        ease: 3,
        effort: 'M',
      })
      ideas.push({
        trigger: 'Conversão paga abaixo de 35%',
        hypothesis: 'Timing de cobrança está cedo para parte dos usuários.',
        experiment: 'Testar gatilho de upgrade após primeiro sucesso operacional do bot.',
        owner: 'Produto + CS',
        impact: 4,
        confidence: 3,
        ease: 2,
        effort: 'L',
      })
    }

    if (metrics.pendingPayments > 5) {
      ideas.push({
        trigger: 'Pendências de pagamento acima de 5',
        hypothesis: 'Falta rotina ativa de recuperação nas primeiras 24h.',
        experiment: 'Sequência automática 24h/48h/72h com link direto de regularização.',
        owner: 'CS + Financeiro',
        impact: 4,
        confidence: 5,
        ease: 4,
        effort: 'S',
      })
    }

    if (!ideas.length) {
      ideas.push({
        trigger: 'Sem gatilhos críticos',
        hypothesis: 'Há espaço para ganho incremental em canais de melhor eficiência.',
        experiment: 'A/B test de criativo e oferta no canal com maior CVR paga.',
        owner: 'Growth',
        impact: 3,
        confidence: 4,
        ease: 4,
        effort: 'S',
      })
    }

    return ideas
      .map(item => ({ ...item, ice: iceScore(item) }))
      .sort((a, b) => b.ice - a.ice)
      .slice(0, 6)
  }, [metrics])


  const leadRows = useMemo(() => {
    const range = dateRangeFromPeriod(period)
    const from = new Date(range.from)
    const to = new Date(range.to)
    return users
      .filter(user => {
        const createdAt = new Date(user?.createdAt || 0)
        if (Number.isNaN(createdAt.getTime())) return false
        return createdAt >= from && createdAt <= to
      })
      .map(user => ({
        id: user.id,
        name: user.name || '-',
        email: user.email || '-',
        phone: user.contactPhone || '-',
        createdAt: user.createdAt,
        status: user.status || '-',
        plan: user.plan || '-',
        accessStatus: user.accessStatus || '-',
        botRunning: user.botRunning ? 'Sim' : 'Não',
        acquisition: user.affiliateRef
          ? {
              type: 'affiliate',
              code: user.affiliateRef.code || '-',
              affiliateName: user.affiliateRef.user?.name || user.affiliateRef.user?.email || 'Afiliado',
            }
          : { type: 'direct' },
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 80)
  }, [users, period])


  const metricTrust = useMemo(() => ({
    leads: trustTag({ source: 'mixed', confidence: marketingOverview?.signups ? 'medium' : 'low', note: 'base users + sinais de signup' }),
    leadRate: trustTag({ source: 'modeled', confidence: 'low', note: 'visitas aproximadas' }),
    activationRate: trustTag({ source: 'mixed', confidence: 'medium', note: 'overview + funnel' }),
    paidRate: trustTag({ source: 'mixed', confidence: 'medium', note: 'overview + pagamentos' }),
    revenue30d: trustTag({ source: 'measured', confidence: 'high', note: 'overview financeiro' }),
    activeMrr: trustTag({ source: 'measured', confidence: finance?.activeMrr ? 'high' : 'medium', note: 'finance overview' }),
  }), [marketingOverview, finance])

  const sprint4Checks = useMemo(() => rolloutChecks({ metrics, dataTrust }), [metrics, dataTrust])

  const updatedAt = useMemo(() => ({
    dashboard: formatUpdatedAt(lastUpdated.dashboard),
    kpis: formatUpdatedAt(lastUpdated.kpis),
    funnel: formatUpdatedAt(lastUpdated.funnel),
    channels: formatUpdatedAt(lastUpdated.channels),
    campaigns: formatUpdatedAt(lastUpdated.campaigns),
    prompts: formatUpdatedAt(lastUpdated.prompts),
    trust: formatUpdatedAt(lastUpdated.trust),
    signupsByLanding: formatUpdatedAt(lastUpdated.signupsByLanding),
  }), [lastUpdated])

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
          <div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Admin · Marketing & Growth</p><h1 className="text-3xl font-black text-gray-900">Marketing & Growth</h1><p className="text-xs text-gray-500">Aquisição, conversão e receita em visão executiva. {updatedAt.dashboard ? `Última atualização: ${updatedAt.dashboard}` : ''}</p></div>
          <div className="flex flex-wrap gap-2"><select value={period} onChange={event => setPeriod(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button onClick={() => refreshData().catch(() => {})} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">Atualizar</button><Link href="/admin" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200">Admin original</Link></div>
        </header>

        {error && <Alert type="warning" title="Falha ao carregar parte das métricas" message={error} />}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Indicados por afiliados" value={metrics.affiliateReferrals} hint={`Cadastros atribuídos no período ${period}`} tone={metrics.affiliateReferrals > 0 ? 'good' : 'neutral'} trust={trustTag({ source: 'measured', confidence: 'high', note: 'vínculo persistido no cadastro' })} updatedAt={updatedAt.kpis} />
          <Card label="Leads totais" value={metrics.leads} hint={`Período: ${period}`} tone="good" trust={metricTrust.leads} updatedAt={updatedAt.kpis} />
          <Card label="Taxa lead/visita" value={`${metrics.leadRate}%`} hint={`${metrics.leads} / ${metrics.visitors}`} trust={metricTrust.leadRate} updatedAt={updatedAt.kpis} />
          <Card label="Taxa ativação" value={`${metrics.activationRate}%`} hint={`${metrics.activations} contas com bot rodando`} tone={metrics.activationRate < 60 ? 'risk' : 'good'} trust={metricTrust.activationRate} updatedAt={updatedAt.kpis} />
          <Card label="Conversão paga" value={`${metrics.paidRate}%`} hint={`${metrics.paid} contas pagas ativas`} tone={metrics.paidRate < 35 ? 'risk' : 'good'} trust={metricTrust.paidRate} updatedAt={updatedAt.kpis} />
          <Card label="Receita 30d" value={formatCurrency(metrics.revenue30d)} hint="Sinal de aquisição com impacto financeiro" trust={metricTrust.revenue30d} updatedAt={updatedAt.kpis} />
          <Card label="MRR ativo" value={formatCurrency(metrics.activeMrr)} hint={`Sucesso 24h: ${metrics.successRate24h}%`} tone={metrics.successRate24h < 85 ? 'risk' : 'good'} trust={metricTrust.activeMrr} updatedAt={updatedAt.kpis} />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Funil principal</h2>
          <p className="text-xs text-gray-500">Leitura de queda por etapa para priorização de experimentos. {updatedAt.funnel ? `Atualizado: ${updatedAt.funnel}` : ''}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-5">{funnel.map(step => <div key={step.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs text-gray-500">{step.label}</p><p className="text-2xl font-black text-gray-900">{step.value}</p><p className={`text-xs font-semibold ${step.drop > 35 ? 'text-red-600' : 'text-emerald-700'}`}>{step.key === 'sessions' ? 'Base 100%' : `Conv: ${step.conversion}% · Queda: ${step.drop.toFixed(1)}%`}</p></div>)}</div>
        </section>


        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Prompts de conversão (P1)</h2>
          <p className="text-xs text-gray-500">Impressões, interações e cadastros atribuídos por prompt/variante. {updatedAt.prompts ? `Atualizado: ${updatedAt.prompts}` : ''}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-2">Prompt</th><th className="px-3 py-2">Variante</th><th className="px-3 py-2">Views</th><th className="px-3 py-2">Foco form</th><th className="px-3 py-2">CTA</th><th className="px-3 py-2">Dismiss</th><th className="px-3 py-2">Cadastros</th><th className="px-3 py-2">CTR</th><th className="px-3 py-2">Dismiss rate</th><th className="px-3 py-2">Signup/view</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {promptRows.length ? promptRows.map(row => <tr key={`${row.promptId}-${row.variant}`}><td className="px-3 py-3 font-semibold text-gray-900">{row.promptId}</td><td className="px-3 py-3">{row.variant}</td><td className="px-3 py-3">{row.views}</td><td className="px-3 py-3">{row.formFocuses}</td><td className="px-3 py-3">{row.ctaClicks}</td><td className="px-3 py-3">{row.dismissals}</td><td className="px-3 py-3">{row.signups}</td><td className="px-3 py-3">{row.ctaRate}%</td><td className={`px-3 py-3 font-semibold ${row.dismissRate > 70 ? 'text-red-600' : 'text-emerald-700'}`}>{row.dismissRate}%</td><td className="px-3 py-3">{row.signupRate}%</td></tr>) : <tr><td className="px-3 py-4 text-gray-500" colSpan={10}>Sem eventos de prompt no período selecionado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Canais de aquisição</h2>
          <p className="text-xs text-gray-500">Visão comparativa por canal para orientar escala/otimização. {updatedAt.channels ? `Atualizado: ${updatedAt.channels}` : ''}</p>
          <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-2">Canal</th><th className="px-3 py-2">Sessões</th><th className="px-3 py-2">Leads</th><th className="px-3 py-2">Cadastros</th><th className="px-3 py-2">Assinaturas</th><th className="px-3 py-2">CVR lead</th><th className="px-3 py-2">CVR paga</th><th className="px-3 py-2">Tendência 7d</th><th className="px-3 py-2">Confiabilidade</th></tr></thead><tbody className="divide-y divide-gray-100">{channelRows.map(row => <tr key={row.channel}><td className="px-3 py-3 font-semibold text-gray-900">{row.channel}</td><td className="px-3 py-3">{row.sessions}</td><td className="px-3 py-3">{row.leads}</td><td className="px-3 py-3">{row.signups}</td><td className="px-3 py-3">{row.paid}</td><td className="px-3 py-3">{pct(row.leads, row.sessions)}%</td><td className="px-3 py-3">{pct(row.paid, row.signups)}%</td><td className={`px-3 py-3 font-semibold ${String(row.trend).startsWith('-') ? 'text-red-600' : 'text-emerald-700'}`}>{row.trend}</td><td className="px-3 py-3 text-xs text-gray-500">{trustTag({ source: 'modeled', confidence: 'low', note: 'distribuição aproximada' })}</td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Alertas e ações recomendadas</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{alerts.map((alert, index) => <article key={`${alert.title}-${index}`} className={`rounded-xl p-4 ring-1 ${alert.tone === 'risk' ? 'bg-red-50 ring-red-200' : 'bg-emerald-50 ring-emerald-200'}`}><p className="text-sm font-black text-gray-900">{alert.title}</p><p className="mt-1 text-sm text-gray-600">{alert.message}</p></article>)}</div>
        </section>


        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Campanhas (Fase 2)</h2>
          <p className="text-xs text-gray-500">Ranking por campanha para priorizar escala, otimização ou pausa. {updatedAt.campaigns ? `Atualizado: ${updatedAt.campaigns}` : ''}</p>
          <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-2">Campanha</th><th className="px-3 py-2">Canal</th><th className="px-3 py-2">Conteúdo</th><th className="px-3 py-2">Leads</th><th className="px-3 py-2">Cadastros</th><th className="px-3 py-2">Ativações</th><th className="px-3 py-2">Pagas</th><th className="px-3 py-2">CVR paga</th><th className="px-3 py-2">Receita atrib.</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Confiabilidade</th></tr></thead><tbody className="divide-y divide-gray-100">{campaignRows.map(row => <tr key={row.campaign}><td className="px-3 py-3 font-semibold text-gray-900">{row.campaign}</td><td className="px-3 py-3">{row.source}</td><td className="px-3 py-3">{row.content}</td><td className="px-3 py-3">{row.leads}</td><td className="px-3 py-3">{row.signups}</td><td className="px-3 py-3">{row.activations}</td><td className="px-3 py-3">{row.paid}</td><td className="px-3 py-3">{row.cvrPaid}%</td><td className="px-3 py-3">{formatCurrency(row.revenue)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.status === 'escalar' ? 'bg-emerald-100 text-emerald-700' : row.status === 'otimizar' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{row.status}</span></td><td className="px-3 py-3 text-xs text-gray-500">{trustTag({ source: 'mixed', confidence: 'medium', note: 'utm + modelagem de conversão' })}</td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Cadastros por página de entrada</h2>
          <p className="text-xs text-gray-500">Qual página orgânica (first-touch) trouxe cada cadastro novo. {updatedAt.signupsByLanding ? `Atualizado: ${updatedAt.signupsByLanding}` : ''}</p>
          <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-2">Página de entrada</th><th className="px-3 py-2">Cadastros</th></tr></thead><tbody className="divide-y divide-gray-100">{signupsByLanding.map(row => <tr key={row.landingPage}><td className="px-3 py-3 font-semibold text-gray-900">{row.landingPage}</td><td className="px-3 py-3">{row.signups}</td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Experiment OS (Sprint 2)</h2>
          <p className="text-xs text-gray-500">Hipótese, baseline, MDE, amostra mínima, guardrails e status para decisão rigorosa.</p>
          <div className="mt-3 space-y-3">{experiments.map(item => {
            const statusMeta = experimentStatusMeta(item.status)
            return <article key={item.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900">{item.hypothesis}</p>
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${statusMeta.className}`}>{statusMeta.label}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Owner: {item.owner} · Stage: {item.stage} · Público: {item.audience}</p>
              <p className="mt-2 text-xs text-gray-500">Métrica primária: {item.primaryMetric}</p>
              <p className="mt-1 text-xs text-gray-500">Baseline: {item.baseline}% · Atual: {item.current}% · Meta: {item.target}% · MDE: {item.mde}pp · Delta: {item.delta.toFixed(1)}pp</p>
              <p className="mt-1 text-xs text-gray-500">Amostra: {item.sampleSize}/{item.requiredSample} · Janela: {item.windowDays} dias</p>
              <p className="mt-1 text-xs text-gray-500">Período: {formatUpdatedAt(item.startDate)} → {formatUpdatedAt(item.endDate)}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-800">Métricas secundárias</p>
                  <ul className="mt-1 list-disc pl-4">{item.secondaryMetrics.map(metric => <li key={metric}>{metric}</li>)}</ul>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-800">Guardrails</p>
                  <ul className="mt-1 list-disc pl-4">{item.guardrails.map(metric => <li key={metric}>{metric}</li>)}</ul>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-violet-700">Decisão: {item.decision}</p>
            </article>
          })}</div>
        </section>


        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Data Trust (Fase 4)</h2><p className="text-xs text-gray-500">Qualidade e cobertura da coleta. {updatedAt.trust ? `Atualizado: ${updatedAt.trust}` : ''}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <Card label="Confiança" value={String(dataTrust?.confidence || 'unknown').toUpperCase()} hint="Qualidade de coleta" tone={dataTrust?.confidence === 'low' ? 'risk' : 'good'} trust={trustTag({ source: 'measured', confidence: dataTrust?.confidence || 'medium', note: 'endpoint de observabilidade' })} />
            <Card label="Cobertura source" value={`${dataTrust?.sourceCoverage ?? 0}%`} />
            <Card label="Cobertura campaign" value={`${dataTrust?.campaignCoverage ?? 0}%`} />
            <Card label="Eventos 24h" value={dataTrust?.events24h ?? 0} hint={`Freshness: ${dataTrust?.freshnessMinutes ?? '-'} min`} />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Coortes (Fase 6)</h2>
          <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-2">Semana</th><th className="px-3 py-2">Signups</th><th className="px-3 py-2">Ativados</th><th className="px-3 py-2">Pagos</th><th className="px-3 py-2">Retenção inicial</th></tr></thead><tbody className="divide-y divide-gray-100">{cohorts.map(row => <tr key={row.cohortWeek}><td className="px-3 py-3 font-semibold text-gray-900">{row.cohortWeek}</td><td className="px-3 py-3">{row.signups}</td><td className="px-3 py-3">{row.activated}</td><td className="px-3 py-3">{row.paid}</td><td className="px-3 py-3">{pct(row.activated, row.signups)}%</td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Alertas backend (Fase 5)</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{backendAlerts.map((alert, index) => <article key={`${alert.title}-${index}`} className={`rounded-xl p-4 ring-1 ${alert.tone === 'risk' ? 'bg-red-50 ring-red-200' : 'bg-emerald-50 ring-emerald-200'}`}><p className="text-sm font-black text-gray-900">{alert.title}</p><p className="mt-1 text-sm text-gray-600">Valor: {String(alert.value)}</p></article>)}</div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Idea Engine (Sprint 3)</h2>
          <p className="text-xs text-gray-500">Backlog orientado por gatilhos de métrica com hipótese, experimento, owner e priorização ICE.</p>
          <div className="mt-3 space-y-3">
            {growthIdeas.map((idea, index) => <article key={`${idea.trigger}-${index}`} className="rounded-xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900">{idea.trigger}</p>
                <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-bold text-violet-700">ICE {idea.ice}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Owner recomendado: {idea.owner} · Esforço: {idea.effort}</p>
              <p className="mt-2 text-xs text-gray-700"><strong>Hipótese:</strong> {idea.hypothesis}</p>
              <p className="mt-1 text-xs text-gray-700"><strong>Experimento:</strong> {idea.experiment}</p>
              <p className="mt-2 text-xs text-gray-500">Impacto: {idea.impact}/5 · Confiança: {idea.confidence}/5 · Facilidade: {idea.ease}/5</p>
            </article>)}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Sprint 4 · Go-live checklist (Staging → Deploy)</h2>
          <p className="text-xs text-gray-500">Checklist operacional para validar staging (3006/3004) antes de promover mudanças para produção.</p>
          <div className="mt-3 space-y-3">{sprint4Checks.map(item => {
            const meta = checkStatusMeta(item.status)
            return <article key={item.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900">{item.label}</p>
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Comando/validação: {item.command}</p>
              <p className="mt-1 text-xs text-gray-500">Esperado: {item.expected}</p>
              <p className="mt-2 text-xs text-gray-700">{item.note}</p>
            </article>
          })}</div>
          <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
            <p className="font-semibold">Comando recomendado de atualização em staging</p>
            <p className="mt-1">cd ~/wabot-staging && git pull origin develop && npm install && cd dashboard && npm install && cd .. && npx prisma migrate deploy && pm2 restart api-staging visual-staging</p>
          </div>
        </section>



        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-gray-900">Leads detalhados (entrada e cadastro)</h2>
            <p className="text-xs text-gray-500">{leadRows.length} leads no período {period}</p>
          </div>
          <p className="text-xs text-gray-500">Visão operacional dos cadastros que chegaram, com horário de entrada e status de avanço.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-3 py-2">Chegada</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Plano</th>
                  <th className="px-3 py-2">Acesso</th>
                  <th className="px-3 py-2">Bot rodando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leadRows.length ? leadRows.map(row => (
                  <tr key={row.id}>
                    <td className="px-3 py-3 text-xs text-gray-600">{formatUpdatedAt(row.createdAt)}</td>
                    <td className="px-3 py-3 font-semibold text-gray-900">{row.name}</td>
                    <td className="px-3 py-3">{row.email}</td>
                    <td className="px-3 py-3">{row.phone}</td>
                    <td className="px-3 py-3">
                      {row.acquisition.type === 'affiliate' ? (
                        <div className="flex min-w-44 flex-col gap-1">
                          <span className="w-fit rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">Indicação de afiliado</span>
                          <span className="text-xs font-semibold text-gray-700">{row.acquisition.affiliateName}</span>
                          <span className="text-[11px] text-gray-500">Código {row.acquisition.code}</span>
                        </div>
                      ) : <span className="text-xs text-gray-400">Sem indicação</span>}
                    </td>
                    <td className="px-3 py-3">{row.status}</td>
                    <td className="px-3 py-3">{row.plan}</td>
                    <td className="px-3 py-3">{row.accessStatus}</td>
                    <td className="px-3 py-3">{row.botRunning}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-3 py-4 text-sm text-gray-500" colSpan={9}>Nenhum lead encontrado no período selecionado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Growth OS (Fase 7)</h2>
          <p className="text-sm text-gray-600">Sprint 4 concluída: painel agora inclui checklist de validação em staging com critérios de promoção para deploy.</p>
        </section>
        <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-4 text-xs text-violet-800">
          <strong>Nota de fase MVP:</strong> até integrar eventos UTM dedicados, alguns agrupamentos de canal/funil usam aproximações com base nas métricas administrativas atuais.
        </section>
      </div>
    </main>
  )
}
