'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import AdminTutorialAccordion from '@/components/AdminTutorialAccordion'

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
const CS_ALLOWED_EMAILS = ['flavia.vale@usp.br', 'flaviaroberta.1496@gmail.com', 'tacianeaas02@gmail.com']
const CS_PERMISSION_KEYS = ['customer_success', 'customer_success_ops', 'success']
const resolveAdminEmail = (admin) => String(admin?.email || admin?.user?.email || admin?.profile?.email || '').toLowerCase().trim()

const SUCCESS_REASON_LABELS = {
  missing_phone: 'Sem celular',
  paid_stale_48h: 'Pago parado 48h',
  wa_disconnected: 'WhatsApp desconectado',
  no_first_success: 'Sem primeiro sucesso',
  onboarding_incomplete: 'Onboarding incompleto',
  expiring_soon: 'Expira em 7 dias',
  high_errors_24h: 'Muitos erros 24h',
}

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
          <p className="text-sm text-gray-600">Expiração: {formatDate(detail.accessExpiresAt)}</p>
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
        {(faq?.items ?? []).map(item => (
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
    body: `Para que o BOTinho trabalhe para você, precisamos conectar suas contas de afiliado.\n\n🛠️ Passo 0 — Ferramenta Essencial\n1. Instale a extensão Cookie-Editor no Google Chrome (computador).\n2. Abra a Chrome Web Store e clique em “Usar no Chrome”.\n\n🔵 Mercado Livre — Como conseguir credenciais\n1. Faça login na sua conta de afiliado.\n2. Acesse o Gerador de Links: https://www.mercadolivre.com.br/afiliados/linkbuilder#hub\n3. Copie o ID exibido no campo de identificação.\n4. Clique na extensão Cookie-Editor e localize o cookie “ssid”.\n5. Copie o valor do “ssid” e salve no BOTinho.\n\n🟡 Amazon — Como conseguir credenciais\n1. Acesse https://associados.amazon.com.br/\n2. Com a página aberta, clique no Cookie-Editor.\n3. Copie os cookies solicitados pelo BOTinho.\n\n🟠 Shopee — Solicitação de API\n1. Acesse o formulário: https://help.shopee.com.br/portal/webform/bbce78695c364ba18c9cbceb74ec9091?entryPoint=1&lastArticleID=\n2. Respostas: AFILIADO > Dúvidas sobre o Programa de Afiliados > Próximo > SIM > Não, estou com outras dificuldades/dúvidas.\n3. Informe seu ID de afiliado e selecione tema/cenário para ativar API.\n4. Envie e acompanhe diariamente: https://affiliate.shopee.com.br/open_api\n\n⏳ E agora?\nApós a liberação da Shopee, clique em “Redefinir” para visualizar Key/Secret e colar no BOTinho.`,
    images: [
      { id: 'print-1', label: 'PRINT 1 — Cookie-Editor', url: '', note: 'Destaque o botão “Usar no Chrome”.' },
      { id: 'print-2', label: 'PRINT 2 — Mercado Livre ID', url: '', note: 'Destaque o número do ID.' },
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
              {(plans ?? []).map(plan => <PlanEditor key={`${plan.id}-${plan.updatedAt ?? ''}`} plan={plan} onSave={onSavePlan} />)}
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

export default function AdminPage() {
  const [overview, setOverview] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [users, setUsers] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [sessionTelemetry, setSessionTelemetry] = useState(null)
  const [logs, setLogs] = useState(null)
  const [finance, setFinance] = useState(null)
  const [payments, setPayments] = useState(null)
  const [subscriptions, setSubscriptions] = useState(null)
  const [success, setSuccess] = useState(null)
  const [successQueue, setSuccessQueue] = useState(null)
  const [systemHealth, setSystemHealth] = useState(null)
  const [systemMetrics, setSystemMetrics] = useState(null)
  const [faq, setFaq] = useState(null)
  const [plans, setPlans] = useState([])
  const [tutorial, setTutorial] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [risk, setRisk] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadAdminData(nextRisk = risk, nextSearch = search) {
    setError('')
    const [adminData, overviewData, usersData, sessionsData, sessionTelemetryData, logsData, financeData, paymentsData, subscriptionsData, successData, successQueueData, systemHealthData, systemMetricsData, lpContentData] = await Promise.all([
      api.adminMe(),
      api.adminOverview(),
      api.adminUsers({ risk: nextRisk, search: nextSearch, limit: 20 }),
      api.adminSessions({ limit: 10 }),
      api.adminSessionTelemetry({ limit: 60 }).catch(() => null),
      api.adminLogs({ limit: 10, status: 'all' }),
      api.adminFinanceOverview().catch(() => null),
      api.adminPayments({ limit: 10 }).catch(() => null),
      api.adminSubscriptions({ limit: 10, status: 'expiring_soon' }).catch(() => null),
      api.adminSuccessOverview().catch(() => null),
      api.adminSuccessQueue({ limit: 8 }).catch(() => null),
      api.adminSystemHealth().catch(() => null),
      api.adminSystemMetrics().catch(() => null),
      api.adminLpContent().catch(() => null),
    ])
    setAdmin(adminData)
    setOverview(overviewData)
    setUsers(usersData)
    setSessions(sessionsData)
    setSessionTelemetry(sessionTelemetryData)
    setLogs(logsData)
    setFinance(financeData)
    setPayments(paymentsData)
    setSubscriptions(subscriptionsData)
    setSuccess(successData)
    setSuccessQueue(successQueueData)
    setSystemHealth(systemHealthData)
    setSystemMetrics(systemMetricsData)
    setFaq(lpContentData?.faq ?? null)
    setPlans(lpContentData?.plans ?? [])
    setTutorial(lpContentData?.tutorial ?? null)
  }

  useEffect(() => {
    let active = true
    Promise.all([
      api.adminMe(),
      api.adminOverview(),
      api.adminUsers({ limit: 20 }),
      api.adminSessions({ limit: 10 }),
      api.adminSessionTelemetry({ limit: 60 }).catch(() => null),
      api.adminLogs({ limit: 10, status: 'all' }),
      api.adminFinanceOverview().catch(() => null),
      api.adminPayments({ limit: 10 }).catch(() => null),
      api.adminSubscriptions({ limit: 10, status: 'expiring_soon' }).catch(() => null),
      api.adminSuccessOverview().catch(() => null),
      api.adminSuccessQueue({ limit: 8 }).catch(() => null),
      api.adminSystemHealth().catch(() => null),
      api.adminSystemMetrics().catch(() => null),
      api.adminLpContent().catch(() => null),
    ])
      .then(([adminData, overviewData, usersData, sessionsData, sessionTelemetryData, logsData, financeData, paymentsData, subscriptionsData, successData, successQueueData, systemHealthData, systemMetricsData, lpContentData]) => {
        if (!active) return
        setAdmin(adminData)
        setOverview(overviewData)
        setUsers(usersData)
        setSessions(sessionsData)
        setSessionTelemetry(sessionTelemetryData)
        setLogs(logsData)
        setFinance(financeData)
        setPayments(paymentsData)
        setSubscriptions(subscriptionsData)
        setSuccess(successData)
        setSuccessQueue(successQueueData)
        setSystemHealth(systemHealthData)
        setSystemMetrics(systemMetricsData)
        setFaq(lpContentData?.faq ?? null)
        setPlans(lpContentData?.plans ?? [])
        setTutorial(lpContentData?.tutorial ?? null)
      })
      .catch((err) => { if (active) setError(err.message || 'Não foi possível carregar o painel admin.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const atRiskUsers = useMemo(() => users?.users?.filter(user => user.riskFlags?.length) ?? [], [users])
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

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Visão operacional · Etapa 2</p>
            <h1 className="text-3xl font-black text-gray-900">Admin BOTinho</h1>
            <p className="mt-1 text-sm text-gray-500">Cockpit executivo, clientes em risco, sessões, logs e drill-down operacional.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => applyFilters()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Atualizar</button>
            {canAccessCustomerSuccess && <Link href="/admin/sucesso-cliente" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Aba CS</Link>}
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




        {systemHealth && (
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
                  {(systemMetrics?.routes ?? []).slice(0, 6).map(route => (
                    <div key={`${route.method}-${route.route}`} className="rounded-xl border border-gray-100 p-3 text-xs text-gray-600">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-gray-900">{route.method} {route.route}</span>
                        <span>{route.count} req · {route.avgMs}ms méd.</span>
                      </div>
                      <p className="mt-1">4xx: {route.status4xxCount} · 5xx: {route.status5xxCount} · máx: {route.maxMs}ms</p>
                    </div>
                  ))}
                  {!systemMetrics?.routes?.length && <p className="text-sm text-gray-400">Sem métricas de rota ainda.</p>}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-800">Erros recentes</h3>
                <div className="space-y-2">
                  {(systemMetrics?.recentErrors ?? []).slice(0, 6).map((item, index) => (
                    <div key={`${item.at}-${index}`} className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                      <p className="font-bold">{item.statusCode} · {item.method} {item.route}</p>
                      <p>{item.error || item.url} · {formatDate(item.at)}</p>
                    </div>
                  ))}
                  {!systemMetrics?.recentErrors?.length && <p className="text-sm text-gray-400">Sem erros 5xx recentes.</p>}
                </div>
              </div>
            </div>
          </section>
        )}

        {success && (
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
              {(successQueue?.queue ?? []).map(customer => (
                <div key={customer.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{customer.email}</p>
                      <p className="text-xs text-gray-500">{customer.contactPhone || 'Sem celular'} · {customer.plan} · último contato {formatDate(customer.lastSupportContactAt)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {customer.contactReasons.map(reason => (
                          <span key={reason} className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700">{SUCCESS_REASON_LABELS[reason] ?? reason}</span>
                        ))}
                      </div>
                      {customer.lastContact?.notes && <p className="mt-2 text-xs text-gray-500">Último registro: {customer.lastContact.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openUserDetail(customer.id)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Drill-down</button>
                      <button onClick={() => recordContact(customer)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">Registrar contato</button>
                    </div>
                  </div>
                </div>
              ))}
              {!successQueue?.queue?.length && <p className="text-sm text-gray-400">Nenhum cliente na fila proativa agora.</p>}
            </div>
          </section>
        )}

        {finance && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Financeiro · Etapa 3</p>
                <h2 className="text-lg font-black text-gray-900">Assinaturas e pagamentos</h2>
                <p className="text-sm text-gray-500">MRR ativo, LTV, inadimplência, expirações e últimos pagamentos.</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">MRR: {formatCurrency(finance.activeMrr)}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Receita 30d</p><p className="text-xl font-black">{formatCurrency(finance.revenue30d)}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">LTV médio</p><p className="text-xl font-black">{formatCurrency(finance.avgLtv)}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-600">Pendentes</p><p className="text-xl font-black text-amber-700">{finance.pendingPayments}</p></div>
              <div className="rounded-xl bg-red-50 p-3"><p className="text-xs text-red-600">Pagos vencidos</p><p className="text-xl font-black text-red-700">{finance.overduePaid}</p></div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-800">Expirações próximas</h3>
                <div className="space-y-2">
                  {(subscriptions?.subscriptions ?? []).map(subscription => (
                    <button key={subscription.id} onClick={() => openUserDetail(subscription.id)} className="w-full rounded-xl border border-gray-100 p-3 text-left text-sm hover:bg-gray-50">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-gray-900">{subscription.email}</p>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700">{subscription.daysRemaining ?? '—'} dias</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{subscription.plan} · LTV {formatCurrency(subscription.ltv)} · expira {formatDate(subscription.accessExpiresAt)}</p>
                    </button>
                  ))}
                  {!subscriptions?.subscriptions?.length && <p className="text-sm text-gray-400">Sem assinaturas expirando no filtro atual.</p>}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-800">Pagamentos recentes</h3>
                <div className="space-y-2">
                  {(payments?.payments ?? []).map(payment => (
                    <div key={payment.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-gray-900">{payment.user?.email}</p>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${payment.status === 'approved' ? 'bg-green-100 text-green-700' : payment.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{payment.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{payment.plan} · {formatCurrency(payment.amount)} · {formatDate(payment.createdAt)}</p>
                    </div>
                  ))}
                  {!payments?.payments?.length && <p className="text-sm text-gray-400">Sem pagamentos no período.</p>}
                </div>
              </div>
            </div>
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
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Telemetria de conexão WhatsApp</h3>
              <span className="text-xs text-gray-500">Últimos {sessionTelemetry?.total ?? 0} eventos</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">{Object.entries(sessionTelemetry?.summary || {}).slice(0, 8).map(([key, count]) => <span key={key} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{key}: {count}</span>)}</div>
            <div className="space-y-2">{(sessionTelemetry?.events || []).slice(0, 12).map((evt) => <div key={evt.id} className="rounded-lg border border-gray-100 p-2 text-xs text-gray-700"><p className="font-semibold">{evt.user?.email || evt.userId || 'usuário'} · {evt.stage || 'unknown'} / {evt.event || 'unknown'}</p><p className="text-gray-500">{formatDate(evt.createdAt)}{evt.elapsedSec != null ? ` · ${evt.elapsedSec}s` : ''}{evt.detail ? ` · ${evt.detail}` : ''}</p></div>)}{!sessionTelemetry?.events?.length && <p className="text-sm text-gray-400">Sem telemetria recente.</p>}</div>
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

        <LandingPageContentAccordion plans={plans} faq={faq} tutorial={tutorial} onSavePlan={saveLpPlan} onSaveFaq={saveFaqItem} onDeleteFaq={deleteFaqItem} onSaveTutorial={saveTutorialContent} />
        <AdminTutorialAccordion tutorial={tutorial} onSaveTutorial={saveTutorialContent} TutorialEditor={TutorialEditor} />
      </div>
    </main>
  )
}
