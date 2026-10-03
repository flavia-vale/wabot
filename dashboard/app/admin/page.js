'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import SectionErrorBoundary from '@/components/SectionErrorBoundary'
import { PayingTag } from '@/components/PayingTag'
import { HelpDot } from '@/components/HelpDot'
import { CARD_HELP } from '@/lib/admin/cardHelp'
import { canAccessCustomerSuccess as canAccessCustomerSuccessFor } from '@/lib/admin/access'


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
  ['wa_disconnected', 'WhatsApp off'],
]
const asArray = (value) => Array.isArray(value) ? value : []
const asPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}

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

function SortBar({ value, onChange, options = DATE_SORT_OPTIONS }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-bold text-gray-600">Ordenar por:</span>
      {options.map(([key, label]) => (
        <button key={key} type="button" onClick={() => onChange(key)} className={`rounded-full px-3 py-1.5 font-bold ring-1 ${value === key ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-gray-600 ring-gray-200'}`}>{label}</button>
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

function WhatsAppButton({ phone, className = '' }) {
  const digits = normalizePhoneForWa(phone)
  if (!digits) {
    return <span className={`rounded-lg bg-gray-100 px-3 py-2 text-center text-xs font-bold text-gray-400 ${className}`}>Sem WhatsApp</span>
  }
  return (
    <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className={`rounded-lg bg-green-600 px-3 py-2 text-center text-xs font-bold text-white hover:bg-green-700 ${className}`}>WhatsApp</a>
  )
}

const SUCCESS_REASON_LABELS = {
  missing_phone: 'Sem celular',
  paid_stale_48h: 'Pago parado 48h',
  wa_disconnected: 'WhatsApp desconectado',
  no_first_success: 'Sem primeiro sucesso',
  onboarding_incomplete: 'Onboarding incompleto',
  expiring_soon: 'Expira em 7 dias',
  high_errors_24h: 'Muitos erros 24h',
}

const TABS = [
  ['inicio', 'Início'],
  ['online', 'Online'],
  ['sucesso', 'Sucesso do Cliente'],
  ['afiliados', 'Afiliados'],
]

const COMMISSION_META = {
  paid: { label: 'Paga', cls: 'bg-emerald-100 text-emerald-700' },
  eligible: { label: 'Elegível', cls: 'bg-sky-100 text-sky-700' },
  approved: { label: 'Aprovada', cls: 'bg-indigo-100 text-indigo-700' },
  held: { label: 'Em análise', cls: 'bg-orange-100 text-orange-700' },
  rejected: { label: 'Rejeitada', cls: 'bg-red-100 text-red-700' },
  reversed: { label: 'Revertida', cls: 'bg-gray-200 text-gray-600' },
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
}

function centsToBRL(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents ?? 0) / 100)
}

function SecondarySection({ title, eyebrow, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-col gap-2 p-5 text-left sm:flex-row sm:items-center sm:justify-between"
        aria-expanded={open}
      >
        <div>
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>}
          <h2 className="text-lg font-black text-gray-900">{title}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{open ? 'Recolher' : 'Abrir'}</span>
      </button>
      {open && <div className="border-t border-gray-100 p-5">{children}</div>}
    </section>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))
}


function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))
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

function onlineStatusMeta(status, lifecycle) {
  if (status === 'connected') return { label: 'Conectado', cls: 'bg-emerald-100 text-emerald-700' }
  if (status === 'connecting' || lifecycle === 'reconnecting') return { label: lifecycle === 'reconnecting' ? 'Reconectando' : 'Conectando', cls: 'bg-amber-100 text-amber-800' }
  return { label: 'Desconectado', cls: 'bg-red-100 text-red-700' }
}

function severityTone(value, warning = 1, critical = 5) {
  const safeValue = Number(value || 0)
  if (safeValue >= critical) return 'critical'
  if (safeValue >= warning) return 'warning'
  return 'ok'
}

function toneClasses(tone) {
  if (tone === 'critical') return 'bg-red-50 text-red-700 ring-red-200'
  if (tone === 'warning') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
}

function VerVencidasToggle({ oculto = 0, ligado = false, janelaDias = 30, onToggle }) {
  if (!ligado && !oculto) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-1 text-xs font-black text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
    >
      {ligado
        ? `Ocultar quem venceu há mais de ${janelaDias} dias`
        : `Ver mais (${oculto} vencida${oculto === 1 ? '' : 's'} há mais de ${janelaDias} dias)`}
    </button>
  )
}

// Tom da etiqueta "por que caiu". Vermelho é o que exige ação hoje; roxo é
// renovação; cinza é escolha da cliente ou queda comum.
const REASON_TONE = {
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800',
  purple: 'bg-purple-100 text-purple-800',
  sky: 'bg-sky-100 text-sky-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  slate: 'bg-slate-100 text-slate-700',
}

// Quem resolve a desconexão — espelha src/core/sessionOwnership.js.
const OWNER_META = {
  connected: { label: 'conectado', cls: 'bg-emerald-50 text-emerald-700' },
  robo: { label: 'o robô está tentando', cls: 'bg-sky-50 text-sky-700' },
  cliente: { label: 'precisa da cliente (QR)', cls: 'bg-amber-100 text-amber-800' },
  cliente_desligou: { label: 'ela desligou', cls: 'bg-gray-100 text-gray-600' },
  bloqueio: { label: 'número recusado', cls: 'bg-red-50 text-red-700' },
  ninguem: { label: 'parada, ninguém tentando', cls: 'bg-red-100 text-red-800' },
  acesso_vencido: { label: 'acesso vencido', cls: 'bg-purple-50 text-purple-700' },
}

const SCENARIO_LABELS = {
  parado: 'Paradas sem ninguém tentando',
  vencido: 'Acesso vencido',
  qr: 'Precisam de QR novo',
  blind: 'Sem receber',
  quedas: 'Caindo demais',
  manual: 'Cliente teve que agir',
  desync: 'Fonte dessincronizada',
}

// Card do painel. Duas regras vindas do pedido de 2026-09-05:
//   1. Todo card que representa PESSOAS abre a lista de quem são (`onClick`).
//   2. Todo card explica o que é, o que dói e como resolver, atrás do "?"
//      (`help`) — número sem contexto não ajuda ninguém a decidir.
// O "?" fica FORA do botão de propósito: botão dentro de botão não é HTML
// válido e o clique no "?" abriria o drill-down junto.
function StatCard({ label, value, tone = 'ok', helper, onClick, help, actionLabel }) {
  const content = (
    <>
      <p className="mt-1 text-2xl font-black">{value}</p>
      {helper && <p className="mt-1 text-xs opacity-80">{helper}</p>}
      {onClick && <p className="mt-2 text-[11px] font-black uppercase tracking-wide opacity-70">{actionLabel || 'Ver quem são →'}</p>}
    </>
  )
  return (
    <article className={`rounded-2xl p-4 ring-1 shadow-sm ${toneClasses(tone)} ${onClick ? 'transition hover:brightness-95' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-wide opacity-80">{label}</p>
        {help && <HelpDot {...help} />}
      </div>
      {onClick
        ? <button type="button" onClick={onClick} className="block w-full text-left">{content}</button>
        : content}
    </article>
  )
}

function ScenarioCard(props) {
  return <StatCard {...props} />
}

function CommandCard(props) {
  return <StatCard {...props} />
}


const CREDENTIAL_STATUS_META = {
  configured: { label: 'OK', className: 'bg-emerald-100 text-emerald-700' },
  warning: { label: 'Revisar', className: 'bg-amber-100 text-amber-700' },
  incomplete: { label: 'Incompleta', className: 'bg-red-100 text-red-700' },
  missing: { label: 'Ausente', className: 'bg-gray-100 text-gray-600' },
}

function CredentialHealthBadges({ health = [], compact = false }) {
  const safeHealth = asArray(health)
  if (!safeHealth.length) return <span className="text-xs text-gray-400">Sem diagnóstico</span>
  return (
    <div className="flex flex-wrap gap-1">
      {safeHealth.map(item => {
        const meta = CREDENTIAL_STATUS_META[item.status] ?? CREDENTIAL_STATUS_META.missing
        return (
          <span key={item.platform} title={[...(item.missing || []).map(field => `Falta ${field}`), ...(item.warnings || [])].join(' | ')} className={`rounded-full px-2 py-1 text-[11px] font-bold ${meta.className}`}>
            {compact ? item.label : `${item.label}: ${meta.label}`}
          </span>
        )
      })}
    </div>
  )
}

function RiskBadges({ flags = [] }) {
  const safeFlags = asArray(flags)
  if (!safeFlags.length) return <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-bold text-green-700">OK</span>
  return (
    <div className="flex flex-wrap gap-1">
      {safeFlags.slice(0, 4).map(flag => (
        <span key={flag} className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700">{RISK_LABELS[flag] ?? flag}</span>
      ))}
      {safeFlags.length > 4 && <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600">+{safeFlags.length - 4}</span>}
    </div>
  )
}

function OriginCell({ origin }) {
  if (!origin) return <span className="text-xs text-gray-400">—</span>
  if (origin.type === 'affiliate') {
    return (
      <div>
        <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-bold text-violet-700">Afiliado</span>
        <p className="mt-1 text-xs font-semibold text-gray-700">{origin.affiliateName || 'Sem nome'}</p>
        <p className="text-[11px] text-gray-500">{origin.affiliateEmail || '—'}{origin.affiliateCode ? ` · ${origin.affiliateCode}` : ''}</p>
      </div>
    )
  }
  if (origin.type === 'referral') {
    return (
      <div>
        <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-bold text-sky-700">Indicação de cliente</span>
        <p className="mt-1 text-xs font-semibold text-gray-700">{origin.referrerName || 'Sem nome'}</p>
        <p className="text-[11px] text-gray-500">{origin.referrerEmail || '—'}</p>
      </div>
    )
  }
  return (
    <div>
      <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600">{origin.label || 'Não rastreada'}</span>
      {origin.detail && <p className="mt-1 text-[11px] text-gray-500">{origin.detail}</p>}
    </div>
  )
}

function OnlineMetricCard({ label, value, helper, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-900 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-900 ring-amber-200',
    red: 'bg-red-50 text-red-900 ring-red-200',
  }
  return (
    <div className={`rounded-2xl p-3 ring-1 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
      {helper && <p className="mt-1 text-[11px] font-medium opacity-70">{helper}</p>}
    </div>
  )
}

function OnlineDetailDrawer({ detail, loading, onClose }) {
  if (!detail && !loading) return null
  const session = detail?.session
  const meta = onlineStatusMeta(session?.status, session?.lifecycle)
  const cm = detail?.connectionMetrics ?? {}
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm" onClick={onClose}>
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className={`rounded-full px-3 py-1 text-xs font-black ${meta.cls}`}>{meta.label}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">Heartbeat: {formatRelative(session?.lastHeartbeatAt)}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">Código: {session?.lastDisconnectCode || '—'}</span>
            </div>

            <section className="grid gap-3 sm:grid-cols-3">
              <OnlineMetricCard label="Quedas 24h" value={formatNumber(cm.disconnects24h)} tone={cm.disconnects24h ? 'red' : 'green'} />
              <OnlineMetricCard label="Reconexões manuais 24h" value={formatNumber(cm.manualReconnects24h)} helper="start/pareamento pedido pelo cliente" tone={cm.manualReconnects24h ? 'red' : 'green'} />
              <OnlineMetricCard label="Offline auto 24h" value={formatDurationMs((cm.automaticOfflineMs24h || 0) + (cm.ongoingOfflineMs24h || 0))} helper="tempo até recuperar sozinho" tone={(cm.automaticOfflineMs24h || cm.ongoingOfflineMs24h) ? 'amber' : 'green'} />
              <OnlineMetricCard label="Quedas 7d" value={formatNumber(cm.disconnects7d)} tone={cm.disconnects7d ? 'red' : 'green'} />
              <OnlineMetricCard label="Reconexões manuais 7d" value={formatNumber(cm.manualReconnects7d)} helper="trabalho real do cliente" tone={cm.manualReconnects7d ? 'red' : 'green'} />
              <OnlineMetricCard label="Reconexões automáticas 7d" value={formatNumber(cm.automaticRecoveries7d)} helper={`offline auto ${formatDurationMs((cm.automaticOfflineMs7d || 0) + (cm.ongoingOfflineMs7d || 0))}`} tone={(cm.automaticOfflineMs7d || cm.ongoingOfflineMs7d) ? 'amber' : 'green'} />
              <OnlineMetricCard label="Parado até o cliente agir 7d" value={formatDurationMs(cm.manualOfflineMs7d)} helper={`${formatNumber(cm.manualRecoveries7d)} episódio(s) que só voltaram com ação dele`} tone={cm.manualOfflineMs7d ? 'red' : 'green'} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Linha do tempo das quedas (7 dias)</h3>
              <p className="mt-1 text-[11px] text-slate-500">Cada linha é um episódio fora do ar: quando começou, quanto durou e se o robô voltou sozinho ou só voltou depois que o cliente agiu.</p>
              <div className="mt-3 divide-y divide-slate-100">
                {asArray(detail.offlineEpisodes).map((ep) => {
                  const cls = ep.open ? 'bg-amber-50 text-amber-800' : ep.endedBy === 'sozinho' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  const rotulo = ep.open ? 'em aberto' : ep.endedBy === 'sozinho' ? 'voltou sozinho' : ep.endedBy === 'cliente' ? 'o cliente teve que agir' : 'interrompido'
                  return (
                    <div key={`${ep.startedAt}-${ep.endedAt || 'aberto'}`} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2 text-sm">
                      <div>
                        <p className="font-bold text-slate-900">{formatDate(ep.startedAt)} → {ep.endedAt ? formatDate(ep.endedAt) : 'agora'}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatDurationMs(ep.durationMs)} fora
                          {ep.code ? ` · código ${ep.code}` : ''}
                          {ep.stuckMsg ? ' · mensagem travada' : ''}
                          {ep.terminal ? ' · sessão deslogada' : ''}
                        </p>
                      </div>
                      <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-black ${cls}`}>{rotulo}</span>
                    </div>
                  )
                })}
                {!asArray(detail.offlineEpisodes).length && <p className="py-3 text-sm text-slate-500">Nenhuma queda registrada nos últimos 7 dias.</p>}
              </div>
            </section>

            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong>Como ler:</strong> &quot;Reconexões manuais&quot; = quando o cliente teve que iniciar/reparear pelo painel. &quot;Offline auto&quot; = tempo que o robô ficou fora até recuperar sozinho; tentativas internas de backoff não contam como trabalho do cliente.</p>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Erros agrupados por tipo (7d)</h3>
              <div className="mt-3 divide-y divide-slate-100">
                {asArray(detail.errorsByType).map((item) => (
                  <div key={item.errorMsg} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                    <div>
                      <p className="break-words text-xs font-bold text-slate-900">{item.errorMsg}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.category || 'UNKNOWN'} · último {formatDate(item.lastSeenAt)}</p>
                    </div>
                    <span className="self-start rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{formatNumber(item.count)}x</span>
                  </div>
                ))}
                {!asArray(detail.errorsByType).length && <p className="py-4 text-sm text-slate-500">Sem erros recentes nos últimos 7 dias.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Linha do tempo de conexão</h3>
              <div className="mt-3 space-y-2">
                {asArray(detail.recentEvents).slice(0, 20).map((event) => (
                  <div key={event.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black text-slate-900">{event.type}</p>
                      <span className="text-xs font-bold text-slate-500">{formatDate(event.occurredAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Código {event.code || '—'} · lifecycle {event.lifecycle || '—'}</p>
                  </div>
                ))}
                {!asArray(detail.recentEvents).length && <p className="py-4 text-sm text-slate-500">Sem eventos de conexão nos últimos 7 dias.</p>}
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  )
}


function ManualAccessEditor({ detail, onApply }) {
  const [form, setForm] = useState({ plan: detail?.plan ?? '', days: '', reason: '', partnerCode: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')


  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        plan: form.plan || undefined,
        days: form.days === '' ? undefined : Number(form.days),
        reason: form.reason,
        partnerCode: form.partnerCode.trim() || undefined,
      }
      await onApply(payload)
      setMessage('Acesso atualizado com sucesso.')
      setForm((current) => ({ ...current, days: '', reason: '', partnerCode: '' }))
    } catch (err) {
      setMessage(err.message || 'Falha ao atualizar acesso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Ajuste manual de plano/acesso (CS/Admin)</p>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs">
          <option value="">Sem alterar plano</option>
          <option value="trial">trial</option>
          <option value="basic">basic</option>
          <option value="pro">pro</option>
          <option value="premium">premium (Instagram Stories)</option>
        </select>
        <input value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} type="number" min="-365" max="365" placeholder="Dias (+/-)" className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs" />
        <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Motivo (obrigatório)" className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs" required minLength={5} />
      </div>
      <div className="mt-2">
        <input value={form.partnerCode} onChange={(e) => setForm((f) => ({ ...f, partnerCode: e.target.value }))} placeholder="Código do parceiro influenciador (opcional — só para cortesia de parceria)" className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs" maxLength={32} />
        <p className="mt-1 text-[11px] text-gray-500">Preenchendo aqui, o motivo é gravado como <code>parceiro-influenciador:&lt;código&gt;</code>, o que permite auditar depois quantas cortesias de parceria estão de pé. Cada cortesia ativa é uma sessão WhatsApp a mais no servidor.</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">Altera plano e/ou expiração imediatamente e deve refletir no uso real após reloadConfig natural das rotas.</p>
        <button disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Aplicando...' : 'Aplicar acesso'}</button>
      </div>
      {message && <p className="mt-2 text-xs text-gray-700">{message}</p>}
    </form>
  )
}

function DetailPanel({ detail, onClose, onApplyAccess }) {
  if (!detail) return null
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Drill-down do cliente</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-gray-900">{detail.email}</h2>
            <PayingTag status={detail.payingStatus} />
          </div>
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
          <p className="text-sm text-gray-600">Origem: {detail.groupCounts?.monitor ?? 0} · Destino: {detail.groupCounts?.post ?? 0} · Credenciais: {detail.credentials?.length ?? 0}</p><div className="mt-2"><CredentialHealthBadges health={detail.credentialHealth} /></div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-800">Atividade</h3>
          <p className="text-sm text-gray-600">Atividade efetiva: {formatDate(detail.effectiveLastActivityAt)}</p>
          <p className="text-sm text-gray-500">Último log: {formatDate(detail.lastMessageAt)} · Cadastro: {formatDate(detail.lastActivityAt)}</p>
          <p className="text-sm text-gray-600">Expiração: {formatDate(detail.accessExpiresAt)}</p>
        </div>
      </div>

      <div className="mt-5"><ManualAccessEditor key={`${detail.id}-${detail.plan}`} detail={detail} onApply={onApplyAccess} /></div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-800">Pagamentos recentes</h3>
          <div className="space-y-2">
            {asArray(detail.payments).slice(0, 5).map(payment => (
              <div key={payment?.id ?? `${payment?.user?.email}-${payment?.createdAt}`} className="rounded-xl border border-gray-100 p-3 text-xs text-gray-600">
                <span className="font-bold text-gray-900">{payment?.status ?? '—'}</span> · {payment?.plan ?? '—'} · {formatCurrency(payment?.amount)} · {formatDate(payment?.createdAt)}
              </div>
            ))}
            {!detail.payments?.length && <p className="text-sm text-gray-400">Sem pagamentos.</p>}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-800">Últimos logs</h3>
          <div className="mb-2 flex flex-wrap gap-1">
            {asArray(detail.platformStats7d).map(stat => (
              <span key={`${stat.platform}-${stat.status}`} className={`rounded-full px-2 py-1 text-[11px] font-bold ${stat.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{stat.platform}: {stat.status} {stat.count}</span>
            ))}
          </div>
          <div className="space-y-2">
            {asArray(detail.recentLogs).slice(0, 5).map(log => (
              <div key={log?.id ?? `${log?.user?.email}-${log?.sentAt}`} className="rounded-xl border border-gray-100 p-3 text-xs text-gray-600">
                <span className={`font-bold ${log?.status === 'error' ? 'text-red-600' : 'text-green-700'}`}>{log?.status ?? '—'}</span> · {log.platform} · {formatDate(log.sentAt)}
                <p className="mt-1 text-gray-500">Origem: {log.sourceGroupName || log.sourceGroup || '—'} · Destino: {log.destGroupName || log.destGroup || '—'}</p>
                {log?.messageText && <p className="mt-1 text-gray-500 line-clamp-2">{log?.messageText}</p>}
                {log?.errorMsg && <p className="mt-1 text-red-500">{log?.errorMsg}</p>}
              </div>
            ))}
            {!detail.recentLogs?.length && <p className="text-sm text-gray-400">Sem logs.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}


function WhatsAppDisconnectedTable({ data, onOpenDetail, onRecordContact }) {
  const [sortBy, setSortBy] = useState('default')
  const users = useMemo(() => sortByDateField(asArray(data?.users), sortBy), [data, sortBy])
  const summary = asPlainObject(data?.summary)
  const hasUsers = users.length > 0

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-red-100">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Suporte · Reconexão prioritária</p>
          <h2 className="text-lg font-black text-gray-900">Clientes com WhatsApp desconectado após uso</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">Clientes ativos que já tiveram envio com sucesso, mas hoje estão sem sessão WhatsApp conectada. Priorize pagantes e use o botão para chamar o cliente diretamente.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-4 lg:min-w-[520px]">
          <div className="rounded-xl bg-red-50 px-3 py-2">
            <p className="text-lg font-black text-red-700">{formatNumber(summary.total ?? data?.total ?? 0)}</p>
            <p className="text-[11px] font-bold uppercase text-red-500">WA off</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-lg font-black text-amber-700">{formatNumber(summary.paidAtRisk ?? 0)}</p>
            <p className="text-[11px] font-bold uppercase text-amber-600">pagantes</p>
          </div>
          <div className="rounded-xl bg-indigo-50 px-3 py-2">
            <p className="text-lg font-black text-indigo-700">{formatCurrency(summary.estimatedMrrAtRisk ?? 0)}</p>
            <p className="text-[11px] font-bold uppercase text-indigo-600">MRR risco</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-lg font-black text-gray-800">{formatNumber(summary.noRecentSupportContact ?? 0)}</p>
            <p className="text-[11px] font-bold uppercase text-gray-500">sem contato</p>
          </div>
        </div>
      </div>

      <SortBar value={sortBy} onChange={setSortBy} />

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Por que caiu</th>
              <th className="px-3 py-2">Uso anterior</th>
              <th className="px-3 py-2">WhatsApp</th>
              <th className="px-3 py-2">Operação</th>
              <th className="px-3 py-2">Prioridade</th>
              <th className="px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(user => {
              const canOpenWhatsApp = Boolean(user?.whatsappContactUrl)
              return (
                <tr key={user?.id ?? user?.email} className="align-top bg-red-50/30">
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-gray-900">{user?.email ?? 'Cliente sem e-mail'}</p>
                      <PayingTag status={user?.payingStatus} />
                    </div>
                    <p className="text-xs text-gray-500">{user?.contactPhone || 'Sem celular'} · {user?.plan ?? '—'} · {user?.accessStatus ?? '—'}</p>
                    <p className="mt-1 text-[11px] text-gray-400">Criado em: {formatDate(user?.createdAt)}</p>
                    <p className="text-[11px] text-gray-400">Contato CS: {formatDate(user?.lastSupportContactAt)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-block whitespace-normal rounded-full px-2 py-1 text-[11px] font-black ${REASON_TONE[user?.disconnectReason?.tone] || REASON_TONE.slate}`}>
                      {user?.disconnectReason?.label || 'Motivo não informado'}
                    </span>
                    <p className="mt-1 max-w-[260px] text-[11px] leading-snug text-gray-500">{user?.disconnectReason?.detail || ''}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600">
                    <p><strong>{formatNumber(user?.successCount ?? 0)}</strong> sucessos · {formatNumber(user?.totalLogCount ?? 0)} logs</p>
                    <p>Último sucesso: {formatDate(user?.lastSuccessAt)}</p>
                    <p>Último envio (log): {formatDate(user?.lastMessageAt)}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600">
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-[11px] font-black text-red-700">{user?.waSession?.status || 'sem sessão'}</span>
                    <p className="mt-1">Atualizado: {formatDate(user?.waSession?.updatedAt)}</p>
                    {user?.waSession?.lastDisconnectCode && <p>Código: {user.waSession.lastDisconnectCode}</p>}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600">
                    <p>Bot: {user?.botRunning ? 'rodando' : 'parado'}</p>
                    <p>Origem/Destino: {user?.groupCounts?.monitor ?? 0}/{user?.groupCounts?.post ?? 0}</p>
                    <div className="mt-1"><CredentialHealthBadges health={user?.credentialHealth} compact /></div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-800">{user?.priorityLabel || 'Reconectar'}</span>
                    <p className="mt-2 text-xs font-bold text-gray-700">Score {user?.priorityScore ?? 0}/100</p>
                    <p className="mt-1 text-[11px] text-gray-500">{user?.suggestedAction || 'Reconectar WhatsApp'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-2">
                      <button onClick={() => onOpenDetail(user?.id)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Drill-down</button>
                      {canOpenWhatsApp ? (
                        <a href={user.whatsappContactUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 px-3 py-2 text-center text-xs font-bold text-white hover:bg-green-700">Chamar no WhatsApp</a>
                      ) : (
                        <span className="rounded-lg bg-gray-100 px-3 py-2 text-center text-xs font-bold text-gray-400">Sem WhatsApp</span>
                      )}
                      <button onClick={() => onRecordContact(user)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Registrar contato</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!hasUsers && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">Nenhum cliente ativo com sucesso anterior e WhatsApp desconectado no momento.</p>}
    </section>
  )
}

// Drill-down dos dois cards técnicos. Não tem pessoas por trás, então o que
// ele abre é O QUE está pendente — construído do que a página já carregou
// (nenhuma chamada nova, nenhum processo novo).
// Como as ofertas estão CHEGANDO no grupo. Era a página /admin/ofertas; virou
// bloco do Início (2026-09-05) porque a pergunta é de olhar todo dia.
//
// "Sucesso" no histórico só quer dizer que o WhatsApp aceitou a mensagem — não
// que ela chegou bonita. Três incidentes seguidos de imagem foram descobertos
// pela CLIENTE, e é isso que estes dois blocos existem para antecipar.
function BarraTipoImagem({ item, total }) {
  const largura = total > 0 ? Math.max(2, Math.round((item.quantidade / total) * 100)) : 0
  const ruim = item.kind === 'texto'
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={`font-bold ${ruim ? 'text-red-700' : 'text-slate-700'}`}>{item.rotulo}</span>
        <span className="text-slate-500">{formatNumber(item.quantidade)} · {largura}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${ruim ? 'bg-red-500' : 'bg-cyan-500'}`} style={{ width: `${largura}%` }} />
      </div>
    </div>
  )
}

function bytesCurto(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1024) return `${Math.round(value / 1024)} KB`
  return `${value} B`
}

function OfertasImagemSecoes({ entrega }) {
  const resumo = entrega?.resumo
  if (!resumo) return null
  const totalTipos = asArray(resumo.porTipo).reduce((acc, item) => acc + item.quantidade, 0)
  const perdas = asArray(entrega?.origensComPerda)
  return (
    <>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">De que jeito as imagens saíram</h2>
          <p className="mt-1 text-xs text-gray-500">Últimas 48h. &quot;Só texto&quot; é o que a cliente enxerga como oferta sem imagem.</p>
          <div className="mt-5 space-y-3">
            {asArray(resumo.porTipo).map(item => <BarraTipoImagem key={item.kind} item={item} total={totalTipos} />)}
            {!asArray(resumo.porTipo).length && <p className="text-sm text-gray-400">Nenhuma oferta publicada nas últimas 48h.</p>}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-black text-gray-900">Envios e imagem por loja</h2>
          <p className="mt-1 text-xs text-gray-500">Loja que parou de entregar a foto do produto aparece aqui antes de virar reclamação.</p>
          <div className="mt-5 space-y-2">
            {asArray(resumo.porLoja).map(loja => (
              <div key={loja.loja} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <span className="font-bold text-slate-900">{loja.loja}</span>
                <span className="text-slate-500">
                  {formatNumber(loja.total)} envios · {formatNumber(loja.comImagem)} com imagem
                  {loja.perderamImagem > 0 && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">{formatNumber(loja.perderamImagem)} perderam a foto</span>}
                </span>
              </div>
            ))}
            {!asArray(resumo.porLoja).length && <p className="text-sm text-gray-400">Sem envios por loja nas últimas 48h.</p>}
          </div>
        </div>
      </section>

      {/* A lista de quem perdeu foto continua existindo, recolhida: é o detalhe
          que só se abre quando o número lá em cima está ruim. */}
      <SecondarySection title="Onde a foto está se perdendo" eyebrow={`${formatNumber(resumo.perderamImagem ?? 0)} ofertas saíram só com texto tendo foto na origem`}>
        <div className="space-y-2">
          {!perdas.length && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Nenhuma oferta perdeu a foto nesta janela.</p>}
          {perdas.map(perda => (
            <div key={`${perda.userId}-${perda.sourceGroup}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">{perda.cliente}</span>
                <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-black text-red-700">{formatNumber(perda.quantidade)} sem foto</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Origem: {perda.origemNome || '(grupo não cadastrado)'} · {perda.sourceGroup}</p>
              <p className="mt-1 text-xs text-slate-500">Lojas: {asArray(perda.lojas).join(', ') || '—'} · imagem na origem entre {bytesCurto(perda.menorBytes)} e {bytesCurto(perda.maiorBytes)}</p>
            </div>
          ))}
        </div>
      </SecondarySection>
    </>
  )
}

function TechDrilldownModal({ kind, observability, metrics, onClose }) {
  if (!kind) return null
  const erros5xx = asArray(metrics?.recentErrors)
  const dlqPagamentos = Number(observability?.queues?.paymentWebhookDlq?.open ?? observability?.goNoGo?.paymentDlqOpen ?? 0)
  const dlqEnvios = Number(observability?.queues?.sendDlq?.lastKnownDlqTotal ?? 0)
  const filaOfertas = asPlainObject(observability?.queues?.offerQueueItems)
  const dependencias = asPlainObject(observability?.dependencies)
  const isInfra = kind === 'infra'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="mt-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Detalhe técnico</p>
            <h3 className="text-lg font-black text-gray-900">{isInfra ? 'Banco e site' : 'Trabalhos parados'}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {isInfra
                ? 'Não tem cliente por trás deste card: é o nosso servidor. Falha aqui aparece para todo mundo ao mesmo tempo.'
                : 'Coisas que o sistema tentou fazer, não conseguiu, e deixou de lado esperando decisão.'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200">Fechar</button>
        </div>

        {isInfra ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Banco de dados</p><p className="text-xl font-black">{dependencias?.database?.ok ? 'Respondendo' : 'Sem resposta'}</p></div>
              <div className="rounded-xl bg-red-50 p-3"><p className="text-xs text-red-600">Falhas de site (24h)</p><p className="text-xl font-black text-red-700">{formatNumber(observability?.api?.total5xx ?? 0)}</p></div>
              <div className="rounded-xl bg-blue-50 p-3"><p className="text-xs text-blue-600">Site no ar há</p><p className="text-xl font-black text-blue-700">{Math.round((observability?.goNoGo?.uptimeSeconds ?? 0) / 60)}min</p></div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold text-gray-800">Últimas falhas de site</h4>
              <div className="space-y-2">
                {erros5xx.slice(0, 8).map((item, index) => (
                  <div key={`${item?.at ?? 'erro'}-${index}`} className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                    <p className="font-bold">{item?.method ?? '—'} {item?.route ?? '—'}</p>
                    <p>{item?.error || item?.url || 'Sem detalhe'} · {formatDate(item?.at)}</p>
                  </div>
                ))}
                {!erros5xx.length && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">Nenhuma falha de site registrada. Está tudo respondendo.</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={`rounded-xl p-4 ring-1 ${dlqPagamentos ? 'bg-amber-50 ring-amber-200' : 'bg-gray-50 ring-gray-100'}`}>
                <p className="text-xs font-bold uppercase text-amber-600">Avisos de pagamento parados</p>
                <p className="mt-1 text-2xl font-black text-amber-800">{formatNumber(dlqPagamentos)}</p>
                <p className="mt-1 text-[11px] text-gray-600">Cliente que pagou e o aviso não foi processado. Confira se o acesso dela está liberado — este é o mais urgente dos dois.</p>
              </div>
              <div className={`rounded-xl p-4 ring-1 ${dlqEnvios ? 'bg-amber-50 ring-amber-200' : 'bg-gray-50 ring-gray-100'}`}>
                <p className="text-xs font-bold uppercase text-amber-600">Envios parados</p>
                <p className="mt-1 text-2xl font-black text-amber-800">{formatNumber(dlqEnvios)}</p>
                <p className="mt-1 text-[11px] text-gray-600">Ofertas que o robô tentou publicar e desistiu depois das tentativas. Cada uma é uma oferta que não chegou ao grupo.</p>
              </div>
            </div>
            {!!Object.keys(filaOfertas).length && (
              <div>
                <h4 className="mb-2 text-sm font-bold text-gray-800">Ofertas esperando na fila</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(filaOfertas).map(([estado, quantidade]) => (
                    <span key={estado} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">{estado}: {formatNumber(quantidade)}</span>
                  ))}
                </div>
              </div>
            )}
            {!dlqPagamentos && !dlqEnvios && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">Nada parado no momento.</p>}
          </div>
        )}
      </div>
    </div>
  )
}


export default function AdminPage() {
  const [overview, setOverview] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [users, setUsers] = useState(null)
  const [waDisconnectedUsers, setWaDisconnectedUsers] = useState(null)
  const [success, setSuccess] = useState(null)
  const [successQueue, setSuccessQueue] = useState(null)
  const [systemMetrics, setSystemMetrics] = useState(null)
  const [systemObservability, setSystemObservability] = useState(null)
  const [online, setOnline] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [risk, setRisk] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [tab, setTab] = useState('inicio')
  const [affiliates, setAffiliates] = useState(null)
  // Só os dois cards da aba Afiliados usam o resumo financeiro; a Receita tem página própria.
  const [finance, setFinance] = useState(null)
  const [commissions, setCommissions] = useState(null)
  const [onlineDetail, setOnlineDetail] = useState(null)
  const [onlineDetailLoading, setOnlineDetailLoading] = useState(false)
  const [onlineFilters, setOnlineFilters] = useState({ search: '', waStatus: 'all', plan: 'all', activity: 'all', minErrors: '', cenario: 'all' })
  // Conta vencida há muito tempo fica fora da visão por padrão — polui e
  // esconde o que precisa de decisão hoje. "Ver mais" traz de volta.
  const [verVencidasAntigas, setVerVencidasAntigas] = useState(false)
  const [reconectando, setReconectando] = useState(null)
  const [onlineFiltering, setOnlineFiltering] = useState(false)
  // Drill-down dos cards técnicos ('infra' | 'filas' | null). Não busca nada
  // novo: mostra o detalhe do que a página já carregou.
  const [techDrilldown, setTechDrilldown] = useState(null)
  // Qualidade de imagem das ofertas (48h). Era a página /admin/ofertas; virou
  // card no Início a pedido da dona do produto (2026-09-05) — a pergunta "as
  // ofertas estão saindo com foto?" é de olhar todo dia, e página separada é
  // página que ninguém abre.
  const [entrega, setEntrega] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)

  async function reloadOnline(next = onlineFilters) {
    setOnlineFiltering(true)
    setError('')
    try {
      setOnline(await api.adminOnline({ limit: 120, incluirVencidos: verVencidasAntigas ? 1 : '', ...next }))
    } catch (err) {
      setError(err.message || 'Falha ao filtrar a aba Online.')
    } finally {
      setOnlineFiltering(false)
    }
  }

  // Abre a aba online já filtrada pelo cenário clicado nos cards do topo.
  function openScenario(cenario) {
    const next = { ...onlineFilters, cenario }
    setOnlineFilters(next)
    setTab('online')
    reloadOnline(next)
  }

  // Cards que representam pessoas abrem a lista de quem são, na aba Online já
  // filtrada — mesmo caminho dos cards de cenário.
  function openWaStatus(waStatus) {
    const next = { ...onlineFilters, cenario: 'all', minErrors: '', waStatus }
    setOnlineFilters(next)
    setTab('online')
    reloadOnline(next)
  }

  function openErrorsDrilldown() {
    const next = { ...onlineFilters, cenario: 'all', waStatus: 'all', minErrors: '1' }
    setOnlineFilters(next)
    setTab('online')
    reloadOnline(next)
  }

  function onOnlineSelect(key, value) {
    const next = { ...onlineFilters, [key]: value }
    setOnlineFilters(next)
    reloadOnline(next)
  }

  // Sobe o robô da cliente sem que ela precise fazer nada. O botão só aparece
  // quando a credencial ainda existe (`canAdminRetry`); nos demais casos a API
  // recusa com o motivo, porque reconectar ali não resolveria.
  async function reconectarCliente(userId) {
    if (!userId) return
    // Ação sobre a conta de uma cliente: nunca sem confirmar (Q4 da auditoria).
    if (!window.confirm('Subir o robô desta cliente agora? Ela não precisa fazer nada. Se o WhatsApp exigir QR novo, a API recusa e avisa.')) return
    setReconectando(userId)
    setError('')
    try {
      const resultado = await api.adminOnlineReconnect(userId)
      setError('')
      await reloadOnline().catch(() => {})
      if (resultado?.message) window.alert(resultado.message)
    } catch (err) {
      setError(err.message || 'Não consegui subir o robô.')
    } finally {
      setReconectando(null)
    }
  }

  async function openOnlineDetail(userId) {
    if (!userId) return
    setOnlineDetailLoading(true)
    setOnlineDetail(null)
    try {
      setOnlineDetail(await api.adminOnlineUser(userId))
    } catch (err) {
      setError(err.message || 'Falha ao carregar detalhes de conexão.')
      setOnlineDetail(null)
    } finally {
      setOnlineDetailLoading(false)
    }
  }

  function closeOnlineDetail() {
    setOnlineDetail(null)
    setOnlineDetailLoading(false)
  }

  function currentMonth() {
    return new Date().toISOString().slice(0, 7)
  }

  async function reloadAffiliates() {
    const [a, c] = await Promise.all([
      api.adminAffiliates({ status: 'approved', limit: 100 }).catch(() => null),
      api.adminAffiliateCommissions({ month: currentMonth() }).catch(() => null),
    ])
    setAffiliates(a)
    setCommissions(c)
  }

  async function approveCommission(id) {
    setError('')
    try { await api.adminAffiliateCommissionApprove(id); await reloadAffiliates() }
    catch (err) { setError(err.message || 'Falha ao aprovar comissão.') }
  }

  async function markCommissionPaid(id) {
    setError('')
    try { await api.adminAffiliateCommissionMarkPaid(id); await reloadAffiliates() }
    catch (err) { setError(err.message || 'Falha ao marcar comissão como paga.') }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      api.adminAffiliates({ status: 'approved', limit: 100 }).catch(() => null),
      api.adminAffiliateCommissions({ month: currentMonth() }).catch(() => null),
      api.adminFinanceOverview().catch(() => null),
    ]).then(([a, c, f]) => {
      if (!active) return
      setAffiliates(a)
      setCommissions(c)
      setFinance(f)
    })
    return () => { active = false }
  }, [])

  async function loadAdminData(nextRisk = risk, nextSearch = search, nextVerVencidas = verVencidasAntigas) {
    if (accessDenied) return
    setError('')
    const [adminData, overviewData, usersData, waDisconnectedUsersData, successData, successQueueData, systemMetricsData, systemObservabilityData, onlineData, entregaData] = await Promise.all([
      api.adminMe(),
      api.adminOverview(),
      api.adminUsers({ risk: nextRisk, search: nextSearch, limit: 20, incluirVencidos: nextVerVencidas ? 1 : '' }),
      api.adminWaDisconnectedUsers({ search: nextSearch, limit: 12, minSuccess: 1 }).catch(() => null),
      api.adminSuccessOverview().catch(() => null),
      api.adminSuccessQueue({ limit: 8 }).catch(() => null),
      api.adminSystemMetrics().catch(() => null),
      api.adminSystemObservability().catch(() => null),
      api.adminOnline({ limit: 120, incluirVencidos: nextVerVencidas ? 1 : '' }).catch(() => null),
      api.adminQualidadeEntrega(48).catch(() => null),
    ])
    setAdmin(adminData)
    setOverview(overviewData)
    setUsers(usersData)
    setWaDisconnectedUsers(waDisconnectedUsersData)
    setSuccess(successData)
    setSuccessQueue(successQueueData)
    setSystemMetrics(systemMetricsData)
    setSystemObservability(systemObservabilityData)
    setOnline(onlineData)
    setEntrega(entregaData)
    setLoadedAt(new Date())
  }

  useEffect(() => {
    let active = true
    api.adminMe()
      .then((adminData) => {
        if (!active) return
        setAdmin(adminData)
        setAccessDenied(false)
        return Promise.all([
          Promise.resolve(adminData),
          api.adminOverview(),
          api.adminUsers({ limit: 20 }),
          api.adminWaDisconnectedUsers({ limit: 12, minSuccess: 1 }).catch(() => null),
          api.adminSuccessOverview().catch(() => null),
          api.adminSuccessQueue({ limit: 8 }).catch(() => null),
          api.adminSystemMetrics().catch(() => null),
          api.adminSystemObservability().catch(() => null),
          api.adminOnline({ limit: 120 }).catch(() => null),
          api.adminQualidadeEntrega(48).catch(() => null),
        ])
      })
      .then((result) => {
        if (!active || !result) return
        const [adminData, overviewData, usersData, waDisconnectedUsersData, successData, successQueueData, systemMetricsData, systemObservabilityData, onlineData, entregaData] = result
        setAdmin(adminData)
        setOverview(overviewData)
        setUsers(usersData)
        setWaDisconnectedUsers(waDisconnectedUsersData)
        setSuccess(successData)
        setSuccessQueue(successQueueData)
        setSystemMetrics(systemMetricsData)
        setSystemObservability(systemObservabilityData)
        setOnline(onlineData)
        setEntrega(entregaData)
        setLoadedAt(new Date())
      })
      .catch((err) => {
        if (!active) return
        if (String(err?.message || '').toLowerCase().includes('acesso admin negado')) {
          setAccessDenied(true)
          setError('')
          return
        }
        setError(err.message || 'Não foi possível carregar o painel admin.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const [usersSort, setUsersSort] = useState('default')
  const sortedUsers = useMemo(() => sortByDateField(asArray(users?.users), usersSort), [users, usersSort])
  const [onlineSort, setOnlineSort] = useState('default')
  const sortedOnlineUsers = useMemo(() => sortByDateField(asArray(online?.users), onlineSort), [online, onlineSort])
  const atRiskUsers = useMemo(() => asArray(users?.users).filter(user => asArray(user.riskFlags).length), [users])

  const gestaoClientesSection = (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-900">Gestão de clientes</h2>
          <p className="text-sm text-gray-500">{users?.total ?? 0} clientes encontrados · {atRiskUsers.length} com alertas nesta página</p>
          <VerVencidasToggle
            oculto={users?.ocultasPorVencimento}
            ligado={verVencidasAntigas}
            janelaDias={users?.janelaVencimentoDias}
            onToggle={() => { const proximo = !verVencidasAntigas; setVerVencidasAntigas(proximo); loadAdminData(risk, search, proximo) }}
          />
        </div>
        <form onSubmit={applyFilters} className="flex flex-col gap-2 sm:flex-row">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por email" className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
          <select value={risk} onChange={event => setRisk(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400">
            {RISK_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">Filtrar</button>
        </form>
      </div>

      <SortBar value={usersSort} onChange={setUsersSort} />

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Plano</th>
              <th className="px-3 py-2">Operação</th>
              <th className="px-3 py-2">Enviados com sucesso/Erros (24h)</th>
              <th className="px-3 py-2">Atividade</th>
              <th className="px-3 py-2">Riscos</th>
              <th className="px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedUsers.map(user => (
              <tr key={user?.id ?? user?.email} className={`align-top ${asArray(user?.riskFlags).length ? 'bg-amber-50/40' : ''}`}>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-gray-900">{user?.email ?? 'Cliente sem e-mail'}</p>
                    <PayingTag status={user?.payingStatus} />
                  </div>
                  <p className="text-xs text-gray-500">{user?.contactPhone || 'Sem celular'} · {user?.status ?? '—'}</p>
                  <p className="mt-1 text-[11px] text-gray-400">Criado em: {formatDate(user?.createdAt)}</p>
                </td>
                <td className="px-3 py-3"><OriginCell origin={user?.origin} /></td>
                <td className="px-3 py-3"><p className="font-semibold">{user?.plan ?? '—'}</p><p className="text-xs text-gray-500">{user?.accessStatus ?? '—'}</p></td>
                <td className="px-3 py-3 text-xs text-gray-600">
                  <p>Bot: {user?.botRunning ? 'rodando' : 'parado'}</p>
                  <p>WA: {user?.waSession?.status || '—'}</p>
                  <p>Origem/Destino: {user?.groupCounts?.monitor ?? 0}/{user?.groupCounts?.post ?? 0}</p><div className="mt-1"><CredentialHealthBadges health={user?.credentialHealth} compact /></div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600">
                  <p className="font-semibold text-emerald-700">{formatNumber(user?.successCount24h ?? 0)} sucesso</p>
                  <p className="font-semibold text-red-700">{formatNumber(user?.errorCount24h ?? 0)} erro</p>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600">
                  <p>Último acesso ao site: {formatDate(user?.lastActivityAt)}</p>
                  <p>Último envio: {formatDate(user?.lastMessageAt)}</p>
                </td>
                <td className="px-3 py-3"><RiskBadges flags={user?.riskFlags} /></td>
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-2">
                    <button onClick={() => openUserDetail(user?.id)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Drill-down</button>
                    <WhatsAppButton phone={user?.contactPhone} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )

  // Decidido por permissão (support:read), nunca por e-mail fixo (Q7 da auditoria).
  const canAccessCustomerSuccess = useMemo(() => canAccessCustomerSuccessFor(admin), [admin])

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

  async function applyManualAccess(userId, payload) {
    setError('')
    await api.adminUpdateAccess(userId, payload)
    await loadAdminData(risk, search)
    if (selectedUser?.id === userId) setSelectedUser(await api.adminUserDetail(userId))
  }

  async function recordContact(user) {
    const notes = window.prompt(`Resumo do contato com ${user.email}:`)
    if (notes === null) return
    const reason = user.contactReasons?.[0] ?? user.riskFlags?.[0] ?? 'support'
    try {
      await api.adminCreateContactLog(user.id, { channel: 'whatsapp', reason, outcome: 'contacted', notes })
      await loadAdminData(risk, search)
      if (selectedUser?.id === user.id) setSelectedUser(await api.adminUserDetail(user.id))
    } catch (err) {
      setError(err.message || 'Falha ao registrar contato.')
    }
  }


  if (loading) return <LoadingState />
  if (accessDenied) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <Alert type="warning" title="Acesso restrito" message="VOCÊ NÃO TEM PERMISSÃO" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="sticky top-0 z-20 rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {admin?.permissions?.includes('tech:read') && <Link href="/admin/capacidade" className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100">Capacidade</Link>}
              {admin?.permissions?.includes('tech:read') && admin?.shardPocMode === 'enabled' && <Link href="/admin/teste-shard" className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100">Teste shard</Link>}
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-base font-black text-white">B</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-gray-900">Espelha Grupos</span>
                <span className="text-xs font-semibold text-gray-400">admin</span>
              </div>
            </div>
            <nav className="flex flex-wrap gap-1">
              {TABS.map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === key ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{label}</button>
              ))}
              {admin?.permissions?.includes('billing:read') && <Link href="/admin/receita" className="rounded-xl px-4 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-100">Receita</Link>}
              {admin?.permissions?.includes('tech:read') && <Link href="/admin/operacao" className="rounded-xl px-4 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-100">Operação</Link>}
            </nav>
            <div className="flex items-center gap-2">
              <Link href="/admin/hoje" className="rounded-xl border border-emerald-300 bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">Hoje</Link>
              <Link href="/admin/erros" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Erros</Link>
              <Link href="/admin/clientes" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">Clientes</Link>
              <Link href="/admin/funil" className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Funil</Link>
              <Link href="/admin/emails" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Contato com cliente</Link>
              <button onClick={() => applyFilters()} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Atualizar</button>
              <Link href="/painel" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Voltar</Link>
            </div>
          </div>
        </div>

        {error && <Alert type="error" title="Painel admin" message={error} />}

        <TechDrilldownModal
          kind={techDrilldown}
          observability={systemObservability}
          metrics={systemMetrics}
          onClose={() => setTechDrilldown(null)}
        />

        {(tab === 'inicio' || tab === 'online') && (overview || systemObservability || online) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Semáforo operacional</p>
                <h2 className="text-lg font-black text-gray-900">O que precisa de decisão agora</h2>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">{loadedAt ? `Atualizado às ${loadedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Carregando…'}</span>
            </div>
            {/* Cenários da frota (Fase 1B do plano de recepção, RCA 2026-08-26).
                Primeira fileira de propósito: é o retrato de quantas clientes
                estão em cada quadro, e cada card leva para a lista filtrada. */}
            <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ScenarioCard
                label="Paradas sem ninguém tentando"
                value={formatNumber(online?.summary?.scenarios?.paradasSemNinguem ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.paradasSemNinguem ?? 0, 1, 3)}
                helper="caídas, sem nenhum robô no ar — um clique resolve"
                help={CARD_HELP.paradasSemNinguem}
                onClick={() => openScenario('parado')}
              />
              {/* "Sem receber" tem DOIS quadros com ações opostas, e contá-los
                  juntos escondia o grave (RCA 2026-09-14): parar agora costuma
                  se resolver sozinho; estar cega atravessando reconexões nunca
                  se resolveu — foi o que deixou uma cliente dois dias sem
                  espelhar nada, com o painel verde. Uma única conta nesse
                  segundo quadro já pinta o card de vermelho. */}
              <ScenarioCard
                label="Sem receber"
                value={formatNumber(online?.summary?.scenarios?.semReceber ?? 0)}
                tone={(online?.summary?.scenarios?.semReceberHaMuito ?? 0) > 0
                  ? 'critical'
                  : severityTone(online?.summary?.scenarios?.semReceber ?? 0, 1, 3)}
                helper={(online?.summary?.scenarios?.semReceberHaMuito ?? 0) > 0
                  ? `${formatNumber(online.summary.scenarios.semReceberHaMuito)} cega(s) há ${formatDurationMs(online?.summary?.scenarios?.semReceberPiorSilencioMs)} — não vai se resolver sozinha`
                  : 'conectadas e sem mensagem chegando'}
                help={CARD_HELP.semReceber}
                onClick={() => openScenario('blind')}
              />
              <ScenarioCard
                label="Caindo demais"
                value={formatNumber(online?.summary?.scenarios?.caindoDemais ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.caindoDemais ?? 0, 1, 3)}
                helper={`acima de ${formatNumber(online?.summary?.scenarios?.dropsAlertThreshold ?? 20)} quedas em 24h`}
                help={CARD_HELP.caindoDemais}
                onClick={() => openScenario('quedas')}
              />
              <ScenarioCard
                label="Cliente teve que agir"
                value={formatNumber(online?.summary?.scenarios?.clienteAgiu ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.clienteAgiu ?? 0, 1, 2)}
                helper={`${formatDurationMs(online?.summary?.scenarios?.manualOfflineMs24h)} parados até agir`}
                help={CARD_HELP.clienteAgiu}
                onClick={() => openScenario('manual')}
              />
              <ScenarioCard
                label="Fonte dessincronizada"
                value={formatNumber(online?.summary?.scenarios?.fonteQuebrada ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.fonteQuebrada ?? 0, 1, 5)}
                helper="conserto automático não resolveu (7d)"
                help={CARD_HELP.fonteQuebrada}
                onClick={() => openScenario('desync')}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <CommandCard
                label="Online agora"
                value={online?.summary?.onlineUsers ?? '—'}
                tone={severityTone(0)}
                helper={`${online?.summary?.stabilityPct ?? '—'}% estabilidade`}
                help={CARD_HELP.onlineAgora}
                onClick={() => openWaStatus('connected')}
              />
              <CommandCard
                label="Pagantes atuais"
                value={online?.summary?.currentPayingUsers ?? '—'}
                tone="ok"
                helper="com acesso pago ainda válido"
                help="Clientes que já pagaram (avulso ou assinatura) e cujo acesso ainda não venceu. Cortesia e liberação manual não contam."
                onClick={() => { setOnlineFilters({ ...onlineFilters, plan: 'all' }); setTab('online') }}
              />
              <CommandCard
                label="Pagantes online"
                value={online?.summary?.payingUsersOnline ?? '—'}
                tone="ok"
                helper="pagando e conectados agora"
                help="Pagantes atuais com o WhatsApp conectado neste momento."
                onClick={() => openWaStatus('connected')}
              />
              <CommandCard
                label="Erros 24h"
                value={overview?.errors24h ?? 0}
                tone={severityTone(overview?.errors24h, 1, 10)}
                helper="Acima de 10 = crítico"
                help={CARD_HELP.erros24h}
                onClick={() => openErrorsDrilldown()}
              />
              <CommandCard
                label="Ofertas com foto (48h)"
                value={entrega?.resumo?.percentualComImagem == null ? '—' : `${entrega.resumo.percentualComImagem}%`}
                tone={entrega?.resumo?.percentualComImagem == null ? 'ok' : entrega.resumo.percentualComImagem >= 95 ? 'ok' : entrega.resumo.percentualComImagem >= 80 ? 'warning' : 'critical'}
                helper={`${formatNumber(entrega?.resumo?.comImagem ?? 0)} de ${formatNumber(entrega?.resumo?.comRegistro ?? 0)} ofertas`}
                help={CARD_HELP.ofertasComFoto}
              />
              <CommandCard
                label="Banco / site"
                value={systemObservability?.goNoGo?.dbOk ? 'OK' : 'Revisar'}
                tone={systemObservability?.goNoGo?.dbOk ? 'ok' : 'critical'}
                helper={`${systemObservability?.api?.total5xx ?? 0} falhas de site`}
                help={CARD_HELP.dbApi}
                onClick={() => setTechDrilldown('infra')}
                actionLabel="Ver o que falhou →"
              />
              <CommandCard
                label="Trabalhos parados"
                value={(systemObservability?.goNoGo?.paymentDlqOpen ?? 0) + (systemObservability?.queues?.sendDlq?.lastKnownDlqTotal ?? 0)}
                tone={severityTone((systemObservability?.goNoGo?.paymentDlqOpen ?? 0) + (systemObservability?.queues?.sendDlq?.lastKnownDlqTotal ?? 0), 1, 3)}
                helper="Envios e avisos de pagamento"
                help={CARD_HELP.filasDlq}
                onClick={() => setTechDrilldown('filas')}
                actionLabel="Ver o que está parado →"
              />
            </div>
          </section>
        )}


        {tab === 'inicio' && entrega && (
          <SectionErrorBoundary label="Imagem das ofertas">
            <OfertasImagemSecoes entrega={entrega} />
          </SectionErrorBoundary>
        )}


        {tab === 'sucesso' && gestaoClientesSection}

        {/* Fila proativa saiu da aba Início a pedido da dona do produto
            (2026-09-05): o Início virou "o que precisa de decisão agora" e a
            fila é trabalho de atendimento, que tem aba própria. */}
        {tab === 'sucesso' && success && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Sucesso do Cliente · Etapa 4</p>
                <h2 className="text-lg font-black text-gray-900">Fila proativa de atendimento</h2>
                <p className="text-sm text-gray-500">Clientes com robô parado, onboarding incompleto, WhatsApp desconectado, expiração próxima ou muitos erros.</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Contatos hoje: {success.contactsToday}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Follow-ups</p><p className="text-xl font-black">{success.followUpsDue}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Sem celular</p><p className="text-xl font-black">{success.missingPhone}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-600">Pagos parados</p><p className="text-xl font-black text-amber-700">{success.paidStale48h}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-600">Onboarding</p><p className="text-xl font-black text-amber-700">{success.onboardingIncomplete}</p></div>
              <div className="rounded-xl bg-red-50 p-3"><p className="text-xs text-red-600">Muitos erros</p><p className="text-xl font-black text-red-700">{success.highErrorUsers24h}</p></div>
              <div className="rounded-xl bg-purple-50 p-3"><p className="text-xs text-purple-600">Expiram 7d</p><p className="text-xl font-black text-purple-700">{success.expiringSoon}</p></div>
            </div>

            <div className="mt-5 space-y-3">
              {asArray(successQueue?.queue).map(customer => (
                <div key={customer?.id ?? customer?.email} className="rounded-xl border border-gray-100 p-3 text-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-gray-900">{customer?.email ?? 'Cliente sem e-mail'}</p>
                        <PayingTag status={customer?.payingStatus} />
                      </div>
                      <p className="text-xs text-gray-500">{customer?.contactPhone || 'Sem celular'} · {customer?.plan ?? '—'} · último contato {formatDate(customer?.lastSupportContactAt)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {asArray(customer.contactReasons).map(reason => (
                          <span key={reason} className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700">{SUCCESS_REASON_LABELS[reason] ?? reason}</span>
                        ))}
                      </div>
                      {customer?.lastContact?.notes && <p className="mt-2 text-xs text-gray-500">Último registro: {customer?.lastContact?.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openUserDetail(customer?.id)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Drill-down</button>
                      <button onClick={() => recordContact(customer)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">Registrar contato</button>
                      <WhatsAppButton phone={customer?.contactPhone} />
                    </div>
                  </div>
                </div>
              ))}
              {!asArray(successQueue?.queue).length && <p className="text-sm text-gray-400">Nenhum cliente na fila proativa agora.</p>}
            </div>
          </section>
        )}


        {tab === 'inicio' && <WhatsAppDisconnectedTable data={waDisconnectedUsers} onOpenDetail={openUserDetail} onRecordContact={recordContact} />}

        {tab === 'inicio' && gestaoClientesSection}

        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
            <div className="my-6 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
              <DetailPanel detail={selectedUser} onClose={() => setSelectedUser(null)} onApplyAccess={(payload) => applyManualAccess(selectedUser.id, payload)} />
            </div>
          </div>
        )}

        {(onlineDetail || onlineDetailLoading) && (
          <OnlineDetailDrawer detail={onlineDetail} loading={onlineDetailLoading} onClose={closeOnlineDetail} />
        )}

        {tab === 'online' && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">Conexões, erros e quedas</h2>
                <p className="text-sm text-gray-500">Status de WhatsApp por cliente, com erros e quedas nas últimas 24h.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{formatNumber(asArray(online?.users).length)} clientes · {online?.summary?.stabilityPct ?? '—'}% estáveis</span>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); reloadOnline() }} className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_160px_130px_190px_110px_auto]">
              {onlineFilters.cenario && onlineFilters.cenario !== 'all' && (
                <button type="button" onClick={() => onOnlineSelect('cenario', 'all')} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 hover:bg-emerald-200">
                  {SCENARIO_LABELS[onlineFilters.cenario] || onlineFilters.cenario} · limpar filtro
                </button>
              )}
              <input value={onlineFilters.search} onChange={(e) => setOnlineFilters({ ...onlineFilters, search: e.target.value })} placeholder="Buscar nome ou e-mail" className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
              <select value={onlineFilters.waStatus} onChange={(e) => onOnlineSelect('waStatus', e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="all">Todos status</option>
                <option value="alerts">Só alertas</option>
                <option value="connected">Conectados</option>
                <option value="connecting">Tentando conectar</option>
                <option value="disconnected">Desconectados</option>
                <option value="without_session">Sem sessão</option>
              </select>
              <select value={onlineFilters.plan} onChange={(e) => onOnlineSelect('plan', e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="all">Todos planos</option>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="premium">Premium</option>
              </select>
              <select value={onlineFilters.activity} onChange={(e) => onOnlineSelect('activity', e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="all">Toda atividade</option>
                <option value="with_sends_24h">Com envios 24h</option>
                <option value="without_activity_24h">Sem atividade 24h</option>
              </select>
              <input value={onlineFilters.minErrors} onChange={(e) => setOnlineFilters({ ...onlineFilters, minErrors: e.target.value })} type="number" min="0" placeholder="Erros mín." className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
              <button disabled={onlineFiltering} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">{onlineFiltering ? 'Filtrando…' : 'Filtrar'}</button>
            </form>

            <VerVencidasToggle
              oculto={online?.summary?.ocultasPorVencimento}
              ligado={verVencidasAntigas}
              janelaDias={online?.summary?.janelaVencimentoDias}
              onToggle={() => {
                const proximo = !verVencidasAntigas
                setVerVencidasAntigas(proximo)
                reloadOnline({ incluirVencidos: proximo ? 1 : '' })
              }}
            />

            <SortBar value={onlineSort} onChange={setOnlineSort} />

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">WhatsApp</th>
                    <th className="px-3 py-2">Última atividade</th>
                    <th className="px-3 py-2 text-right">Erros 24h</th>
                    <th className="px-3 py-2 text-right">Quedas 24h</th>
                    <th className="px-3 py-2">Recuperação 24h</th>
                    <th className="px-3 py-2">Quem resolve</th>
                    <th className="px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedOnlineUsers.map(user => {
                    const meta = onlineStatusMeta(user?.waSession?.status, user?.waSession?.lifecycle)
                    const errors = Number(user?.errorCount24h || 0)
                    const drops = Number(user?.disconnects24h || 0)
                    return (
                      <tr key={user?.id ?? user?.email} className={`align-top ${errors || drops ? 'bg-red-50/40' : ''}`}>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-gray-900">{user?.name || user?.email || 'Cliente sem e-mail'}</p>
                            <PayingTag status={user?.payingStatus} />
                          </div>
                          <p className="text-xs text-gray-500">{user?.email} · {user?.plan ?? '—'}</p>
                          <p className="mt-1 text-[11px] text-gray-400">Criado em: {formatDate(user?.createdAt)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                          <p className="mt-1 text-[11px] text-gray-400">HB {formatRelative(user?.waSession?.lastHeartbeatAt)}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600"><p className="font-semibold">{formatRelative(user?.effectiveLastActivityAt)}</p><p className="text-gray-400">{formatNumber(user?.successCount24h)} envios 24h</p><p className="text-gray-400">Último envio: {formatDate(user?.lastMessageAt)}</p></td>
                        <td className={`px-3 py-3 text-right font-black tabular-nums ${errors ? 'text-red-700' : 'text-gray-400'}`}>{formatNumber(errors)}</td>
                        <td className={`px-3 py-3 text-right font-black tabular-nums ${drops ? 'text-red-700' : 'text-gray-400'}`}>{formatNumber(drops)}</td>
                        <td className="px-3 py-3 text-xs text-gray-600">
                          <p><strong>{formatDurationMs((user?.automaticOfflineMs24h || 0) + (user?.ongoingOfflineMs24h || 0))}</strong> offline auto</p>
                          <p>{formatNumber(user?.manualReconnects24h)} ação(ões) manuais</p>
                          {!!user?.manualOfflineMs24h && <p className="font-bold text-red-700">{formatDurationMs(user.manualOfflineMs24h)} parado até agir</p>}
                        </td>
                        <td className="px-3 py-3">
                          {user?.sessionOwner && user.sessionOwner !== 'connected' && (
                            <span title={user?.sessionOwnerReason || ''} className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold ${(OWNER_META[user.sessionOwner] || {}).cls || 'bg-gray-100 text-gray-600'}`}>
                              {(OWNER_META[user.sessionOwner] || {}).label || user.sessionOwner}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex flex-col items-end gap-2">
                            <button onClick={() => openOnlineDetail(user?.id)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Drill-down</button>
                            {user?.canAdminRetry && (
                              <button
                                onClick={() => reconectarCliente(user?.id)}
                                disabled={reconectando === user?.id}
                                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-black text-white hover:bg-sky-700 disabled:opacity-60"
                              >
                                {reconectando === user?.id ? 'Subindo…' : 'Tentar reconectar'}
                              </button>
                            )}
                            <WhatsAppButton phone={user?.contactPhone} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!asArray(online?.users).length && <tr><td colSpan={7} className="px-3 py-6 text-sm text-gray-400">Nenhum cliente ativo encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-gray-400">&quot;Quedas&quot; = desconexões no período. &quot;Offline auto&quot; = tempo fora até o robô recuperar sozinho. &quot;Ações manuais&quot; = start/pareamento pedidos pelo cliente.</p>
          </section>
        )}

        {tab === 'afiliados' && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Total de afiliados</p><p className="mt-1 text-2xl font-black text-gray-900">{formatNumber(affiliates?.total ?? asArray(affiliates?.profiles).length)}</p></div>
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Indicados</p><p className="mt-1 text-2xl font-black text-gray-900">{formatNumber(asArray(affiliates?.profiles).reduce((sum, p) => sum + Number(p?.totalReferrals || 0), 0))}</p></div>
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Comissões a pagar</p><p className="mt-1 text-2xl font-black text-orange-700">{formatCurrency(finance?.affiliateCommissionsPayable ?? 0)}</p><p className="text-[11px] text-orange-500">pendentes + elegíveis</p></div>
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Pagas (30d)</p><p className="mt-1 text-2xl font-black text-emerald-700">{formatCurrency(finance?.affiliateCommissionsPaid30d ?? 0)}</p></div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900">Afiliados</h2>
                  <p className="text-sm text-gray-500">Cadastro e desempenho de cada parceiro.</p>
                </div>
                <Link href="/admin/afiliados" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">Gestão completa</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Afiliado</th>
                      <th className="px-3 py-2">Indicados</th>
                      <th className="px-3 py-2">Comissão gerada</th>
                      <th className="px-3 py-2">Chave PIX</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {asArray(affiliates?.profiles).map(a => (
                      <tr key={a?.id} className="align-top">
                        <td className="px-3 py-3 text-xs font-bold text-gray-500">{a?.code ?? '—'}</td>
                        <td className="px-3 py-3"><p className="font-bold text-gray-900">{a?.user?.name ?? '—'}</p><p className="text-xs text-gray-500">{a?.user?.email ?? '—'}</p></td>
                        <td className="px-3 py-3 text-sm">{formatNumber(a?.totalReferrals ?? 0)}</td>
                        <td className="px-3 py-3 text-sm font-bold">{centsToBRL(a?.totalCommissions ?? 0)}</td>
                        <td className="px-3 py-3 text-xs text-gray-500">{a?.pixKey ?? '—'}</td>
                      </tr>
                    ))}
                    {!asArray(affiliates?.profiles).length && <tr><td colSpan={5} className="px-3 py-6 text-sm text-gray-400">Nenhum afiliado aprovado.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="mb-4">
                <h2 className="text-lg font-black text-gray-900">Comissões do mês</h2>
                <p className="text-sm text-gray-500">Aprove ou marque como paga.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Afiliado</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Criada</th>
                      <th className="px-3 py-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {asArray(commissions?.commissions).map(cm => {
                      const meta = COMMISSION_META[cm?.status] ?? COMMISSION_META.pending
                      const canApprove = cm?.status === 'pending'
                      const canPay = cm?.status === 'eligible' || cm?.status === 'approved'
                      return (
                        <tr key={cm?.id} className="align-top">
                          <td className="px-3 py-3"><p className="font-bold text-gray-900">{cm?.affiliate?.user?.name ?? '—'}</p><p className="text-xs text-gray-500">{cm?.affiliate?.user?.email ?? '—'}</p></td>
                          <td className="px-3 py-3 text-sm font-bold">{centsToBRL(cm?.commissionAmountCents ?? 0)}</td>
                          <td className="px-3 py-3 text-xs text-gray-500">{cm?.commissionType === 'recurring' ? 'Recorrente' : 'Inicial'}</td>
                          <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span></td>
                          <td className="px-3 py-3 text-xs text-gray-500">{formatDate(cm?.createdAt)}</td>
                          <td className="px-3 py-3 text-right">
                            {canApprove && <button onClick={() => approveCommission(cm.id)} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">Aprovar</button>}
                            {canPay && <button onClick={() => markCommissionPaid(cm.id)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Marcar paga</button>}
                          </td>
                        </tr>
                      )
                    })}
                    {!asArray(commissions?.commissions).length && <tr><td colSpan={6} className="px-3 py-6 text-sm text-gray-400">Nenhuma comissão neste mês.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}


      </div>
    </main>
  )
}
