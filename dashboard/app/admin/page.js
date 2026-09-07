'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import AdminTutorialAccordion from '@/components/AdminTutorialAccordion'
import SectionErrorBoundary from '@/components/SectionErrorBoundary'

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
  ['wa_disconnected', 'WhatsApp off'],
]
const CS_ALLOWED_EMAILS = ['flavia.vale@usp.br', 'flaviaroberta.1496@gmail.com', 'tacianeaas02@gmail.com']
const CS_PERMISSION_KEYS = ['customer_success', 'customer_success_ops', 'success']
const resolveAdminEmail = (admin) => String(admin?.email || admin?.user?.email || admin?.profile?.email || '').toLowerCase().trim()
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
  ['financeiro', 'Financeiro'],
  ['config', 'Configurações'],
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

// Avulso (pagou 30 dias, sem renovação automática) vs. recorrente (assinatura
// Mercado Pago, cobra sozinha) — mesmo plano pode ter vindo dos dois jeitos.
function BillingKindBadge({ customer }) {
  const sub = customer?.recurringSubscription
  if (customer?.billingKind === 'recorrente' && sub) {
    const tone = sub.autoRenew ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
    return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>Recorrente · {sub.statusLabel}</span>
  }
  if (customer?.billingKind === 'avulso') {
    return <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">Avulso</span>
  }
  return <span className="text-xs text-gray-400">—</span>
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

function ErrorVolumeCard({ summary }) {
  const items = asArray(summary?.errorsByMessage)
  const total = items.reduce((sum, item) => sum + Number(item?.count || 0), 0)
  const rangeFrom = summary?.range?.from ? formatDate(summary.range.from) : 'últimas 24h'
  const rangeTo = summary?.range?.to ? formatDate(summary.range.to) : 'agora'

  return (
    <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm ring-1 ring-slate-800 lg:col-span-2">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300">Volumetria operacional</p>
          <h2 className="mt-1 text-xl font-black">Erros nas últimas 24h</h2>
          <p className="mt-1 text-xs text-slate-400">Agrupado por mensagem técnica de erro, sem expor texto bruto das mensagens.</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-right">
          <p className="text-2xl font-black text-cyan-100">{formatNumber(total)}</p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-300">eventos agrupados</p>
          <p className="mt-1 text-[11px] text-slate-400">{rangeFrom} → {rangeTo}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[1fr_auto] gap-3 bg-white/5 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400 md:grid-cols-[1fr_130px_100px_150px]">
          <span>Mensagem / grupo</span>
          <span className="hidden md:block">Categoria</span>
          <span className="text-right">Volume</span>
          <span className="hidden text-right md:block">Último visto</span>
        </div>
        <div className="divide-y divide-white/10">
          {items.map((item, index) => {
            const percent = total ? Math.round((Number(item?.count || 0) / total) * 1000) / 10 : 0
            return (
              <div key={item?.errorMsg ?? `error-${index}`} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_130px_100px_150px]">
                <div className="min-w-0">
                  <p className="break-words font-mono text-xs font-bold text-slate-100">{item?.errorMsg || 'unknown'}</p>
                  {item?.sampleErrorMsg && item.sampleErrorMsg !== item.errorMsg && <p className="mt-1 break-words text-[11px] text-slate-500">Exemplo recente: {item.sampleErrorMsg}</p>}
                  <p className="mt-1 text-[11px] text-slate-500 md:hidden">{item?.category || 'UNKNOWN'} · último {formatDate(item?.lastSeenAt)}</p>
                </div>
                <span className="hidden self-start rounded-full bg-white/10 px-2 py-1 text-[11px] font-black text-slate-300 md:inline-block">{item?.category || 'UNKNOWN'}</span>
                <div className="text-right">
                  <p className="text-base font-black text-cyan-100">{formatNumber(item?.count)}</p>
                  <p className="text-[11px] text-slate-500">{percent}%</p>
                </div>
                <span className="hidden self-center text-right text-xs text-slate-400 md:block">{formatDate(item?.lastSeenAt)}</span>
              </div>
            )
          })}
          {!items.length && <p className="px-4 py-6 text-sm text-slate-400">Nenhum erro ou bloqueio com mensagem técnica nas últimas 24h.</p>}
        </div>
      </div>
    </section>
  )
}

function statValue(key, value) {
  if (key === 'revenue30d') return formatCurrency(value)
  if (key === 'successRate24h') return value === null || value === undefined ? '—' : `${value}%`
  return value ?? '—'
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

// Botão "Ver mais": conta vencida há muito tempo fica fora da visão por
// padrão. Some da TELA, não do sistema — e o botão diz quantas são, para
// ninguém achar que o número sumiu.
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

function ScenarioCard({ label, value, tone = 'ok', helper, onClick }) {
  const content = (
    <>
      <p className="text-[11px] font-black uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      {helper && <p className="mt-1 text-xs opacity-80">{helper}</p>}
    </>
  )
  if (!onClick) return <article className={`rounded-2xl p-4 ring-1 shadow-sm ${toneClasses(tone)}`}>{content}</article>
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl p-4 text-left ring-1 shadow-sm transition hover:brightness-95 ${toneClasses(tone)}`}>
      {content}
    </button>
  )
}

function CommandCard({ label, value, tone = 'ok', helper }) {
  return <article className={`rounded-2xl p-4 ring-1 shadow-sm ${toneClasses(tone)}`}><p className="text-[11px] font-black uppercase tracking-wide opacity-80">{label}</p><p className="mt-1 text-2xl font-black">{value}</p>{helper && <p className="mt-1 text-xs opacity-80">{helper}</p>}</article>
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
                      <p className="break-words font-mono text-xs font-bold text-slate-900">{item.errorMsg}</p>
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


function PlanEditor({ plan, onSave }) {
  const [form, setForm] = useState({ title: plan.title, description: plan.description, price: plan.price, features: Array.isArray(plan.features) ? plan.features.join('\n') : '', position: plan.position ?? 0 })
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(plan.id, form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-wide text-gray-900">{plan.id}</h3>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-gray-500">Ordem {form.position}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_120px]">
        <input
          value={form.title}
          onChange={event => setForm({ ...form, title: event.target.value })}
          placeholder="Título do plano"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
          required
        />
        <input
          value={form.price}
          onChange={event => setForm({ ...form, price: event.target.value })}
          placeholder="Valor"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
          required
        />
        <textarea
          value={form.description}
          onChange={event => setForm({ ...form, description: event.target.value })}
          placeholder="Descrição do plano"
          className="min-h-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 md:col-span-2"
          required
        />
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-600">Bullet points do plano</span>
          <textarea
            value={form.features}
            onChange={event => setForm({ ...form, features: event.target.value })}
            placeholder={'Conversão de links suportados\nMonitoramento de grupos\nEnvio para grupos de destino\nHistórico de logs\nCom anúncios'}
            className="min-h-28 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <p className="mt-1 text-xs text-gray-500">Digite uma característica por linha. Esses bullet points aparecem na Landing Page e na aba Planos do Dashboard.</p>
        </label>
        <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
          <input
            type="number"
            value={form.position}
            onChange={event => setForm({ ...form, position: Number(event.target.value) })}
            placeholder="Ordem"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 sm:w-28"
          />
            <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar plano'}
            </button>
        </div>
      </div>
    </form>
  )
}

function FaqEditor({ faq, onSave, onDelete }) {
  const emptyForm = { id: '', question: '', answer: '', position: 0, isActive: true }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  function editItem(item) {
    setForm({
      id: item.id,
      question: item.question,
      answer: item.answer,
      position: item.position ?? 0,
      isActive: item.isActive ?? true,
    })
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
      setForm(emptyForm)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-black text-gray-900">FAQ</h3>
          <p className="text-sm text-gray-500">Adicione, edite e exclua perguntas exibidas na Landing Page.</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{faq?.items?.length ?? 0} perguntas</span>
      </div>

      <form onSubmit={submit} className="mb-5 grid gap-3 lg:grid-cols-[1fr_1fr_110px_120px]">
        <input
          value={form.question}
          onChange={event => setForm({ ...form, question: event.target.value })}
          placeholder="Pergunta"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
          required
        />
        <textarea
          value={form.answer}
          onChange={event => setForm({ ...form, answer: event.target.value })}
          placeholder="Resposta"
          className="min-h-11 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
          required
        />
        <input
          type="number"
          value={form.position}
          onChange={event => setForm({ ...form, position: Number(event.target.value) })}
          placeholder="Ordem"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'Salvando...' : form.id ? 'Atualizar' : 'Criar'}
          </button>
          {form.id && <button type="button" onClick={() => setForm(emptyForm)} className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200">Limpar</button>}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 lg:col-span-4">
          <input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} />
          Exibir na Landing Page
        </label>
      </form>

      <div className="space-y-3">
        {asArray(faq?.items).map(item => (
          <div key={item.id} className="rounded-xl border border-gray-100 p-3 text-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-bold text-gray-900">{item.position}. {item.question}</p>
                <p className="mt-1 text-gray-500">{item.answer}</p>
                <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.isActive ? 'Ativo' : 'Oculto'}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editItem(item)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Editar</button>
                <button onClick={() => onDelete(item)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100">Excluir</button>
              </div>
            </div>
          </div>
        ))}
        {!faq?.items?.length && <p className="text-sm text-gray-400">Nenhuma pergunta cadastrada.</p>}
      </div>
    </div>
  )
}

function TutorialEditor({ tutorial, onSave }) {
  const defaultTemplate = {
    title: 'Guia de Configuração: Pegando suas Credenciais (BOTinho)',
    body: `Para que o BOTinho trabalhe para você, precisamos conectar suas contas de afiliado.\n\n🛠️ Passo 0 — Ferramenta Essencial\n1. Instale a extensão Cookie-Editor no Google Chrome (computador).\n2. Abra a Chrome Web Store e clique em “Usar no Chrome”.\n\n🔵 Mercado Livre — Como conseguir credenciais\n1. Faça login na sua conta de afiliado.\n2. Acesse o Gerador de Links: https://www.mercadolivre.com.br/afiliados/linkbuilder#hub\n3. Copie a Etiqueta em uso exibida no Gerador de Links.\n4. Clique na extensão Cookie-Editor e localize o cookie “ssid”.\n5. Copie o valor do “ssid” e salve no BOTinho.\n\n🟡 Amazon — Como conseguir credenciais\n1. Acesse https://associados.amazon.com.br/\n2. Com a página aberta, clique no Cookie-Editor.\n3. Copie os cookies solicitados pelo BOTinho.\n\n🟠 Shopee — Solicitação de API\n1. Acesse o formulário: https://help.shopee.com.br/portal/webform/bbce78695c364ba18c9cbceb74ec9091?entryPoint=1&lastArticleID=\n2. Respostas: AFILIADO > Dúvidas sobre o Programa de Afiliados > Próximo > SIM > Não, estou com outras dificuldades/dúvidas.\n3. Informe seu ID de afiliado e selecione tema/cenário para ativar API.\n4. Envie e acompanhe diariamente: https://affiliate.shopee.com.br/open_api\n\n⏳ E agora?\nApós a liberação da Shopee, clique em “Redefinir” para visualizar Key/Secret e colar no BOTinho.`,
    images: [
      { id: 'print-1', label: 'PRINT 1 — Cookie-Editor', url: '', note: 'Destaque o botão “Usar no Chrome”.' },
      { id: 'print-2', label: 'PRINT 2 — Mercado Livre Etiqueta em uso', url: '', note: 'Destaque a Etiqueta em uso.' },
      { id: 'print-3', label: 'PRINT 3 — Ícone da extensão', url: '', note: 'Mostre onde clicar no ícone de extensões.' },
      { id: 'print-4', label: 'PRINT 4 — Cookie ssid', url: '', note: 'Destaque o valor do cookie ssid.' },
      { id: 'print-amazon', label: 'PRINT AMAZON', url: '', note: 'Mostre os cookies necessários na Amazon.' },
    ],
  }

  const [title, setTitle] = useState(tutorial?.title ?? '')
  const [body, setBody] = useState(tutorial?.body ?? '')
  const [imagesText, setImagesText] = useState(JSON.stringify(tutorial?.images ?? [], null, 2))
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    let images = []
    try { images = JSON.parse(imagesText || '[]') } catch { throw new Error('JSON de prints inválido.') }
    setSaving(true)
    try { await onSave({ title, body, images }) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
      <h3 className="text-base font-black text-gray-900">Tutorial (Dashboard)</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do tutorial" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" required />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Texto principal do tutorial" className="min-h-32 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" required />
      <textarea value={imagesText} onChange={(e) => setImagesText(e.target.value)} placeholder='[{"id":"print1","label":"PRINT 1","url":"https://...","note":"..."}]' className="min-h-32 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-400" />
      <p className="text-xs text-gray-500">Use JSON para os prints: id, label, url e note.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar tutorial'}</button>
        <button type="button" onClick={() => { setTitle(defaultTemplate.title); setBody(defaultTemplate.body); setImagesText(JSON.stringify(defaultTemplate.images, null, 2)) }} className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
          Carregar modelo inicial
        </button>
      </div>
    </form>
  )
}


function TermsEditor({ terms, onSave }) {
  const [form, setForm] = useState(() => ({
    title: terms?.title ?? '',
    summary: terms?.summary ?? '',
    lastUpdatedLabel: terms?.content?.lastUpdatedLabel ?? '',
    intro: terms?.content?.intro ?? '',
    finalDeclaration: terms?.content?.finalDeclaration ?? '',
    sections: terms?.content?.sections ?? [],
  }))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')


  function updateSection(index, patch) {
    setForm(current => ({
      ...current,
      sections: asArray(current.sections).map((section, idx) => idx === index ? { ...section, ...patch } : section),
    }))
  }

  function addSection() {
    setForm(current => ({
      ...current,
      sections: [...current.sections, { title: `${current.sections.length + 1}. Nova seção`, body: ['Texto da nova seção.'], warning: false }],
    }))
  }

  function removeSection(index) {
    if (!window.confirm('Remover esta seção dos Termos?')) return
    setForm(current => ({ ...current, sections: asArray(current.sections).filter((_, idx) => idx !== index) }))
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        title: form.title,
        summary: form.summary,
        content: {
          lastUpdatedLabel: form.lastUpdatedLabel,
          intro: form.intro,
          finalDeclaration: form.finalDeclaration,
          sections: asArray(form.sections).map(section => ({
            title: section.title,
            warning: Boolean(section.warning),
            body: Array.isArray(section.body) ? section.body : String(section.body ?? '').split(/\n\s*\n/g),
          })),
        },
      }
      await onSave(payload)
      setMessage('Termos salvos. A página /termos e novos aceites passam a usar a nova versão imediatamente.')
    } catch (err) {
      setMessage(err?.message || 'Falha ao salvar termos.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="admin-legal-terms" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Legal · Termos editáveis</p>
          <h2 className="text-lg font-black text-gray-900">Termos de Uso e Ciência de Riscos</h2>
          <p className="text-sm text-gray-500">Edite aqui o texto exibido em /termos. Cada salvamento gera uma nova versão para os próximos aceites de cadastro.</p>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Versão atual: {terms?.version || 'fallback'}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-600">Título público</span>
            <input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" required />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-600">Última atualização exibida</span>
            <input value={form.lastUpdatedLabel} onChange={event => setForm({ ...form, lastUpdatedLabel: event.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" placeholder="09 de junho de 2026" />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-600">Resumo SEO/descrição</span>
          <textarea value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })} className="min-h-20 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" required />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-600">Resumo destacado no topo</span>
          <textarea value={form.intro} onChange={event => setForm({ ...form, intro: event.target.value })} className="min-h-24 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
        </label>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-black text-gray-900">Seções dos termos</h3>
            <button type="button" onClick={addSection} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Adicionar seção</button>
          </div>
          {asArray(form.sections).map((section, index) => (
            <div key={`${index}-${section.title}`} className={`rounded-2xl border p-4 ${section.warning ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <input value={section.title} onChange={event => updateSection(index, { title: event.target.value })} className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400" required />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-red-700">
                    <input type="checkbox" checked={Boolean(section.warning)} onChange={event => updateSection(index, { warning: event.target.checked })} />
                    Destaque de risco
                  </label>
                  <button type="button" onClick={() => removeSection(index)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100 hover:bg-red-50">Remover</button>
                </div>
              </div>
              <textarea
                value={(section.body ?? []).join('\n\n')}
                onChange={event => updateSection(index, { body: event.target.value.split(/\n\s*\n/g) })}
                className="min-h-32 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Escreva os parágrafos desta seção. Separe parágrafos com uma linha em branco."
                required
              />
            </div>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-600">Declaração final de aceite</span>
          <textarea value={form.finalDeclaration} onChange={event => setForm({ ...form, finalDeclaration: event.target.value })} className="min-h-24 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
        </label>

        {message && <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${message.startsWith('Termos salvos') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{message}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'Salvando termos...' : 'Salvar termos e publicar'}
          </button>
          <Link href="/termos" target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">Ver página pública</Link>
        </div>
      </form>
    </section>
  )
}

function LandingPageContentAccordion({ plans, faq, tutorial, onSavePlan, onSaveFaq, onDeleteFaq, onSaveTutorial }) {
  const [open, setOpen] = useState(false)

  return (
    <section id="admin-lp-content" className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-col gap-3 p-5 text-left sm:flex-row sm:items-center sm:justify-between"
        aria-expanded={open}
        aria-controls="admin-lp-content-panel"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Conteúdo da LP · último bloco</p>
          <h2 className="text-lg font-black text-gray-900">Configurações da Landing Page</h2>
          <p className="text-sm text-gray-500">Edite planos e FAQ consumidos dinamicamente pela página pública.</p>
        </div>
        <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
          {open ? 'Recolher' : 'Expandir'}
        </span>
      </button>

      {open && (
        <div id="admin-lp-content-panel" className="space-y-6 border-t border-gray-100 p-5">
          <div>
            <div className="mb-4">
              <h3 className="text-base font-black text-gray-900">Planos</h3>
              <p className="text-sm text-gray-500">Edite título, descrição, valor e bullet points dos planos Trial, Basic e Pro (sincronizado com LP e Dashboard).</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {asArray(plans).map(plan => <PlanEditor key={`${plan.id}-${plan.updatedAt ?? ''}`} plan={plan} onSave={onSavePlan} />)}
              {!plans?.length && <p className="text-sm text-gray-400">Nenhum plano cadastrado.</p>}
            </div>
          </div>

          <FaqEditor faq={faq} onSave={onSaveFaq} onDelete={onDeleteFaq} />
          <TutorialEditor key={`tutorial-${tutorial?.updatedAt ?? 'empty'}`} tutorial={tutorial} onSave={onSaveTutorial} />
        </div>
      )}
    </section>
  )
}

function StagingPowerCard({ admin }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canRead = admin?.permissions?.includes('tech:read')
  const canManage = admin?.permissions?.includes('tech:write')

  function refresh() {
    // Promise.resolve().then(...) garante que mesmo um throw síncrono
    // (ex.: api.adminStagingStatus indefinida em bundle defasado) vire uma
    // rejeição capturada pelo .catch, em vez de derrubar o painel inteiro.
    return Promise.resolve()
      .then(() => api.adminStagingStatus())
      .then((s) => { setStatus(s); setError('') })
      .catch((e) => { setError(e?.message || 'Falha ao carregar status do staging.'); setStatus(null) })
  }

  useEffect(() => {
    if (!canRead) return
    let active = true
    Promise.resolve()
      .then(() => api.adminStagingStatus())
      .then((s) => { if (active) { setStatus(s); setError('') } })
      .catch((e) => { if (active) { setError(e?.message || 'Falha ao carregar status do staging.'); setStatus(null) } })
    return () => { active = false }
  }, [canRead])

  async function toggle(action) {
    if (busy) return
    setBusy(true); setError('')
    try {
      setStatus(await api.adminStagingPower(action))
    } catch (e) {
      setError(e?.message || 'Falha ao alternar staging.')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!canRead) return null
  const on = status?.on

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Infra · Economia de memória</p>
          <h2 className="text-lg font-black text-gray-900">Staging (liga/desliga)</h2>
          <p className="text-sm text-gray-500">Desligue o staging quando não estiver testando para liberar RAM no VPS. Ligue só durante validações.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status ? (on ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600') : 'bg-gray-100 text-gray-400'}`}>
          {status ? (on ? 'Ligado' : 'Desligado') : '—'}
        </span>
      </div>

      {status && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {status.apps.map((app) => (
            <div key={app.name} className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">{app.name}</p>
              <p className={`text-sm font-black ${app.online ? 'text-green-700' : 'text-gray-500'}`}>{app.online ? 'online' : 'parado'}</p>
              <p className="text-xs text-gray-400">{app.memoryMB} MB</p>
            </div>
          ))}
          <div className="rounded-xl bg-indigo-50 p-3">
            <p className="text-xs text-indigo-600">RAM staging</p>
            <p className="text-xl font-black text-indigo-700">{status.totalMemoryMB} MB</p>
          </div>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canManage || busy || !status || !on}
          onClick={() => toggle('off')}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Aguarde…' : 'Desligar staging'}
        </button>
        <button
          type="button"
          disabled={!canManage || busy || !status || on}
          onClick={() => toggle('on')}
          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Aguarde…' : 'Ligar staging'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={refresh}
          className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-40"
        >
          Atualizar
        </button>
      </div>
      {!canManage && <p className="mt-2 text-xs text-gray-400">Somente leitura — sem permissão tech:write para alternar.</p>}
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
                    <p className="font-bold text-gray-900">{user?.email ?? 'Cliente sem e-mail'}</p>
                    <p className="text-xs text-gray-500">{user?.contactPhone || 'Sem celular'} · {user?.plan ?? '—'} · {user?.accessStatus ?? '—'}</p>
                    <p className="mt-1 text-[11px] text-gray-400">Criado em: {formatDate(user?.createdAt)}</p>
                    <p className="text-[11px] text-gray-400">Contato CS: {formatDate(user?.lastSupportContactAt)}</p>
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

function ManualPaymentModal({ onClose, onSaved }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ plan: 'pro', days: '30', amount: '55,20', paymentMethod: 'pix', note: '' })
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (selected || search.trim().length < 2) return
    let active = true
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await api.adminUsers({ search: search.trim(), limit: 8, incluirVencidos: 1 })
        if (active) setResults(asArray(data?.users))
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível buscar clientes.')
      } finally { if (active) setSearching(false) }
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [search, selected])

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!selected) { setError('Selecione a cliente que pagou.'); return }
    setSaving(true)
    try {
      const result = await api.adminCreateManualPayment({ userId: selected.id, ...form })
      await onSaved(result)
    } catch (err) {
      setError(err.message || 'Não foi possível registrar o pagamento.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} className="my-8 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Financeiro</p><h2 className="mt-1 text-xl font-black">Registrar pagamento por fora</h2><p className="mt-1 text-sm text-slate-300">Confirme o recebimento e libere o acesso em uma só operação auditada.</p></div>
            <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold hover:bg-white/20" aria-label="Fechar">Fechar</button>
          </div>
        </div>
        <div className="space-y-5 p-6">
          {error && <Alert type="error">{error}</Alert>}
          <div>
            <label className="text-sm font-bold text-gray-800">Cliente</label>
            {selected ? (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div><p className="font-bold text-emerald-950">{selected.name || selected.email}</p><p className="text-xs text-emerald-700">{selected.email} · vence {formatDate(selected.accessExpiresAt)}</p></div>
                <button type="button" onClick={() => { setSelected(null); setSearch('') }} className="text-xs font-bold text-emerald-800 underline">Trocar</button>
              </div>
            ) : (
              <div className="relative mt-2">
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Busque por nome, e-mail ou telefone" autoFocus className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                {search.trim().length >= 2 && (searching || results.length > 0) && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  {searching ? <p className="p-3 text-sm text-gray-500">Buscando...</p> : results.map(user => <button key={user.id} type="button" onClick={() => setSelected(user)} className="block w-full border-b border-gray-100 p-3 text-left last:border-0 hover:bg-emerald-50"><span className="block text-sm font-bold text-gray-900">{user.name || 'Sem nome'}</span><span className="block text-xs text-gray-500">{user.email} · {user.contactPhone || 'sem telefone'}</span></button>)}
                </div>}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-gray-800">Plano<select value={form.plan} onChange={event => setForm({ ...form, plan: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-normal"><option value="basic">Basic</option><option value="pro">Pro</option></select></label>
            <label className="text-sm font-bold text-gray-800">Dias de acesso<input type="number" min="1" max="3650" value={form.days} onChange={event => setForm({ ...form, days: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-bold text-gray-800">Valor recebido (R$)<input inputMode="decimal" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-bold text-gray-800">Forma de pagamento<select value={form.paymentMethod} onChange={event => setForm({ ...form, paymentMethod: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-normal"><option value="pix">Pix</option><option value="transfer">Transferência</option><option value="cash">Dinheiro</option><option value="card">Cartão</option><option value="other">Outro</option></select></label>
          </div>
          <label className="block text-sm font-bold text-gray-800">Observação (opcional)<textarea value={form.note} maxLength={500} onChange={event => setForm({ ...form, note: event.target.value })} placeholder="Ex.: renovação com 20% de desconto, comprovante conferido" className="mt-2 min-h-20 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal" /></label>
          <div className="rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">Os dias serão somados ao vencimento atual se o acesso ainda estiver ativo. Se estiver vencido, contam a partir de hoje. O registro entra na receita e no histórico, sem taxa do Mercado Pago.</div>
          <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-100">Cancelar</button><button disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Registrando...' : 'Confirmar pagamento'}</button></div>
        </div>
      </form>
    </div>
  )
}

export default function AdminPage() {
  const [overview, setOverview] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [users, setUsers] = useState(null)
  const [waDisconnectedUsers, setWaDisconnectedUsers] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [sessionTelemetry, setSessionTelemetry] = useState(null)
  const [logs, setLogs] = useState(null)
  const [logsSummary24h, setLogsSummary24h] = useState(null)
  const [finance, setFinance] = useState(null)
  const [payments, setPayments] = useState(null)
  const [subscriptions, setSubscriptions] = useState(null)
  const [success, setSuccess] = useState(null)
  const [successQueue, setSuccessQueue] = useState(null)
  const [systemHealth, setSystemHealth] = useState(null)
  const [systemMetrics, setSystemMetrics] = useState(null)
  const [systemObservability, setSystemObservability] = useState(null)
  const [online, setOnline] = useState(null)
  const [faq, setFaq] = useState(null)
  const [plans, setPlans] = useState([])
  const [tutorial, setTutorial] = useState(null)
  const [terms, setTerms] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [risk, setRisk] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [tab, setTab] = useState('inicio')
  const [affiliates, setAffiliates] = useState(null)
  const [commissions, setCommissions] = useState(null)
  const [onlineDetail, setOnlineDetail] = useState(null)
  const [onlineDetailLoading, setOnlineDetailLoading] = useState(false)
  const [onlineFilters, setOnlineFilters] = useState({ search: '', waStatus: 'all', plan: 'all', activity: 'all', minErrors: '', cenario: 'all' })
  // Conta vencida há muito tempo fica fora da visão por padrão — polui e
  // esconde o que precisa de decisão hoje. "Ver mais" traz de volta.
  const [verVencidasAntigas, setVerVencidasAntigas] = useState(false)
  const [reconectando, setReconectando] = useState(null)
  const [onlineFiltering, setOnlineFiltering] = useState(false)
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false)
  // Duas tabelas da aba Financeiro que só valem a pena carregar quando a
  // pessoa abre a aba — não entram no Promise.all gigante do boot.
  const [overduePaidList, setOverduePaidList] = useState(null)
  const [paidCustomersList, setPaidCustomersList] = useState(null)

  useEffect(() => {
    if (tab !== 'financeiro' || overduePaidList || paidCustomersList) return
    let active = true
    Promise.all([
      api.adminSubscriptions({ limit: 50, status: 'overdue' }).catch(() => null),
      api.adminSubscriptions({ limit: 50, status: 'paid' }).catch(() => null),
    ]).then(([overdueData, paidData]) => {
      if (!active) return
      setOverduePaidList(overdueData)
      setPaidCustomersList(paidData)
    })
    return () => { active = false }
  }, [tab, overduePaidList, paidCustomersList])

  async function manualPaymentSaved() {
    const [financeData, paymentsData, subscriptionsData] = await Promise.all([
      api.adminFinanceOverview(), api.adminPayments({ limit: 10 }), api.adminSubscriptions({ limit: 10, status: 'expiring_soon' }),
    ])
    setFinance(financeData)
    setPayments(paymentsData)
    setSubscriptions(subscriptionsData)
    setManualPaymentOpen(false)
  }

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
    ]).then(([a, c]) => {
      if (!active) return
      setAffiliates(a)
      setCommissions(c)
    })
    return () => { active = false }
  }, [])

  async function loadAdminData(nextRisk = risk, nextSearch = search, nextVerVencidas = verVencidasAntigas) {
    if (accessDenied) return
    setError('')
    const [adminData, overviewData, usersData, waDisconnectedUsersData, sessionsData, sessionTelemetryData, logsData, logsSummary24hData, financeData, paymentsData, subscriptionsData, successData, successQueueData, systemHealthData, systemMetricsData, systemObservabilityData, onlineData, lpContentData, termsData] = await Promise.all([
      api.adminMe(),
      api.adminOverview(),
      api.adminUsers({ risk: nextRisk, search: nextSearch, limit: 20, incluirVencidos: nextVerVencidas ? 1 : '' }),
      api.adminWaDisconnectedUsers({ search: nextSearch, limit: 12, minSuccess: 1 }).catch(() => null),
      api.adminSessions({ limit: 10 }),
      api.adminSessionTelemetry({ limit: 60 }).catch(() => null),
      api.adminLogs({ limit: 25, status: 'all' }),
      api.adminLogsSummary('24h', { topErrors: 50 }).catch(() => null),
      api.adminFinanceOverview().catch(() => null),
      api.adminPayments({ limit: 10 }).catch(() => null),
      api.adminSubscriptions({ limit: 10, status: 'expiring_soon' }).catch(() => null),
      api.adminSuccessOverview().catch(() => null),
      api.adminSuccessQueue({ limit: 8 }).catch(() => null),
      api.adminSystemHealth().catch(() => null),
      api.adminSystemMetrics().catch(() => null),
      api.adminSystemObservability().catch(() => null),
      api.adminOnline({ limit: 120, incluirVencidos: nextVerVencidas ? 1 : '' }).catch(() => null),
      api.adminLpContent().catch(() => null),
      api.adminLegalTerms().catch(() => null),
    ])
    setAdmin(adminData)
    setOverview(overviewData)
    setUsers(usersData)
    setWaDisconnectedUsers(waDisconnectedUsersData)
    setSessions(sessionsData)
    setSessionTelemetry(sessionTelemetryData)
    setLogs(logsData)
    setLogsSummary24h(logsSummary24hData)
    setFinance(financeData)
    setPayments(paymentsData)
    setSubscriptions(subscriptionsData)
    setSuccess(successData)
    setSuccessQueue(successQueueData)
    setSystemHealth(systemHealthData)
    setSystemMetrics(systemMetricsData)
    setSystemObservability(systemObservabilityData)
    setOnline(onlineData)
    setFaq(lpContentData?.faq ?? null)
    setPlans(lpContentData?.plans ?? [])
    setTutorial(lpContentData?.tutorial ?? null)
    setTerms(termsData?.terms ?? null)
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
          api.adminSessions({ limit: 10 }),
          api.adminSessionTelemetry({ limit: 60 }).catch(() => null),
          api.adminLogs({ limit: 25, status: 'all' }),
          api.adminLogsSummary('24h', { topErrors: 50 }).catch(() => null),
          api.adminFinanceOverview().catch(() => null),
          api.adminPayments({ limit: 10 }).catch(() => null),
          api.adminSubscriptions({ limit: 10, status: 'expiring_soon' }).catch(() => null),
          api.adminSuccessOverview().catch(() => null),
          api.adminSuccessQueue({ limit: 8 }).catch(() => null),
          api.adminSystemHealth().catch(() => null),
          api.adminSystemMetrics().catch(() => null),
          api.adminSystemObservability().catch(() => null),
          api.adminOnline({ limit: 120 }).catch(() => null),
          api.adminLpContent().catch(() => null),
          api.adminLegalTerms().catch(() => null),
        ])
      })
      .then((result) => {
        if (!active || !result) return
        const [adminData, overviewData, usersData, waDisconnectedUsersData, sessionsData, sessionTelemetryData, logsData, logsSummary24hData, financeData, paymentsData, subscriptionsData, successData, successQueueData, systemHealthData, systemMetricsData, systemObservabilityData, onlineData, lpContentData, termsData] = result
        setAdmin(adminData)
        setOverview(overviewData)
        setUsers(usersData)
        setWaDisconnectedUsers(waDisconnectedUsersData)
        setSessions(sessionsData)
        setSessionTelemetry(sessionTelemetryData)
        setLogs(logsData)
        setLogsSummary24h(logsSummary24hData)
        setFinance(financeData)
        setPayments(paymentsData)
        setSubscriptions(subscriptionsData)
        setSuccess(successData)
        setSuccessQueue(successQueueData)
        setSystemHealth(systemHealthData)
        setSystemMetrics(systemMetricsData)
        setSystemObservability(systemObservabilityData)
        setOnline(onlineData)
        setFaq(lpContentData?.faq ?? null)
        setPlans(lpContentData?.plans ?? [])
        setTutorial(lpContentData?.tutorial ?? null)
        setTerms(termsData?.terms ?? null)
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
                  <p className="font-bold text-gray-900">{user?.email ?? 'Cliente sem e-mail'}</p>
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

  const canAccessCustomerSuccess = useMemo(() => {
    const email = resolveAdminEmail(admin)
    const permissions = Array.isArray(admin?.permissions) ? admin.permissions : []
    const hasPermission = permissions.some(permission => CS_PERMISSION_KEYS.includes(String(permission).toLowerCase().trim()))
    return CS_ALLOWED_EMAILS.includes(email) || hasPermission || admin?.role === 'owner'
  }, [admin])

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


  async function refreshLpContent() {
    const data = await api.adminLpContent()
    setFaq(data?.faq ?? null)
    setPlans(data?.plans ?? [])
    setTutorial(data?.tutorial ?? null)
  }

  async function saveLpPlan(id, form) {
    setError('')
    try {
      await api.adminUpdateLpPlan(id, form)
      await refreshLpContent()
    } catch (err) {
      setError(err.message || 'Falha ao salvar plano da LP.')
      throw err
    }
  }

  async function saveFaqItem(form) {
    setError('')
    try {
      const payload = {
        question: form.question,
        answer: form.answer,
        position: form.position,
        isActive: form.isActive,
      }
      if (form.id) await api.adminUpdateFaq(form.id, payload)
      else await api.adminCreateFaq(payload)
      await refreshLpContent()
    } catch (err) {
      setError(err.message || 'Falha ao salvar pergunta do FAQ.')
      throw err
    }
  }

  async function deleteFaqItem(item) {
    if (!window.confirm(`Excluir a pergunta "${item.question}"?`)) return
    setError('')
    try {
      await api.adminDeleteFaq(item.id)
      await refreshLpContent()
    } catch (err) {
      setError(err.message || 'Falha ao excluir pergunta do FAQ.')
    }
  }

  async function saveLegalTerms(form) {
    setError('')
    try {
      const data = await api.adminUpdateLegalTerms(form)
      setTerms(data?.terms ?? null)
    } catch (err) {
      setError(err.message || 'Falha ao salvar termos legais.')
      throw err
    }
  }

  async function saveTutorialContent(form) {
    setError('')
    try {
      await api.adminUpdateTutorialContent(form)
      await refreshLpContent()
    } catch (err) {
      setError(err.message || 'Falha ao salvar tutorial.')
      throw err
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
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-base font-black text-white">B</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-gray-900">BOTinho</span>
                <span className="text-xs font-semibold text-gray-400">admin</span>
              </div>
            </div>
            <nav className="flex flex-wrap gap-1">
              {TABS.map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === key ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{label}</button>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Link href="/admin/clientes" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">Clientes</Link>
              <Link href="/admin/funil" className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Funil</Link>
              <Link href="/admin/automacoes" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Automações</Link>
              <Link href="/admin/emails" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">E-mails</Link>
              <Link href="/admin/ofertas" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Ofertas (imagem)</Link>
              <button onClick={() => applyFilters()} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Atualizar</button>
              <Link href="/painel" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Voltar</Link>
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <button onClick={() => setTab('observabilidade')} className={`flex items-center gap-1.5 text-xs font-bold ${tab === 'observabilidade' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${tab === 'observabilidade' ? 'bg-slate-900' : 'bg-slate-400'}`}></span>Observabilidade (técnico)
            </button>
          </div>
        </div>

        {error && <Alert type="error" title="Painel admin" message={error} />}

        {(tab === 'inicio' || tab === 'online') && (overview || systemObservability || online) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Semáforo operacional</p>
                <h2 className="text-lg font-black text-gray-900">O que precisa de decisão agora</h2>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">Atualização em tempo real</span>
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
                onClick={() => openScenario('parado')}
              />
              <ScenarioCard
                label="Sem receber"
                value={formatNumber(online?.summary?.scenarios?.semReceber ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.semReceber ?? 0, 1, 3)}
                helper="conectadas e sem mensagem chegando"
                onClick={() => openScenario('blind')}
              />
              <ScenarioCard
                label="Caindo demais"
                value={formatNumber(online?.summary?.scenarios?.caindoDemais ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.caindoDemais ?? 0, 1, 3)}
                helper={`acima de ${formatNumber(online?.summary?.scenarios?.dropsAlertThreshold ?? 20)} quedas em 24h`}
                onClick={() => openScenario('quedas')}
              />
              <ScenarioCard
                label="Cliente teve que agir"
                value={formatNumber(online?.summary?.scenarios?.clienteAgiu ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.clienteAgiu ?? 0, 1, 2)}
                helper={`${formatDurationMs(online?.summary?.scenarios?.manualOfflineMs24h)} parados até agir`}
                onClick={() => openScenario('manual')}
              />
              <ScenarioCard
                label="Fonte dessincronizada"
                value={formatNumber(online?.summary?.scenarios?.fonteQuebrada ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.fonteQuebrada ?? 0, 1, 5)}
                helper="conserto automático não resolveu (7d)"
                onClick={() => openScenario('desync')}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <CommandCard label="Online agora" value={online?.summary?.onlineUsers ?? '—'} tone={severityTone(0)} helper={`${online?.summary?.stabilityPct ?? '—'}% estabilidade`} />
              <CommandCard label="Erros 24h" value={overview?.errors24h ?? 0} tone={severityTone(overview?.errors24h, 1, 10)} helper="Acima de 10 = crítico" />
              <CommandCard label="DB / API" value={systemObservability?.goNoGo?.dbOk ? 'OK' : 'Revisar'} tone={systemObservability?.goNoGo?.dbOk ? 'ok' : 'critical'} helper={`${systemObservability?.api?.total5xx ?? 0} erros 5xx`} />
              <CommandCard label="Filas/DLQ" value={(systemObservability?.goNoGo?.paymentDlqOpen ?? 0) + (systemObservability?.queues?.sendDlq?.lastKnownDlqTotal ?? 0)} tone={severityTone((systemObservability?.goNoGo?.paymentDlqOpen ?? 0) + (systemObservability?.queues?.sendDlq?.lastKnownDlqTotal ?? 0), 1, 3)} helper="Pendências técnicas" />
            </div>
          </section>
        )}

        {tab === 'observabilidade' && admin && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="text-sm font-bold text-gray-800">Sessão admin</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">Role: {admin.role}</span>
              {admin.bootstrap && <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">Bootstrap via ADMIN_EMAILS</span>}
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">Permissões: {admin.permissions?.length ?? 0}</span>
            </div>
          </section>
        )}

        {tab === 'observabilidade' && overview && (
          <SecondarySection title="Métricas executivas completas" eyebrow="Secundário · recolhido por padrão">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(STAT_LABELS).map(([key, label]) => (
                <article key={key} className="rounded-2xl bg-gray-50 p-5 ring-1 ring-gray-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                  <p className="mt-2 text-3xl font-black text-gray-900">{statValue(key, overview[key])}</p>
                </article>
              ))}
            </div>
          </SecondarySection>
        )}




        {tab === 'observabilidade' && systemObservability && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Observabilidade · Fases C e D</p>
                <h2 className="text-lg font-black text-gray-900">Gate operacional de promoção</h2>
                <p className="text-sm text-gray-500">Resumo de alertas técnicos e recomendação GO/NO-GO para produção.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${systemObservability.goNoGo?.recommended === 'go' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {String(systemObservability.goNoGo?.recommended || 'no-go').toUpperCase()}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">DB</p><p className="text-xl font-black">{systemObservability.goNoGo?.dbOk ? 'OK' : 'Falha'}</p></div>
              <div className="rounded-xl bg-red-50 p-3"><p className="text-xs text-red-600">5xx</p><p className="text-xl font-black text-red-700">{systemObservability.api?.total5xx ?? 0}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-600">Payment DLQ</p><p className="text-xl font-black text-amber-700">{systemObservability.goNoGo?.paymentDlqOpen ?? 0}</p></div>
              <div className="rounded-xl bg-blue-50 p-3"><p className="text-xs text-blue-600">Uptime</p><p className="text-xl font-black text-blue-700">{Math.round((systemObservability.goNoGo?.uptimeSeconds ?? 0)/60)}m</p></div>
            </div>
            <div className="mt-4 space-y-2">
              {asArray(systemObservability.alerts).map((a, idx) => (
                <div key={`${a?.title ?? 'alerta'}-${idx}`} className="rounded-xl border border-gray-100 p-3 text-sm">
                  <p className="font-bold text-gray-900">{a?.title ?? 'Alerta'}</p>
                  <p className="text-gray-600">{String(a?.value ?? '')}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'observabilidade' && systemHealth && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Observabilidade · Etapa 5</p>
                <h2 className="text-lg font-black text-gray-900">Saúde técnica da plataforma</h2>
                <p className="text-sm text-gray-500">API, banco, latência, erros HTTP, memória e bots ativos no processo.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${systemHealth.status === 'ok' ? 'bg-green-100 text-green-700' : systemHealth.status === 'degraded' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>Status: {systemHealth.status}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Banco</p><p className="text-xl font-black">{systemHealth.dbOk ? 'OK' : 'Falha'}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Uptime</p><p className="text-xl font-black">{Math.round((systemHealth.uptimeSeconds ?? 0) / 60)}m</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Latência média</p><p className="text-xl font-black">{systemHealth.api?.avgLatencyMs ?? 0}ms</p></div>
              <div className="rounded-xl bg-red-50 p-3"><p className="text-xs text-red-600">5xx</p><p className="text-xl font-black text-red-700">{systemHealth.api?.total5xx ?? 0}</p></div>
              <div className="rounded-xl bg-blue-50 p-3"><p className="text-xs text-blue-600">Bots</p><p className="text-xl font-black text-blue-700">{systemHealth.counts?.runningBots ?? 0}</p></div>
              <div className="rounded-xl bg-purple-50 p-3"><p className="text-xs text-purple-600">Heap</p><p className="text-xl font-black text-purple-700">{systemHealth.memory?.heapUsedMb ?? 0}MB</p></div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-800">Rotas mais chamadas</h3>
                <div className="space-y-2">
                  {asArray(systemMetrics?.routes).slice(0, 6).map(route => (
                    <div key={`${route?.method ?? 'GET'}-${route?.route ?? 'rota'}`} className="rounded-xl border border-gray-100 p-3 text-xs text-gray-600">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-gray-900">{route?.method ?? '—'} {route?.route ?? '—'}</span>
                        <span>{route?.count ?? 0} req · {route?.avgMs ?? 0}ms méd.</span>
                      </div>
                      <p className="mt-1">4xx: {route?.status4xxCount ?? 0} · 5xx: {route?.status5xxCount ?? 0} · máx: {route?.maxMs ?? 0}ms</p>
                    </div>
                  ))}
                  {!asArray(systemMetrics?.routes).length && <p className="text-sm text-gray-400">Sem métricas de rota ainda.</p>}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-800">Erros recentes</h3>
                <div className="space-y-2">
                  {asArray(systemMetrics?.recentErrors).slice(0, 6).map((item, index) => (
                    <div key={`${item?.at ?? 'erro'}-${index}`} className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                      <p className="font-bold">{item?.statusCode ?? '—'} · {item?.method ?? '—'} {item?.route ?? '—'}</p>
                      <p>{item?.error || item?.url || 'Erro sem detalhes'} · {formatDate(item?.at)}</p>
                    </div>
                  ))}
                  {!asArray(systemMetrics?.recentErrors).length && <p className="text-sm text-gray-400">Sem erros 5xx recentes.</p>}
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === 'inicio' && (
          <SectionErrorBoundary label="Staging (liga/desliga)">
            <StagingPowerCard admin={admin} />
          </SectionErrorBoundary>
        )}

        {tab === 'sucesso' && gestaoClientesSection}

        {(tab === 'inicio' || tab === 'sucesso') && success && (
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
                      <p className="font-bold text-gray-900">{customer?.email ?? 'Cliente sem e-mail'}</p>
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

        {tab === 'financeiro' && finance && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Financeiro · Etapa 3</p>
                <h2 className="text-lg font-black text-gray-900">Assinaturas e pagamentos</h2>
                <p className="text-sm text-gray-500">MRR ativo, LTV, inadimplência, expirações e últimos pagamentos.</p>
              </div>
              <div className="flex items-center gap-2">
                {admin?.permissions?.includes('billing:write') && <button onClick={() => setManualPaymentOpen(true)} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700">+ Registrar pagamento por fora</button>}
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">MRR: {formatCurrency(finance.activeMrr)}</span>
              </div>
            </div>

            <div className="mb-4 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Receita bruta 30d</p>
                <p className="mt-1 text-2xl font-black text-emerald-800">{formatCurrency(finance.revenue30d)}</p>
                <p className="mt-1 text-[11px] text-emerald-600">{formatNumber(finance.approvedPayments30d)} pagamentos aprovados</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-4 ring-1 ring-orange-100">
                <p className="text-xs font-bold uppercase tracking-wide text-orange-600">(–) Comissões de afiliados</p>
                <p className="mt-1 text-2xl font-black text-orange-700">− {formatCurrency(finance.affiliateCommissions30d ?? 0)}</p>
                <p className="mt-1 text-[11px] text-orange-600">{formatNumber(finance.affiliateCommissions30dCount ?? 0)} comissões geradas nos 30d</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-4 ring-1 ring-rose-100">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-600">(–) Taxas Mercado Pago</p>
                <p className="mt-1 text-2xl font-black text-rose-700">− {formatCurrency(finance.mpFees30d ?? 0)}</p>
                <p className="mt-1 text-[11px] text-rose-600">{finance.mpFeePercent ?? 0}% do bruto{finance.mpFeeFixedCents ? ` + ${formatCurrency((finance.mpFeeFixedCents ?? 0) / 100)}/transação` : ''}</p>
              </div>
              <div className="rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">(=) Receita líquida 30d</p>
                <p className="mt-1 text-2xl font-black text-white">{formatCurrency(finance.netRevenue30d ?? finance.revenue30d)}</p>
                <p className="mt-1 text-[11px] text-slate-400">Após afiliados e taxas do Mercado Pago</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-rose-600">Taxa Mercado Pago</p><p className="text-xl font-black text-rose-700">{finance.mpFeePercent ?? 0}%</p><p className="text-[11px] text-rose-500">estimada · ajuste em MP_FEE_PERCENT</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">LTV médio</p><p className="text-xl font-black">{formatCurrency(finance.avgLtv)}</p></div>
              <div className="rounded-xl bg-orange-50 p-3"><p className="text-xs text-orange-600">Comissões a pagar</p><p className="text-xl font-black text-orange-700">{formatCurrency(finance.affiliateCommissionsPayable ?? 0)}</p><p className="text-[11px] text-orange-500">{formatNumber(finance.affiliateCommissionsPayableCount ?? 0)} em aberto</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-600">Pendentes</p><p className="text-xl font-black text-amber-700">{finance.pendingPayments}</p></div>
              <div className="rounded-xl bg-red-50 p-3"><p className="text-xs text-red-600">Pagos vencidos</p><p className="text-xl font-black text-red-700">{finance.overduePaid}</p></div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-800">Expirações próximas</h3>
                <div className="space-y-2">
                  {asArray(subscriptions?.subscriptions).map(subscription => (
                    <button key={subscription?.id ?? subscription?.email} onClick={() => openUserDetail(subscription?.id)} className="w-full rounded-xl border border-gray-100 p-3 text-left text-sm hover:bg-gray-50">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-gray-900">{subscription?.email ?? 'Cliente sem e-mail'}</p>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700">{subscription?.daysRemaining ?? '—'} dias</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{subscription?.plan ?? '—'} · LTV {formatCurrency(subscription?.ltv)} · expira {formatDate(subscription?.accessExpiresAt)}</p>
                    </button>
                  ))}
                  {!asArray(subscriptions?.subscriptions).length && <p className="text-sm text-gray-400">Sem assinaturas expirando no filtro atual.</p>}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-800">Pagamentos recentes</h3>
                <div className="space-y-2">
                  {asArray(payments?.payments).map(payment => (
                    <div key={payment?.id ?? `${payment?.user?.email}-${payment?.createdAt}`} className="rounded-xl border border-gray-100 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-gray-900">{payment?.user?.email ?? 'Cliente sem e-mail'}</p>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${payment?.status === 'approved' ? 'bg-green-100 text-green-700' : payment?.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{payment?.status ?? '—'}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{payment?.plan ?? '—'} · {formatCurrency(payment?.amount)} · {formatDate(payment?.createdAt)}{payment?.provider === 'manual' ? ` · Por fora (${payment.paymentMethod || 'outro'})` : ''}</p>
                    </div>
                  ))}
                  {!payments?.payments?.length && <p className="text-sm text-gray-400">Sem pagamentos no período.</p>}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-gray-800">Pagos vencidos ({formatNumber(overduePaidList?.total ?? finance.overduePaid ?? 0)})</h3>
              <p className="mb-2 text-xs text-gray-500">Plano pago, conta ainda ativa, acesso já vencido — cobrar renovação.</p>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-bold">Cliente</th>
                      <th className="px-3 py-2 font-bold">Plano</th>
                      <th className="px-3 py-2 font-bold">Cobrança</th>
                      <th className="px-3 py-2 font-bold">Venceu em</th>
                      <th className="px-3 py-2 font-bold">Total pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {asArray(overduePaidList?.subscriptions).map(customer => (
                      <tr key={customer.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openUserDetail(customer.id)}>
                        <td className="px-3 py-2"><span className="font-bold text-gray-900">{customer.email}</span></td>
                        <td className="px-3 py-2 text-gray-600">{customer.plan}</td>
                        <td className="px-3 py-2"><BillingKindBadge customer={customer} /></td>
                        <td className="px-3 py-2 text-red-700 font-semibold">{formatDate(customer.accessExpiresAt)}</td>
                        <td className="px-3 py-2 text-gray-600">{formatCurrency(customer.ltv)}</td>
                      </tr>
                    ))}
                    {overduePaidList && !asArray(overduePaidList?.subscriptions).length && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Nenhum cliente pago com acesso vencido agora.</td></tr>
                    )}
                    {!overduePaidList && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Carregando…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-gray-800">Todos que já pagaram ({formatNumber(paidCustomersList?.total ?? 0)})</h3>
              <p className="mb-2 text-xs text-gray-500">Todo cliente com ao menos um pagamento aprovado, avulso ou recorrente, em qualquer situação atual.</p>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-bold">Cliente</th>
                      <th className="px-3 py-2 font-bold">Plano atual</th>
                      <th className="px-3 py-2 font-bold">Cobrança</th>
                      <th className="px-3 py-2 font-bold">Último pagamento</th>
                      <th className="px-3 py-2 font-bold">Vence em</th>
                      <th className="px-3 py-2 font-bold">Próxima cobrança / cancelou</th>
                      <th className="px-3 py-2 font-bold">Pagamentos</th>
                      <th className="px-3 py-2 font-bold">Total pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {asArray(paidCustomersList?.subscriptions).map(customer => {
                      const sub = customer.recurringSubscription
                      const isExpired = customer.accessExpiresAt && new Date(customer.accessExpiresAt) < new Date()
                      return (
                        <tr key={customer.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openUserDetail(customer.id)}>
                          <td className="px-3 py-2"><span className="font-bold text-gray-900">{customer.email}</span></td>
                          <td className="px-3 py-2 text-gray-600">{customer.plan}</td>
                          <td className="px-3 py-2"><BillingKindBadge customer={customer} /></td>
                          <td className="px-3 py-2 text-gray-600">{formatDate(customer.lastPayment?.createdAt)}</td>
                          <td className={`px-3 py-2 font-semibold ${isExpired ? 'text-red-700' : 'text-gray-700'}`}>{formatDate(customer.accessExpiresAt)}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {sub?.cancelledAt
                              ? `Cancelou ${formatDate(sub.cancelledAt)}`
                              : sub?.autoRenew
                                ? `Cobra ${formatDate(sub.nextChargeAt)}`
                                : '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{formatNumber(customer.paidCount)}</td>
                          <td className="px-3 py-2 text-gray-600">{formatCurrency(customer.ltv)}</td>
                        </tr>
                      )
                    })}
                    {paidCustomersList && !asArray(paidCustomersList?.subscriptions).length && (
                      <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Ninguém pagou ainda.</td></tr>
                    )}
                    {!paidCustomersList && (
                      <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Carregando…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {manualPaymentOpen && <ManualPaymentModal onClose={() => setManualPaymentOpen(false)} onSaved={manualPaymentSaved} />}

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
                          <p className="font-bold text-gray-900">{user?.name || user?.email || 'Cliente sem e-mail'}</p>
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
                        <td className="px-3 py-3 font-mono text-xs font-bold text-gray-500">{a?.code ?? '—'}</td>
                        <td className="px-3 py-3"><p className="font-bold text-gray-900">{a?.user?.name ?? '—'}</p><p className="text-xs text-gray-500">{a?.user?.email ?? '—'}</p></td>
                        <td className="px-3 py-3 text-sm">{formatNumber(a?.totalReferrals ?? 0)}</td>
                        <td className="px-3 py-3 text-sm font-bold">{centsToBRL(a?.totalCommissions ?? 0)}</td>
                        <td className="px-3 py-3 font-mono text-xs text-gray-500">{a?.pixKey ?? '—'}</td>
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

        {tab === 'observabilidade' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-lg font-black text-gray-900">Sessões WhatsApp</h2>
            <div className="space-y-3">
              {asArray(sessions?.sessions).map(session => (
                <div key={session?.id ?? session?.user?.email} className="rounded-xl border border-gray-100 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-gray-900">{session?.user?.email ?? 'Cliente sem e-mail'}</p>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${session?.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{session?.status ?? '—'}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Bot: {session?.botRunning ? 'rodando' : 'parado'} · Atualizado: {formatDate(session?.updatedAt)}</p>
                </div>
              ))}

              {!asArray(sessions?.sessions).length && <p className="text-sm text-gray-400">Sem sessões.</p>}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Telemetria de conexão WhatsApp</h3>
              <span className="text-xs text-gray-500">Últimos {sessionTelemetry?.total ?? 0} eventos</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">{Object.entries(asPlainObject(sessionTelemetry?.summary)).slice(0, 8).map(([key, count]) => <span key={key} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{key}: {count}</span>)}</div>
            <div className="space-y-2">{asArray(sessionTelemetry?.events).slice(0, 12).map((evt) => <div key={evt?.id ?? `${evt?.userId ?? 'evento'}-${evt?.createdAt ?? 'sem-data'}`} className="rounded-lg border border-gray-100 p-2 text-xs text-gray-700"><p className="font-semibold">{evt?.user?.email || evt?.userId || 'usuário'} · {evt?.stage || 'unknown'} / {evt?.event || 'unknown'}</p><p className="text-gray-500">{formatDate(evt?.createdAt)}{evt?.elapsedSec != null ? ` · ${evt?.elapsedSec}s` : ''}{evt?.detail ? ` · ${evt?.detail}` : ''}</p></div>)}{!asArray(sessionTelemetry?.events).length && <p className="text-sm text-gray-400">Sem telemetria recente.</p>}</div>
          </section>

          <ErrorVolumeCard summary={logsSummary24h} />

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-gray-900">Logs recentes</h2><p className="text-xs text-gray-500">Últimos {logs?.logs?.length ?? 0} registros carregados de {logs?.total ?? 0} no período.</p></div><button onClick={applyFilters} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200">Atualizar agora</button></div>
            <div className="space-y-3">
              {asArray(logs?.logs).map(log => (
                <div key={log?.id ?? `${log?.user?.email}-${log?.sentAt}`} className="rounded-xl border border-gray-100 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-gray-900">{log?.user?.email ?? 'Cliente sem e-mail'}</p>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${log?.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{log?.status ?? '—'}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{log?.platform ?? '—'} · {formatDate(log?.sentAt)} · Destino: {log?.destGroup || '—'}</p>
                  {log?.messageText && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{log?.messageText}</p>}
                  {log?.errorMsg && <p className="mt-1 text-xs text-red-500">{log?.errorMsg}</p>}
                </div>
              ))}
              {!logs?.logs?.length && <p className="text-sm text-gray-400">Sem logs.</p>}
            </div>
          </section>
        </div>
        )}

        {tab === 'config' && (
          <>
            <TermsEditor key={`terms-${terms?.version ?? 'fallback'}`} terms={terms} onSave={saveLegalTerms} />
            <LandingPageContentAccordion plans={plans} faq={faq} tutorial={tutorial} onSavePlan={saveLpPlan} onSaveFaq={saveFaqItem} onDeleteFaq={deleteFaqItem} onSaveTutorial={saveTutorialContent} />
            <AdminTutorialAccordion tutorial={tutorial} onSaveTutorial={saveTutorialContent} TutorialEditor={TutorialEditor} />
          </>
        )}
      </div>
    </main>
  )
}
