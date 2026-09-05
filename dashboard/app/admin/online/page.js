'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import { PayingTag } from '@/components/PayingTag'

const asArray = (value) => Array.isArray(value) ? value : []

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatRelative(value) {
  if (!value) return 'sem atividade'
  const ms = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(ms)) return 'sem atividade'
  const minutes = Math.max(0, Math.round(ms / 60000))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h atrás`
  return `${Math.round(hours / 24)}d atrás`
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))
}

const DATE_SORT_OPTIONS = [
  ['default', 'Padrão'],
  ['createdAt', 'Data de criação'],
  ['lastMessageAt', 'Último envio'],
]

function sortByDateField(list, field) {
  if (field === 'default') return list
  return [...list].sort((a, b) => {
    const av = a?.[field] ? new Date(a[field]).getTime() : 0
    const bv = b?.[field] ? new Date(b[field]).getTime() : 0
    return bv - av
  })
}

function SortBar({ value, onChange }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-bold text-slate-600">Ordenar por:</span>
      {DATE_SORT_OPTIONS.map(([key, label]) => (
        <button key={key} type="button" onClick={() => onChange(key)} className={`rounded-full px-3 py-1.5 font-bold ring-1 ${value === key ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-200'}`}>{label}</button>
      ))}
    </div>
  )
}

// Telefone mascarado (ex.: "551*****99", vindo de sanitizeUser para quem não
// tem support:write) não vira link válido — trata como ausente em vez de
// montar um wa.me quebrado.
function normalizePhoneForWa(phone) {
  const raw = String(phone || '').trim()
  if (!raw || raw.includes('*')) return null
  const digits = raw.replace(/\D/g, '')
  return digits || null
}

function WhatsAppButton({ phone }) {
  const digits = normalizePhoneForWa(phone)
  if (!digits) {
    return <span className="rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-black text-slate-400">Sem WhatsApp</span>
  }
  return (
    <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="rounded-xl bg-green-600 px-3 py-2 text-center text-xs font-black text-white hover:bg-green-700">WhatsApp</a>
  )
}


// Quem resolve a desconexão — espelha src/core/sessionOwnership.js.
const OWNER_META = {
  connected: { label: 'conectado', className: 'bg-emerald-50 text-emerald-700' },
  robo: { label: 'o robô está tentando', className: 'bg-sky-50 text-sky-700' },
  cliente: { label: 'precisa da cliente (QR)', className: 'bg-amber-50 text-amber-800' },
  cliente_desligou: { label: 'ela desligou', className: 'bg-slate-100 text-slate-600' },
  bloqueio: { label: 'número recusado pelo WhatsApp', className: 'bg-red-50 text-red-700' },
  ninguem: { label: 'parada, ninguém tentando', className: 'bg-red-100 text-red-800' },
  acesso_vencido: { label: 'acesso vencido', className: 'bg-purple-50 text-purple-700' },
}

function formatDurationMs(value) {
  const ms = Math.max(0, Number(value ?? 0))
  if (!Number.isFinite(ms) || ms <= 0) return '0min'
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest ? `${hours}h ${rest}min` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours ? `${days}d ${remHours}h` : `${days}d`
}

function statusMeta(status, lifecycle) {
  if (status === 'connected') return { label: 'Conectado', className: 'bg-emerald-100 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' }
  if (status === 'connecting' || lifecycle === 'reconnecting') return { label: lifecycle === 'reconnecting' ? 'Tentando reconectar' : 'Tentando conectar', className: 'bg-amber-100 text-amber-800 ring-amber-200', dot: 'bg-amber-500' }
  return { label: 'Desconectado', className: 'bg-red-100 text-red-700 ring-red-200', dot: 'bg-red-500' }
}

function OnlineCard({ label, value, helper, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-950 text-white ring-slate-800',
    green: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-900 ring-amber-200',
    red: 'bg-red-50 text-red-900 ring-red-200',
  }
  return (
    <article className={`rounded-3xl p-5 shadow-sm ring-1 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-70">{label}</p>
      <p className="mt-3 text-4xl font-black tabular-nums">{value}</p>
      {helper && <p className="mt-2 text-sm font-medium opacity-75">{helper}</p>}
    </article>
  )
}

function UserDrawer({ detail, loading, onClose }) {
  if (!detail && !loading) return null
  const session = detail?.session
  const meta = statusMeta(session?.status, session?.lifecycle)
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar painel" />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Drill-down online</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{detail?.user?.name || detail?.user?.email || 'Carregando...'}</h2>
            <p className="text-sm text-slate-500">{detail?.user?.email || '—'} · {detail?.user?.plan || '—'}</p>
          </div>
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">Fechar</button>
        </div>

        {loading && <LoadingState />}
        {!loading && detail && (
          <div className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ring-1 ${meta.className}`}>
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">Heartbeat: {formatRelative(session?.lastHeartbeatAt)}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">Código: {session?.lastDisconnectCode || '—'}</span>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <OnlineCard label="Quedas 24h" value={formatNumber(detail.connectionMetrics?.disconnects24h)} tone={detail.connectionMetrics?.disconnects24h ? 'red' : 'green'} />
              <OnlineCard label="Ações manuais 24h" value={formatNumber(detail.connectionMetrics?.manualReconnects24h)} helper="start/pareamento pedidos pelo cliente" tone={detail.connectionMetrics?.manualReconnects24h ? 'red' : 'green'} />
              <OnlineCard label="Offline auto 24h" value={formatDurationMs((detail.connectionMetrics?.automaticOfflineMs24h || 0) + (detail.connectionMetrics?.ongoingOfflineMs24h || 0))} helper="tempo até recuperação automática" tone={(detail.connectionMetrics?.automaticOfflineMs24h || detail.connectionMetrics?.ongoingOfflineMs24h) ? 'amber' : 'green'} />
              <OnlineCard label="Quedas 7d" value={formatNumber(detail.connectionMetrics?.disconnects7d)} tone={detail.connectionMetrics?.disconnects7d ? 'red' : 'green'} />
              <OnlineCard label="Ações manuais 7d" value={formatNumber(detail.connectionMetrics?.manualReconnects7d)} helper="trabalho real do cliente" tone={detail.connectionMetrics?.manualReconnects7d ? 'red' : 'green'} />
              <OnlineCard label="Offline auto 7d" value={formatDurationMs((detail.connectionMetrics?.automaticOfflineMs7d || 0) + (detail.connectionMetrics?.ongoingOfflineMs7d || 0))} helper={`${formatNumber(detail.connectionMetrics?.automaticRecoveries7d)} recuperação(ões) automáticas`} tone={(detail.connectionMetrics?.automaticOfflineMs7d || detail.connectionMetrics?.ongoingOfflineMs7d) ? 'amber' : 'green'} />
              <OnlineCard label="Parado até o cliente agir 7d" value={formatDurationMs(detail.connectionMetrics?.manualOfflineMs7d)} helper={`${formatNumber(detail.connectionMetrics?.manualRecoveries7d)} episódio(s) que só voltaram com ação dele`} tone={detail.connectionMetrics?.manualOfflineMs7d ? 'red' : 'green'} />
            </section>

            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-black">Como ler estas métricas</p>
              <p className="mt-1">&quot;Ações manuais&quot; conta quando o cliente precisou iniciar/reparear pelo painel. &quot;Offline auto&quot; mede o tempo em que o robô ficou fora até o sistema recuperar sozinho; tentativas internas de backoff não entram como trabalho do cliente. &quot;Parado até o cliente agir&quot; é o tempo que ele ficou sem robô esperando, antes de ir lá resolver — é a métrica que mede a promessa do produto.</p>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Linha do tempo das quedas (7 dias)</h3>
              <p className="mt-1 text-xs text-slate-500">Cada linha é um episódio fora do ar: quando começou, quanto durou e se o robô voltou sozinho ou só voltou depois que o cliente agiu.</p>
              <div className="mt-3 divide-y divide-slate-100">
                {asArray(detail.offlineEpisodes).map((episode) => {
                  const tone = episode.open ? 'bg-amber-50 text-amber-800' : episode.endedBy === 'sozinho' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  const label = episode.open ? 'em aberto' : episode.endedBy === 'sozinho' ? 'voltou sozinho' : episode.endedBy === 'cliente' ? 'o cliente teve que agir' : 'interrompido'
                  return (
                    <div key={`${episode.startedAt}-${episode.endedAt || 'aberto'}`} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 text-sm">
                      <div>
                        <p className="font-bold text-slate-900">{formatDate(episode.startedAt)} → {episode.endedAt ? formatDate(episode.endedAt) : 'agora'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDurationMs(episode.durationMs)} fora
                          {episode.code ? ` · código ${episode.code}` : ''}
                          {episode.stuckMsg ? ' · mensagem travada' : ''}
                          {episode.terminal ? ' · sessão deslogada' : ''}
                        </p>
                      </div>
                      <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ${tone}`}>{label}</span>
                    </div>
                  )
                })}
                {!asArray(detail.offlineEpisodes).length && <p className="py-4 text-sm text-slate-500">Nenhuma queda registrada nos últimos 7 dias.</p>}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Erros agrupados por tipo</h3>
              <div className="mt-3 divide-y divide-slate-100">
                {asArray(detail.errorsByType).map((item) => (
                  <div key={item.errorMsg} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                    <div>
                      <p className="break-words font-mono text-xs font-bold text-slate-900">{item.errorMsg}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.category || 'UNKNOWN'} · último {formatDate(item.lastSeenAt)}</p>
                    </div>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{formatNumber(item.count)}x</span>
                  </div>
                ))}
                {!asArray(detail.errorsByType).length && <p className="py-4 text-sm text-slate-500">Sem erros recentes para este usuário nos últimos 7 dias.</p>}
              </div>
            </section>

            {!!asArray(detail.desyncGroups).length && (
              <section className="rounded-3xl border border-orange-200 bg-orange-50 p-4">
                <h3 className="text-sm font-black uppercase tracking-wide text-orange-900">Grupos derrubando a sessão (dessincronizados)</h3>
                <p className="mt-1 text-xs text-orange-800">Grupos não-monitorados com falha de sincronização que fazem o robô cair sozinho. Recomende ao cliente <strong>sair do grupo</strong> — o robô não usa esses grupos.</p>
                <div className="mt-3 divide-y divide-orange-100">
                  {asArray(detail.desyncGroups).map((item) => (
                    <div key={item.jid} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                      <div>
                        <p className="break-words font-black text-slate-900">{item.name || 'Grupo sem nome resolvido'}</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{item.jid}</p>
                        <p className="mt-1 text-xs text-slate-500">último {formatDate(item.lastSeenAt)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {item.unresolved
                          ? <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">não resolvido</span>
                          : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">auto-refresh ativo</span>}
                        <span className="text-xs text-slate-500">{formatNumber(item.autoheals)} refresh(es)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Linha do tempo de conexão</h3>
              <div className="mt-3 space-y-2">
                {asArray(detail.recentEvents).slice(0, 20).map((event) => (
                  <div key={event.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black text-slate-900">{event.type}</p>
                      <span className="text-xs font-bold text-slate-500">{formatDate(event.occurredAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Código {event.code || '—'} · lifecycle {event.lifecycle || '—'} · owner {event.ownerInstance || '—'}</p>
                  </div>
                ))}
                {!asArray(detail.recentEvents).length && <p className="py-4 text-sm text-slate-500">Sem eventos de conexão registrados nos últimos 7 dias.</p>}
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  )
}

export default function AdminOnlinePage() {
  const [data, setData] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [waStatus, setWaStatus] = useState('all')
  const [plan, setPlan] = useState('all')
  const [activity, setActivity] = useState('all')
  const [minErrors, setMinErrors] = useState('')
  const [error, setError] = useState('')
  const [reconnecting, setReconnecting] = useState(null)
  // Conta vencida há muito tempo sai da visão por padrão (ver
  // src/core/adminVisibility.js). "Ver mais" traz de volta.
  const [verVencidasAntigas, setVerVencidasAntigas] = useState(false)
  const [feedback, setFeedback] = useState('')

  function currentFilters(extra = {}) {
    return {
      limit: 120,
      search,
      waStatus,
      plan,
      activity,
      minErrors,
      incluirVencidos: verVencidasAntigas ? 1 : '',
      ...extra,
    }
  }

  async function load(params = {}) {
    setError('')
    const result = await api.adminOnline(currentFilters(params))
    setData(result)
  }

  useEffect(() => {
    let active = true
    api.adminOnline(currentFilters())
      .then((result) => { if (active) setData(result) })
      .catch((err) => { if (active) setError(err.message || 'Falha ao carregar ONLINE.') })
      .finally(() => { if (active) setLoading(false) })
    const timer = setInterval(() => {
      api.adminOnline(currentFilters()).then((result) => { if (active) setData(result) }).catch(() => {})
    }, 15000)
    return () => { active = false; clearInterval(timer) }
  }, [search, waStatus, plan, activity, minErrors, verVencidasAntigas])

  // Sobe o robô da cliente sem que ela precise fazer nada. O botão só aparece
  // quando a credencial ainda existe (`canAdminRetry`) — em conta que precisa
  // de QR novo ele não resolveria, e a API recusa por garantia.
  async function reconnect(userId) {
    setReconnecting(userId)
    setError('')
    setFeedback('')
    try {
      const result = await api.adminOnlineReconnect(userId)
      setFeedback(result?.message || 'Robô iniciado.')
      await load().catch(() => {})
    } catch (err) {
      setError(err.message || 'Não consegui subir o robô.')
    } finally {
      setReconnecting(null)
    }
  }

  async function openDetail(userId) {
    setDetailLoading(true)
    setDetail(null)
    try {
      setDetail(await api.adminOnlineUser(userId))
    } catch (err) {
      setError(err.message || 'Falha ao carregar detalhes do usuário.')
    } finally {
      setDetailLoading(false)
    }
  }

  const [sortBy, setSortBy] = useState('default')
  const users = useMemo(() => sortByDateField(asArray(data?.users), sortBy), [data, sortBy])
  const criticalUsers = useMemo(() => users.filter(user => user.waSession && user.waSession.status !== 'connected'), [users])

  if (loading) return <LoadingState />

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="sticky top-0 z-20 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">ONLINE · Tempo real</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Usuários e conexões agora</h1>
              <p className="mt-1 text-sm text-slate-500">Status vivo de WhatsApp, quedas, reconexões e erros recentes por usuário.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => load()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">Atualizar agora</button>
              <Link href="/admin" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100">Centro operacional</Link>
              <Link href="/admin/observabilidade" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Observabilidade</Link>
            </div>
          </div>
        </header>

        {error && <Alert type="error" title="ONLINE" message={error} />}
        {feedback && <Alert type="success" title="Reconexão" message={feedback} />}
        {(verVencidasAntigas || !!data?.summary?.ocultasPorVencimento) && (
          <button
            type="button"
            onClick={() => setVerVencidasAntigas(!verVencidasAntigas)}
            className="text-xs font-black text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
          >
            {verVencidasAntigas
              ? `Ocultar quem venceu há mais de ${data?.summary?.janelaVencimentoDias ?? 30} dias`
              : `Ver mais (${data?.summary?.ocultasPorVencimento} vencida(s) há mais de ${data?.summary?.janelaVencimentoDias ?? 30} dias)`}
          </button>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          <OnlineCard label="Usuários online agora" value={formatNumber(data?.summary?.onlineUsers)} helper={`${formatNumber(data?.summary?.totalSessions)} sessões monitoradas`} tone="green" />
          <OnlineCard label="Estabilidade" value={`${data?.summary?.stabilityPct ?? 100}%`} helper="Conectados ou reconectando com heartbeat recente" tone={(data?.summary?.stabilityPct ?? 100) >= 90 ? 'green' : (data?.summary?.stabilityPct ?? 100) >= 75 ? 'amber' : 'red'} />
        </section>

        {!!criticalUsers.length && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-black text-red-800">{criticalUsers.length} instância(s) precisam de atenção agora.</p>
            <p className="mt-1 text-sm text-red-700">Priorize usuários desconectados, com muitas quedas 24h ou com erros recentes.</p>
          </section>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Usuários ativos</h2>
              <p className="text-sm text-slate-500">{users.length} usuários carregados · filtros aplicados em tempo real · atualização automática a cada 15s.</p>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); load() }} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[220px_160px_130px_190px_120px_90px]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome ou e-mail" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
              <select value={waStatus} onChange={(event) => setWaStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="all">Todos status</option>
                <option value="alerts">Só alertas</option>
                <option value="connected">Conectados</option>
                <option value="connecting">Tentando conectar</option>
                <option value="disconnected">Desconectados</option>
                <option value="without_session">Sem sessão</option>
              </select>
              <select value={plan} onChange={(event) => setPlan(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="all">Todos planos</option>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
              <select value={activity} onChange={(event) => setActivity(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="all">Toda atividade</option>
                <option value="with_sends_24h">Com envios 24h</option>
                <option value="without_activity_24h">Sem atividade 24h</option>
              </select>
              <input value={minErrors} onChange={(event) => setMinErrors(event.target.value)} type="number" min="0" placeholder="Erros mín." className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
              <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Filtrar</button>
            </form>
          </div>

          <SortBar value={sortBy} onChange={setSortBy} />

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-y border-slate-100 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-3 py-3">Usuário</th>
                  <th className="px-3 py-3">WhatsApp</th>
                  <th className="px-3 py-3">Última atividade</th>
                  <th className="px-3 py-3 text-right">Envios 24h</th>
                  <th className="px-3 py-3 text-right">Quedas 24h</th>
                  <th className="px-3 py-3 text-right">Recuperação</th>
                  <th className="px-3 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const meta = statusMeta(user.waSession?.status, user.waSession?.lifecycle)
                  return (
                    <tr key={user.id} className="align-top hover:bg-slate-50">
                      <td className="px-3 py-4">
                        <p className="flex flex-wrap items-center gap-2 font-black text-slate-900">{user.name || user.email}<PayingTag status={user.payingStatus} compact /></p>
                        <p className="text-xs text-slate-500">{user.email} · {user.plan}</p>
                        <p className="mt-1 text-[11px] text-slate-400">Criado em: {formatDate(user.createdAt)}</p>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ring-1 ${meta.className}`}>
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">HB {formatRelative(user.waSession?.lastHeartbeatAt)}</p>
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-600">
                        <p className="font-bold">{formatRelative(user.effectiveLastActivityAt)}</p>
                        <p>{formatDate(user.effectiveLastActivityAt)}</p>
                        <p className="mt-1 text-slate-400">Último envio: {formatDate(user.lastMessageAt)}</p>
                      </td>
                      <td className="px-3 py-4 text-right text-xs tabular-nums">
                        <p className="font-black text-emerald-700">{formatNumber(user.successCount24h)} sucesso</p>
                        <p className="font-black text-red-700">{formatNumber(user.errorCount24h)} erro</p>
                      </td>
                      <td className="px-3 py-4 text-right font-black tabular-nums text-red-700">{formatNumber(user.disconnects24h)}</td>
                      <td className="px-3 py-4 text-right text-xs text-slate-600">
                        <p><strong>{formatDurationMs((user.automaticOfflineMs24h || 0) + (user.ongoingOfflineMs24h || 0))}</strong> offline auto</p>
                        <p>{formatNumber(user.manualReconnects24h)} ação(ões) manuais</p>
                        {!!user.manualOfflineMs24h && <p className="font-bold text-red-700">{formatDurationMs(user.manualOfflineMs24h)} parado até agir</p>}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-col gap-2">
                          {user.sessionOwner && user.sessionOwner !== 'connected' && (
                            <span
                              title={user.sessionOwnerReason || ''}
                              className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-center text-[11px] font-black ${(OWNER_META[user.sessionOwner] || {}).className || 'bg-slate-100 text-slate-600'}`}
                            >
                              {(OWNER_META[user.sessionOwner] || {}).label || user.sessionOwner}
                            </span>
                          )}
                          <button onClick={() => openDetail(user.id)} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">Abrir detalhes</button>
                          {user.canAdminRetry && (
                            <button
                              onClick={() => reconnect(user.id)}
                              disabled={reconnecting === user.id}
                              className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white hover:bg-sky-700 disabled:opacity-60"
                            >
                              {reconnecting === user.id ? 'Subindo…' : 'Tentar reconectar'}
                            </button>
                          )}
                          <WhatsAppButton phone={user.contactPhone} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!users.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum usuário ativo encontrado.</p>}
        </section>
      </div>
      <UserDrawer detail={detail} loading={detailLoading} onClose={() => { setDetail(null); setDetailLoading(false) }} />
    </main>
  )
}
