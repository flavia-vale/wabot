'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import AdminTutorialAccordion from '@/components/AdminTutorialAccordion'
import SectionErrorBoundary from '@/components/SectionErrorBoundary'
import { HelpDot } from '@/components/HelpDot'
import { CARD_HELP } from '@/lib/admin/cardHelp'
import FilasSection from '@/components/FilasSection'
import AuditoriaSection from '@/components/AuditoriaSection'

// Página "Operação" (G2 da auditoria do painel, 2026-10-02). Junta o que era a
// aba oculta "Observabilidade (técnico)", o card de staging e a aba
// "Configurações" (planos da LP, FAQ, termos, tutorial) do Início. Uso raro,
// perfil técnico — por isso saiu da tela que a dona abre todo dia.

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

const asArray = (value) => Array.isArray(value) ? value : []
const asPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}

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

// Feature 017, Fatia 6 (T080): estado do robô único do Telegram. Busca o
// próprio dado para não mexer no carregamento do resto do painel.
const ROBO_ESTADO_TOM = {
  funcionando: 'bg-green-100 text-green-700',
  limitado: 'bg-amber-100 text-amber-700',
  bloqueado: 'bg-red-100 text-red-700',
  indisponivel: 'bg-red-100 text-red-700',
  sem_medicao: 'bg-gray-100 text-gray-600',
  desligado: 'bg-gray-100 text-gray-600',
}
const ROBO_ESTADO_TEXTO = {
  funcionando: 'funcionando',
  limitado: 'limitado no ritmo',
  bloqueado: 'bloqueado',
  indisponivel: 'fora do ar',
  sem_medicao: 'sem medição',
  desligado: 'desligado',
}

function DeliveryNetworkHealthCard() {
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    api.adminDeliveryNetworksHealth().then((r) => { if (alive) setData(r) }).catch(() => { if (alive) setData({ aplicativos: [] }) })
    return () => { alive = false }
  }, [])
  const apps = asArray(data?.aplicativos)
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-bold text-gray-800">Robô do Telegram</h3>
        <HelpDot {...CARD_HELP.roboTelegram} />
      </div>
      {data === null && <p className="text-sm text-gray-400">Carregando…</p>}
      {apps.map((app) => (
        <div key={app.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full px-2 py-1 text-xs font-bold ${ROBO_ESTADO_TOM[app.estado] ?? ROBO_ESTADO_TOM.sem_medicao}`}>{ROBO_ESTADO_TEXTO[app.estado] ?? app.estado}</span>
          <span className="text-gray-600">{app.motivo}</span>
          {app.desde && <span className="text-xs text-gray-400">desde {formatDate(app.desde)}</span>}
          {app.pendentes != null && <span className="text-xs text-gray-500">· {formatNumber(app.pendentes)} oferta(s) esperando</span>}
        </div>
      ))}
    </section>
  )
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
                  <p className="break-words text-xs font-bold text-slate-100">{item?.errorMsg || 'unknown'}</p>
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


// Botão "Ver mais": conta vencida há muito tempo fica fora da visão por
// padrão. Some da TELA, não do sistema — e o botão diz quantas são, para
// ninguém achar que o número sumiu.

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
    title: 'Guia de Configuração: Pegando suas Credenciais (Espelha Grupos)',
    body: `Para que o Espelha Grupos trabalhe para você, precisamos conectar suas contas de afiliado.\n\n🛠️ Passo 0 — Ferramenta Essencial\n1. Instale a extensão Cookie-Editor no Google Chrome (computador).\n2. Abra a Chrome Web Store e clique em “Usar no Chrome”.\n\n🔵 Mercado Livre — Como conseguir credenciais\n1. Faça login na sua conta de afiliado.\n2. Acesse o Gerador de Links: https://www.mercadolivre.com.br/afiliados/linkbuilder#hub\n3. Copie a Etiqueta em uso exibida no Gerador de Links.\n4. Clique na extensão Cookie-Editor e localize o cookie “ssid”.\n5. Copie o valor do “ssid” e salve no Espelha Grupos.\n\n🟡 Amazon — Como conseguir credenciais\n1. Acesse https://associados.amazon.com.br/\n2. Com a página aberta, clique no Cookie-Editor.\n3. Copie os cookies solicitados pelo Espelha Grupos.\n\n🟠 Shopee — Solicitação de API\n1. Acesse o formulário: https://help.shopee.com.br/portal/webform/bbce78695c364ba18c9cbceb74ec9091?entryPoint=1&lastArticleID=\n2. Respostas: AFILIADO > Dúvidas sobre o Programa de Afiliados > Próximo > SIM > Não, estou com outras dificuldades/dúvidas.\n3. Informe seu ID de afiliado e selecione tema/cenário para ativar API.\n4. Envie e acompanhe diariamente: https://affiliate.shopee.com.br/open_api\n\n⏳ E agora?\nApós a liberação da Shopee, clique em “Redefinir” para visualizar Key/Secret e colar no Espelha Grupos.`,
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
      <textarea value={imagesText} onChange={(e) => setImagesText(e.target.value)} placeholder='[{"id":"print1","label":"PRINT 1","url":"https://...","note":"..."}]' className="min-h-32 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-400" />
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

export default function OperacaoPage() {
  const [admin, setAdmin] = useState(null)
  const [overview, setOverview] = useState(null)
  const [systemObservability, setSystemObservability] = useState(null)
  const [systemHealth, setSystemHealth] = useState(null)
  const [systemMetrics, setSystemMetrics] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [sessionTelemetry, setSessionTelemetry] = useState(null)
  const [logs, setLogs] = useState(null)
  const [logsSummary24h, setLogsSummary24h] = useState(null)
  const [faq, setFaq] = useState(null)
  const [plans, setPlans] = useState([])
  const [tutorial, setTutorial] = useState(null)
  const [terms, setTerms] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function carregar() {
    const [adminData, overviewData, systemObservabilityData, systemHealthData, systemMetricsData, sessionsData, sessionTelemetryData, logsData, logsSummary24hData, lpContentData, termsData] = await Promise.all([
      api.adminMe(),
      api.adminOverview().catch(() => null),
      api.adminSystemObservability().catch(() => null),
      api.adminSystemHealth().catch(() => null),
      api.adminSystemMetrics().catch(() => null),
      api.adminSessions({ limit: 10 }).catch(() => null),
      api.adminSessionTelemetry({ limit: 60 }).catch(() => null),
      api.adminLogs({ limit: 25, status: 'all' }).catch(() => null),
      api.adminLogsSummary('24h', { topErrors: 50 }).catch(() => null),
      api.adminLpContent().catch(() => null),
      api.adminLegalTerms().catch(() => null),
    ])
    setError('')
    setAdmin(adminData)
    setOverview(overviewData)
    setSystemObservability(systemObservabilityData)
    setSystemHealth(systemHealthData)
    setSystemMetrics(systemMetricsData)
    setSessions(sessionsData)
    setSessionTelemetry(sessionTelemetryData)
    setLogs(logsData)
    setLogsSummary24h(logsSummary24hData)
    setFaq(lpContentData?.faq ?? null)
    setPlans(lpContentData?.plans ?? [])
    setTutorial(lpContentData?.tutorial ?? null)
    setTerms(termsData?.terms ?? null)
  }

  useEffect(() => {
    let active = true
    // Chamada dentro de um callback, não no corpo do effect: a regra
    // react-hooks/set-state-in-effect do lint do dashboard barra setState síncrono ali.
    Promise.resolve().then(() => carregar())
      .catch((err) => { if (active) setError(err.message || 'Não foi possível carregar a Operação.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function applyFilters() {
    carregar().catch((err) => setError(err.message || 'Falha ao atualizar.'))
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

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-gray-900">Operação</span>
              <span className="text-xs font-semibold text-gray-400">saúde técnica, staging, conteúdo do site</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin/capacidade" className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100">Capacidade</Link>
              <Link href="/admin/erros" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Erros</Link>
              <Link href="/admin/observabilidade" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">Filas e DLQ</Link>
              <button onClick={applyFilters} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Atualizar</button>
              <Link href="/admin" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Início</Link>
            </div>
          </div>
        </div>

        {error && <Alert type="error" title="Operação" message={error} />}

        <SectionErrorBoundary label="Filas (envios presos)">
          <FilasSection admin={admin} />
        </SectionErrorBoundary>

        <SectionErrorBoundary label="Auditoria (quem fez o quê)">
          <AuditoriaSection admin={admin} />
        </SectionErrorBoundary>

        <SectionErrorBoundary label="Staging (liga/desliga)">
          <StagingPowerCard admin={admin} />
        </SectionErrorBoundary>

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


        {systemObservability && (
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

        {(
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

          <DeliveryNetworkHealthCard />

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

        <SecondarySection title="Conteúdo e modelos do site" eyebrow="Uso raro · planos da página inicial, FAQ, termos e tutorial">
          <div className="space-y-6">
            <TermsEditor key={`terms-${terms?.version ?? 'fallback'}`} terms={terms} onSave={saveLegalTerms} />
            <LandingPageContentAccordion plans={plans} faq={faq} tutorial={tutorial} onSavePlan={saveLpPlan} onSaveFaq={saveFaqItem} onDeleteFaq={deleteFaqItem} onSaveTutorial={saveTutorialContent} />
            <AdminTutorialAccordion tutorial={tutorial} onSaveTutorial={saveTutorialContent} TutorialEditor={TutorialEditor} />
          </div>
        </SecondarySection>
      </div>
    </main>
  )
}
