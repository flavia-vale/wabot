'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const toneStyles = {
  ok: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
  warn: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  risk: 'border-orange-400/40 bg-orange-400/10 text-orange-100',
  critical: 'border-red-400/50 bg-red-500/10 text-red-100',
  info: 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100',
}

function numberFmt(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0))
}

function pct(part, total) {
  const denominator = Number(total || 0)
  if (!denominator) return 0
  return Math.round((Number(part || 0) / denominator) * 1000) / 10
}

function minutes(value) {
  return `${Math.round(Number(value || 0) / 60)}m`
}

function safeDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function normalizeTone(input) {
  const value = String(input || '').toLowerCase()
  if (['critical', 'fail', 'no-go'].includes(value)) return 'critical'
  if (['risk', 'error'].includes(value)) return 'risk'
  if (['warn', 'warning', 'degraded'].includes(value)) return 'warn'
  if (['ok', 'healthy', 'go'].includes(value)) return 'ok'
  return 'info'
}

function MetricTile({ label, value, helper, tone = 'info' }) {
  return (
    <article className={`rounded-3xl border p-4 shadow-2xl shadow-black/10 backdrop-blur ${toneStyles[tone] || toneStyles.info}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      {helper && <p className="mt-2 text-xs leading-relaxed opacity-75">{helper}</p>}
    </article>
  )
}

function SignalCard({ title, value, subtitle, tone = 'info' }) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Golden Signal</p>
          <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide ${toneStyles[tone] || toneStyles.info}`}>{tone}</span>
      </div>
      <p className="mt-5 text-4xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>
    </article>
  )
}

function AlertRow({ alert, index }) {
  const tone = normalizeTone(alert?.tone || alert?.severity)
  return (
    <div className={`rounded-2xl border p-4 ${toneStyles[tone] || toneStyles.info}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">{alert?.title || `Alerta ${index + 1}`}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-80">{String(alert?.value ?? alert?.message ?? 'Sem detalhe adicional')}</p>
        </div>
        <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-wide">{tone}</span>
      </div>
    </div>
  )
}

function RouteRow({ route }) {
  const errorRate = pct((route.status5xxCount || 0) + (route.status4xxCount || 0), route.count)
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs font-bold text-cyan-100">{route.method} {route.route}</p>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-200">{numberFmt(route.count)} req</span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-4">
        <span>{route.avgMs ?? 0}ms média</span>
        <span>{route.maxMs ?? 0}ms máx.</span>
        <span>{route.status5xxCount ?? 0} 5xx</span>
        <span>{errorRate}% erro</span>
      </div>
    </div>
  )
}

function DependencyPill({ label, ok, detail }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${ok ? toneStyles.ok : toneStyles.critical}`}>
      <p className="text-[11px] font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-sm font-black">{ok ? 'OK' : 'Atenção'}</p>
      {detail && <p className="mt-1 text-xs opacity-75">{detail}</p>}
    </div>
  )
}

export default function AdminObservabilityPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [admin, setAdmin] = useState(null)
  const [health, setHealth] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [observability, setObservability] = useState(null)
  const [logsSummary, setLogsSummary] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [telegram, setTelegram] = useState(null)

  async function loadData() {
    setError('')
    const [adminData, healthData, metricsData, observabilityData, logsSummaryData, sessionsData, telegramData] = await Promise.all([
      api.adminMe(),
      api.adminSystemHealth().catch(() => null),
      api.adminSystemMetrics().catch(() => null),
      api.adminSystemObservability().catch(() => null),
      api.adminLogsSummary('7d').catch(() => null),
      api.adminSessions({ limit: 50 }).catch(() => null),
      api.adminTelegramOverview().catch(() => null),
    ])
    setAdmin(adminData)
    setHealth(healthData)
    setMetrics(metricsData)
    setObservability(observabilityData)
    setLogsSummary(logsSummaryData)
    setSessions(sessionsData)
    setTelegram(telegramData)
  }

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => loadData())
      .catch((err) => { if (active) setError(err.message || 'Falha ao carregar observabilidade.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const goldenSignals = useMemo(() => {
    const contractSignals = observability?.goldenSignals ?? null
    const totalRequests = contractSignals?.traffic?.totalRequests ?? metrics?.totalRequests ?? health?.api?.totalRequests ?? 0
    const total5xx = contractSignals?.errors?.http5xx ?? metrics?.total5xx ?? health?.api?.total5xx ?? 0
    const total4xx = contractSignals?.errors?.http4xx ?? metrics?.total4xx ?? health?.api?.total4xx ?? 0
    const errorRate = contractSignals?.errors?.httpErrorRatePct ?? pct(total4xx + total5xx, totalRequests)
    const messages = logsSummary?.counts ?? {}
    const messageAttempts = contractSignals?.traffic?.messageAttempts ?? ((messages.success || 0) + (messages.timeoutTotal || 0) + (messages.errorOther || 0) + (messages.skippedConfig || 0) + (messages.skippedDedup || 0))
    const sendErrorRate = contractSignals?.errors?.sendFailureRatePct ?? pct((messages.timeoutTotal || 0) + (messages.errorOther || 0), messageAttempts)
    const sessionRows = sessions?.sessions ?? []
    const disconnected = contractSignals?.saturation?.disconnectedSessions ?? sessionRows.filter(session => session.status !== 'connected').length
    return {
      latency: {
        value: `${contractSignals?.latency?.valueMs ?? metrics?.p95RouteAvgMs ?? health?.api?.p95RouteAvgMs ?? 0}ms`,
        subtitle: `P95 aproximado · média global ${contractSignals?.latency?.avgMs ?? metrics?.avgLatencyMs ?? health?.api?.avgLatencyMs ?? 0}ms`,
        tone: normalizeTone(contractSignals?.latency?.status || ((metrics?.p95RouteAvgMs ?? 0) > 1500 ? 'risk' : 'ok')),
      },
      traffic: {
        value: numberFmt(totalRequests),
        subtitle: `Requests desde o boot · ${numberFmt(messageAttempts)} eventos de MessageLog no contrato`,
        tone: normalizeTone(contractSignals?.traffic?.status || (totalRequests > 0 ? 'ok' : 'warn')),
      },
      errors: {
        value: `${errorRate}%`,
        subtitle: `${numberFmt(total5xx)} respostas 5xx · erro de envio ${sendErrorRate}%`,
        tone: normalizeTone(contractSignals?.errors?.status || (total5xx > 0 || sendErrorRate >= 5 ? 'risk' : 'ok')),
      },
      saturation: {
        value: `${contractSignals?.saturation?.inFlight ?? 0} em voo`,
        subtitle: `${disconnected}/${(contractSignals?.saturation?.totalSessions ?? sessionRows.length) || 0} sessões não conectadas · uptime ${minutes(contractSignals?.saturation?.uptimeSeconds ?? metrics?.uptimeSeconds ?? health?.uptimeSeconds)}`,
        tone: normalizeTone(contractSignals?.saturation?.status || health?.status || 'ok'),
      },
    }
  }, [health, logsSummary, metrics, observability, sessions])

  if (loading) return <LoadingState title="Carregando observabilidade" message="Consolidando API, logs, sessões, Telegram e gate operacional." />

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <Alert type="error" title="Falha ao carregar observabilidade" message={error} />
        <Link href="/admin" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950">Voltar ao admin</Link>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071018] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-cyan-200">Wabot Mission Control</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl">Observabilidade operacional</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Etapa 1 da Fase 1: uma central técnica dedicada reaproveitando os contratos já existentes do Admin para Latência, Tráfego, Erros, Saturação, dependências, filas, sessões e integrações.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => loadData().catch((err) => setError(err.message))} className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-200">Atualizar telemetria</button>
              <Link href="/admin" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15">Voltar ao admin</Link>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full bg-white/10 px-3 py-1">Admin: {admin?.role || '—'}</span>
            <span className="rounded-full bg-white/10 px-3 py-1">Fonte: contratos `/api/admin` existentes</span>
            <span className="rounded-full bg-white/10 px-3 py-1">Sem novos endpoints nesta etapa</span>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SignalCard title="Latência" value={goldenSignals.latency.value} subtitle={goldenSignals.latency.subtitle} tone={goldenSignals.latency.tone} />
          <SignalCard title="Tráfego" value={goldenSignals.traffic.value} subtitle={goldenSignals.traffic.subtitle} tone={goldenSignals.traffic.tone} />
          <SignalCard title="Erros" value={goldenSignals.errors.value} subtitle={goldenSignals.errors.subtitle} tone={goldenSignals.errors.tone} />
          <SignalCard title="Saturação" value={goldenSignals.saturation.value} subtitle={goldenSignals.saturation.subtitle} tone={goldenSignals.saturation.tone} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Gate operacional</p>
                <h2 className="mt-1 text-2xl font-black text-white">GO/NO-GO de produção</h2>
                <p className="mt-2 text-sm text-slate-400">Sinais já calculados por `/system/observability`, exibidos como alerta acionável.</p>
              </div>
              <span className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide ${observability?.goNoGo?.recommended === 'go' ? toneStyles.ok : toneStyles.critical}`}>{observability?.goNoGo?.recommended || 'no-go'}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <MetricTile label="DB" value={observability?.goNoGo?.dbOk ? 'OK' : 'Falha'} tone={observability?.goNoGo?.dbOk ? 'ok' : 'critical'} />
              <MetricTile label="5xx" value={numberFmt(observability?.api?.total5xx ?? metrics?.total5xx)} tone={(observability?.api?.total5xx ?? metrics?.total5xx ?? 0) > 0 ? 'risk' : 'ok'} />
              <MetricTile label="Payment DLQ" value={numberFmt(observability?.goNoGo?.paymentDlqOpen)} tone={(observability?.goNoGo?.paymentDlqOpen ?? 0) > 0 ? 'warn' : 'ok'} />
              <MetricTile label="Uptime" value={minutes(observability?.goNoGo?.uptimeSeconds ?? metrics?.uptimeSeconds)} tone={(observability?.goNoGo?.uptimeSeconds ?? metrics?.uptimeSeconds ?? 0) < 300 ? 'warn' : 'ok'} />
            </div>
            <div className="mt-5 space-y-3">
              {(observability?.alerts ?? []).map((alert, index) => <AlertRow key={`${alert.title}-${index}`} alert={alert} index={index} />)}
              {!observability?.alerts?.length && <div className={`rounded-2xl border p-4 ${toneStyles.ok}`}>Nenhum alerta operacional ativo nos sinais atuais.</div>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Dependências</p>
            <h2 className="mt-1 text-2xl font-black text-white">Mapa vivo</h2>
            <div className="mt-5 grid gap-3">
              <DependencyPill label="SQLite/Prisma" ok={Boolean(observability?.dependencies?.database?.ok ?? health?.dbOk)} detail={observability?.dependencies?.database?.probe || 'SELECT 1 via admin health'} />
              <DependencyPill label="Fastify API" ok={Boolean(observability?.dependencies?.api?.ok ?? health)} detail={`${numberFmt(observability?.dependencies?.api?.totalRequests ?? metrics?.totalRequests)} req desde boot`} />
              <DependencyPill label="Redis" ok={Boolean(observability?.dependencies?.redis?.ok)} detail={observability?.dependencies?.redis?.requiredForRemoteSupervisor ? 'Obrigatório no modo remote' : 'Opcional no modo inline'} />
              <DependencyPill label="Supervisor" ok={Boolean(observability?.dependencies?.supervisor?.ok ?? ((observability?.supervisor?.sessionOwnerMismatchTotal ?? 0) === 0))} detail={`${observability?.supervisor?.mode || 'inline'} · alive ${String(observability?.supervisor?.alive ?? 'n/a')}`} />
              <DependencyPill label="Telegram Offer Bot" ok={Boolean(telegram?.config?.tokenConfigured)} detail={`${telegram?.successRate ?? 0}% sucesso · último evento ${safeDate(telegram?.lastEventAt)}`} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl xl:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Rotas API</p>
                <h2 className="mt-1 text-2xl font-black text-white">Top rotas por tráfego</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-300">Top 8</span>
            </div>
            <div className="mt-5 space-y-3">
              {(metrics?.routes ?? []).slice(0, 8).map(route => <RouteRow key={`${route.method}-${route.route}`} route={route} />)}
              {!metrics?.routes?.length && <p className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">Sem métricas de rota disponíveis neste boot.</p>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">MessageLog 7d</p>
            <h2 className="mt-1 text-2xl font-black text-white">Erros e bloqueios</h2>
            <div className="mt-5 grid gap-3">
              <MetricTile label="Sucesso" value={numberFmt(logsSummary?.counts?.success)} tone="ok" />
              <MetricTile label="Dedup" value={numberFmt(logsSummary?.counts?.skippedDedup)} tone="info" helper="Bloqueios esperados, não incidente." />
              <MetricTile label="Config block" value={numberFmt(logsSummary?.counts?.skippedConfig)} tone="warn" />
              <MetricTile label="Timeout" value={numberFmt(logsSummary?.counts?.timeoutTotal)} tone={(logsSummary?.counts?.timeoutTotal ?? 0) > 0 ? 'risk' : 'ok'} />
              <MetricTile label="Outros erros" value={numberFmt(logsSummary?.counts?.errorOther)} tone={(logsSummary?.counts?.errorOther ?? 0) > 0 ? 'critical' : 'ok'} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Filas</p>
            <h2 className="mt-1 text-2xl font-black text-white">Backpressure e DLQs</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricTile label="Offer items" value={numberFmt(observability?.queues?.offerQueueItems?.total)} tone="info" helper="Total por status no banco." />
              <MetricTile label="Queued/Sending" value={numberFmt((observability?.queues?.offerQueueItems?.queued || 0) + (observability?.queues?.offerQueueItems?.sending || 0))} tone={((observability?.queues?.offerQueueItems?.queued || 0) + (observability?.queues?.offerQueueItems?.sending || 0)) > 0 ? 'warn' : 'ok'} />
              <MetricTile label="Send DLQ" value={numberFmt(observability?.queues?.sendDlq?.lastKnownDlqTotal)} tone={(observability?.queues?.sendDlq?.lastKnownDlqTotal || 0) > 0 ? 'risk' : 'ok'} />
            </div>
            <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">Payment DLQ aberta: {numberFmt(observability?.queues?.paymentWebhookDlq?.open)} · última poda de DLQ: {observability?.queues?.sendDlq?.lastRunAt ? safeDate(observability.queues.sendDlq.lastRunAt) : 'sem execução registrada'} · removidos: {numberFmt(observability?.queues?.sendDlq?.lastRemovedTotal)}</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Privacidade</p>
            <h2 className="mt-1 text-2xl font-black text-white">Contrato safe-summary</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricTile label="MessageText bruto" value={observability?.privacy?.exposesRawMessageText ? 'Exposto' : 'Não'} tone={observability?.privacy?.exposesRawMessageText ? 'critical' : 'ok'} />
              <MetricTile label="Credenciais brutas" value={observability?.privacy?.exposesRawCredentialData ? 'Expostas' : 'Não'} tone={observability?.privacy?.exposesRawCredentialData ? 'critical' : 'ok'} />
            </div>
            <div className="mt-4 space-y-2">
              {(observability?.privacy?.notes ?? []).map((note) => <p key={note} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-300">{note}</p>)}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Sessões WhatsApp</p>
            <h2 className="mt-1 text-2xl font-black text-white">Estado das conexões</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricTile label="Total" value={numberFmt(sessions?.total ?? sessions?.sessions?.length)} tone="info" />
              <MetricTile label="Conectadas" value={numberFmt((sessions?.sessions ?? []).filter(s => s.status === 'connected').length)} tone="ok" />
              <MetricTile label="Bots rodando" value={numberFmt((sessions?.sessions ?? []).filter(s => s.botRunning).length)} tone="info" />
            </div>
            <div className="mt-5 space-y-2">
              {(sessions?.sessions ?? []).slice(0, 6).map(session => (
                <div key={session.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-xs">
                  <span className="font-bold text-white">{session.user?.email || session.user?.id}</span>
                  <span className="text-slate-400">{session.status} · bot {session.botRunning ? 'on' : 'off'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Integrações</p>
            <h2 className="mt-1 text-2xl font-black text-white">Telegram Offer Bot</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricTile label="24h" value={numberFmt(telegram?.totals?.count24h)} tone="info" />
              <MetricTile label="7d" value={numberFmt(telegram?.totals?.count7d)} tone="info" />
              <MetricTile label="Sucesso" value={`${telegram?.successRate ?? 0}%`} tone={(telegram?.successRate ?? 0) >= 80 ? 'ok' : 'warn'} />
              <MetricTile label="Com imagem" value={`${telegram?.withImageRate ?? 0}%`} tone="info" />
            </div>
            <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">Token: {telegram?.config?.tokenConfigured ? 'configurado' : 'ausente'} · chats permitidos: {telegram?.config?.allowedChatCount ?? 0} · último evento: {safeDate(telegram?.lastEventAt)}</p>
          </div>
        </section>
      </div>
    </main>
  )
}
