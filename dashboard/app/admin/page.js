'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import SectionErrorBoundary from '@/components/SectionErrorBoundary'
import { PayingTag } from '@/components/PayingTag'
import { HelpDot } from '@/components/HelpDot'
import { CARD_HELP } from '@/lib/admin/cardHelp'


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

const TABS = [
  ['inicio', 'Início'],
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
  const router = useRouter()
  const [overview, setOverview] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [users, setUsers] = useState(null)
  const [systemMetrics, setSystemMetrics] = useState(null)
  const [systemObservability, setSystemObservability] = useState(null)
  const [online, setOnline] = useState(null)
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
  // Conta vencida há muito tempo fica fora da visão por padrão — polui e
  // esconde o que precisa de decisão hoje. "Ver mais" traz de volta.
  const [verVencidasAntigas, setVerVencidasAntigas] = useState(false)
  // Drill-down dos cards técnicos ('infra' | 'filas' | null). Não busca nada
  // novo: mostra o detalhe do que a página já carregou.
  const [techDrilldown, setTechDrilldown] = useState(null)
  // Qualidade de imagem das ofertas (48h). Era a página /admin/ofertas; virou
  // card no Início a pedido da dona do produto (2026-09-05) — a pergunta "as
  // ofertas estão saindo com foto?" é de olhar todo dia, e página separada é
  // página que ninguém abre.
  const [entrega, setEntrega] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)

  function currentMonth() {
    return new Date().toISOString().slice(0, 7)
  }

  async function reloadAffiliates() {
    const [a, c, f] = await Promise.all([
      api.adminAffiliates({ status: 'approved', limit: 100 }).catch(() => null),
      api.adminAffiliateCommissions({ month: currentMonth() }).catch(() => null),
      api.adminFinanceOverview().catch(() => null),
    ])
    setAffiliates(a)
    setCommissions(c)
    setFinance(f)
  }

  // Afiliados só carrega quando a aba abre: o boot do Início fica nas 7 consultas
  // que o semáforo e a Gestão de clientes realmente mostram.
  function openTab(key) {
    setTab(key)
    if (key === 'afiliados' && !affiliates) reloadAffiliates()
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

  // As 6 consultas do corpo do Início (a 7ª, adminMe, é o porteiro do boot).
  // O resumo da frota (`online`) alimenta só os cards do semáforo; a lista de
  // quem está caído mora em /admin/hoje e na ficha do cliente.
  function fetchPainel(nextRisk, nextSearch, nextVerVencidas) {
    return Promise.all([
      api.adminOverview(),
      api.adminUsers({ risk: nextRisk, search: nextSearch, limit: 20, incluirVencidos: nextVerVencidas ? 1 : '' }),
      api.adminSystemMetrics().catch(() => null),
      api.adminSystemObservability().catch(() => null),
      api.adminOnline({ limit: 1 }).catch(() => null),
      api.adminQualidadeEntrega(48).catch(() => null),
    ])
  }

  function aplicarPainel([overviewData, usersData, systemMetricsData, systemObservabilityData, onlineData, entregaData]) {
    setOverview(overviewData)
    setUsers(usersData)
    setSystemMetrics(systemMetricsData)
    setSystemObservability(systemObservabilityData)
    setOnline(onlineData)
    setEntrega(entregaData)
    setLoadedAt(new Date())
  }

  async function loadAdminData(nextRisk = risk, nextSearch = search, nextVerVencidas = verVencidasAntigas) {
    if (accessDenied) return
    setError('')
    aplicarPainel(await fetchPainel(nextRisk, nextSearch, nextVerVencidas))
  }

  useEffect(() => {
    let active = true
    api.adminMe()
      .then(async (adminData) => {
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
                    <Link href={`/admin/clientes/${user?.id}`} className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-700 hover:bg-emerald-100">Abrir ficha</Link>
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
                <button key={key} onClick={() => openTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === key ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{label}</button>
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

        {tab === 'inicio' && (overview || systemObservability || online) && (
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
                onClick={() => router.push('/admin/hoje?motivo=robo')}
                actionLabel="Ver na caixa Hoje →"
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
                onClick={() => router.push('/admin/hoje?motivo=cega')}
                actionLabel="Ver na caixa Hoje →"
              />
              <ScenarioCard
                label="Caindo demais"
                value={formatNumber(online?.summary?.scenarios?.caindoDemais ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.caindoDemais ?? 0, 1, 3)}
                helper={`acima de ${formatNumber(online?.summary?.scenarios?.dropsAlertThreshold ?? 20)} quedas em 24h`}
                help={CARD_HELP.caindoDemais}
              />
              <ScenarioCard
                label="Cliente teve que agir"
                value={formatNumber(online?.summary?.scenarios?.clienteAgiu ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.clienteAgiu ?? 0, 1, 2)}
                helper={`${formatDurationMs(online?.summary?.scenarios?.manualOfflineMs24h)} parados até agir`}
                help={CARD_HELP.clienteAgiu}
              />
              <ScenarioCard
                label="Fonte dessincronizada"
                value={formatNumber(online?.summary?.scenarios?.fonteQuebrada ?? 0)}
                tone={severityTone(online?.summary?.scenarios?.fonteQuebrada ?? 0, 1, 5)}
                helper="conserto automático não resolveu (7d)"
                help={CARD_HELP.fonteQuebrada}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <CommandCard
                label="Online agora"
                value={online?.summary?.onlineUsers ?? '—'}
                tone={severityTone(0)}
                helper={`${online?.summary?.stabilityPct ?? '—'}% estabilidade`}
                help={CARD_HELP.onlineAgora}
              />
              <CommandCard
                label="Pagantes atuais"
                value={online?.summary?.currentPayingUsers ?? '—'}
                tone="ok"
                helper="com acesso pago ainda válido"
                help="Clientes que já pagaram (avulso ou assinatura) e cujo acesso ainda não venceu. Cortesia e liberação manual não contam."
              />
              <CommandCard
                label="Pagantes online"
                value={online?.summary?.payingUsersOnline ?? '—'}
                tone="ok"
                helper="pagando e conectados agora"
                help="Pagantes atuais com o WhatsApp conectado neste momento."
              />
              <CommandCard
                label="Erros 24h"
                value={overview?.errors24h ?? 0}
                tone={severityTone(overview?.errors24h, 1, 10)}
                helper="Acima de 10 = crítico"
                help={CARD_HELP.erros24h}
                onClick={() => router.push('/admin/erros')}
                actionLabel="Ver os erros →"
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


        {tab === 'inicio' && gestaoClientesSection}

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
