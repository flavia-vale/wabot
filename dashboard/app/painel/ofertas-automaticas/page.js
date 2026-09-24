'use client'

/* Ofertas automáticas — reskin Menta do corpo. Mesma lógica da tela de
 * dashboard original: api.offerAutomations / Create / Update / Delete / Trigger
 * + api.groups + loadTemplateStore. Reusa o ConfirmDialog existente. Nenhuma
 * mudança no back end — só o visual do formulário e da lista. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LockedPage } from '@/components/pro/ProGate'
import { OfertasAutomaticasPreview } from '@/components/pro/previews'
import { hasInstagramStoriesAccess, hasProLikeAccess } from '@/lib/planEntitlements'
import InstagramDestinationPicker, { instagramDestinationsFromConnections } from '@/components/InstagramDestinationPicker'
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
import { usePainelHeader } from '../PainelShell'
import { ReviewQueue } from '@/components/offerAutomation/ReviewQueue'
import { validateOfferAutomationForm } from '@/lib/offerAutomationForm'
import { SEARCH_ORDER_OPTIONS, DEFAULT_SEARCH_ORDER, searchOrderOption, describeSearchChoice, normalizeSearchChoice } from '@/lib/offerAutomationSearch'
import { VIDEO_ATIVACAO_ROBO_URL } from '../../../../src/tutorialVideo.js'

const DAILY_INTERVAL_MINUTES = 1440
const DEFAULT_DAILY_RUN_TIME = '09:00'

const INTERVAL_OPTIONS = [
  { value: 15, label: 'A cada 15 minutos' },
  { value: 30, label: 'A cada 30 minutos' },
  { value: 45, label: 'A cada 45 minutos' },
  { value: 60, label: 'A cada 1 hora' },
  { value: 120, label: 'A cada 2 horas' },
  { value: 240, label: 'A cada 4 horas' },
  { value: 360, label: 'A cada 6 horas' },
  { value: 720, label: 'A cada 12 horas' },
  { value: 1440, label: 'Uma vez por dia' },
]

const DISCOUNT_OPTIONS = [
  { value: 0, label: 'Qualquer produto em oferta' },
  { value: 10, label: 'Pelo menos 10% de desconto' },
  { value: 20, label: 'Pelo menos 20% de desconto (recomendado)' },
  { value: 30, label: 'Pelo menos 30% de desconto' },
  { value: 50, label: 'Só promoções acima de 50% (as maiores ofertas)' },
]

const OFFERS_PER_SEND_OPTIONS = [
  { value: 1, label: '1 produto por envio' },
  { value: 2, label: '2 produtos por envio' },
  { value: 3, label: '3 produtos por envio' },
  { value: 4, label: '4 produtos por envio' },
  { value: 5, label: '5 produtos por envio' },
]

const SKIP_LABELS = {
  bot_not_running: 'O bot não está conectado. Conecte o WhatsApp e tente de novo.',
  no_shopee_credentials: 'Sem credenciais da Shopee. Configure appId e secretKey.',
  invalid_shopee_credentials: 'Credenciais da Shopee incompletas (appId/secretKey).',
  no_offers_found: 'A Shopee não retornou produtos para essa palavra-chave.',
  all_offers_filtered: 'A Shopee trouxe produtos, mas todos foram filtrados (desconto mínimo alto ou já enviados). Tente reduzir o desconto mínimo.',
  no_approved_review_items: 'Aprove pelo menos uma oferta na fila antes de enviar.',
}

function explainSkip(code) {
  return SKIP_LABELS[code] ?? `Ignorado: ${code}`
}

function templatePreview(templates, key) {
  const body = templates.find((t) => t.key === key)?.body || ''
  return body.split('\n').slice(0, 5).join('\n')
}

function automationDestinationLabel(automation, instagramDestinations) {
  const labels = automation.destGroupName ? [automation.destGroupName] : []
  for (const id of automation.instagramDestinationIds || []) labels.push(instagramDestinations.find((destination) => destination.id === id)?.name || 'Instagram')
  return labels.join(' · ') || 'Nenhum destino'
}

function AutomationActions({ automation, triggering, reviewQueueOpen, onTrigger, onToggleQueue, onEdit, onRemove }) {
  return (
    <div className="pnl-toolbar" style={{ marginTop: 10, flexWrap: 'wrap' }}>
      <button type="button" className="pnl-link-btn" onClick={onTrigger} disabled={triggering}>
        {triggering ? 'Enviando…' : 'Enviar agora'}
      </button>
      {automation.publicationMode === 'review' ? (
        <button
          type="button"
          className="pnl-link-btn"
          aria-expanded={reviewQueueOpen}
          aria-controls={`review-queue-${automation.id}`}
          onClick={onToggleQueue}
        >
          {reviewQueueOpen ? 'Recolher fila' : 'Ver fila'}
        </button>
      ) : null}
      <button type="button" className="pnl-link-btn" style={{ color: 'var(--ink-soft)' }} onClick={onEdit}>Editar</button>
      <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)' }} onClick={onRemove}>Remover</button>
    </div>
  )
}

const emptyForm = {
  destGroupJid: '',
  destGroupName: '',
  keyword: '',
  templateKey: 'automatico_classico',
  intervalMinutes: 240,
  dailyRunTime: DEFAULT_DAILY_RUN_TIME,
  offersPerSend: 1,
  minDiscountPct: 20,
  sortType: DEFAULT_SEARCH_ORDER,
  publicationMode: 'direct',
  reviewTargetSize: 10,
  instagramDestinationIds: [],
  // specs/017-client-coupon-catalog: desmarcada por padrão — automação
  // existente nunca muda de comportamento sozinha (FR-023/SC-005).
  useCoupons: false,
}

function nextSendLabel(lastSentAt, intervalMinutes, dailyRunTime) {
  if (intervalMinutes === DAILY_INTERVAL_MINUTES && dailyRunTime) {
    if (!lastSentAt) return `Próximo envio: hoje quando chegar às ${dailyRunTime} (horário de Brasília)`
    return `Próximo envio: próximo dia às ${dailyRunTime} (horário de Brasília)`
  }
  if (!lastSentAt) return 'Próximo envio: assim que o bot estiver ativo'
  const next = new Date(new Date(lastSentAt).getTime() + intervalMinutes * 60_000)
  const now = new Date()
  if (next <= now) return 'Próximo envio: em breve'
  const diff = Math.round((next - now) / 60_000)
  if (diff < 60) return `Próximo envio: em ${diff} min`
  return `Próximo envio: em ${Math.round(diff / 60)}h`
}

export default function OfertasAutomaticasPage() {
  usePainelHeader({ title: 'Ofertas automáticas', subtitle: 'Diga o que quer divulgar. O bot procura nas lojas, filtra pelo desconto e publica sozinho.' })

  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(true)
  const [waGroups, setWaGroups] = useState([])
  const [instagramDestinations, setInstagramDestinations] = useState([])
  const [templates, setTemplates] = useState([])
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [triggering, setTriggering] = useState(null)
  const [bulkToggling, setBulkToggling] = useState(null)
  const [triggerResult, setTriggerResult] = useState({})
  const [openReviewQueues, setOpenReviewQueues] = useState(() => new Set())
  const [planSubject, setPlanSubject] = useState({ plan: 'pro', accessExpiresAt: null })
  const [reviewAvailable, setReviewAvailable] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [list, groups, templateStore, me, connections, reviewCapability] = await Promise.all([
        api.offerAutomations(),
        api.groups().then((gs) => gs.filter((g) => g.role === 'post')),
        loadTemplateStore(),
        api.me().catch(() => null),
        api.instagramConnections().catch(() => []),
        api.offerAutomationReviewCapability().catch(() => ({ enabled: false })),
      ])
      setAutomations(list)
      setWaGroups(groups)
      setTemplates(composeTemplates(templateStore))
      setInstagramDestinations(hasInstagramStoriesAccess(me || {}) ? instagramDestinationsFromConnections(connections) : [])
      if (me) setPlanSubject({ plan: me.plan ?? 'trial', accessExpiresAt: me.accessExpiresAt ?? null })
      setReviewAvailable(reviewCapability.enabled === true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setSaveError('')
    setShowForm(true)
  }

  function openEdit(a) {
    setEditId(a.id)
    setForm({
      destGroupJid: a.destGroupJid,
      destGroupName: a.destGroupName,
      keyword: a.keyword,
      templateKey: a.templateKey || 'automatico_classico',
      intervalMinutes: a.intervalMinutes,
      dailyRunTime: a.dailyRunTime || DEFAULT_DAILY_RUN_TIME,
      offersPerSend: a.offersPerSend,
      minDiscountPct: a.minDiscountPct,
      ...normalizeSearchChoice(a),
      prioritizeAMS: a.prioritizeAMS ?? false,
      publicationMode: a.publicationMode || 'direct',
      reviewTargetSize: a.reviewTargetSize || 10,
      instagramDestinationIds: a.instagramDestinationIds || [],
      useCoupons: a.useCoupons ?? false,
    })
    setSaveError('')
    setShowForm(true)
  }

  function handleGroupChange(jid) {
    const g = waGroups.find((g) => g.waJid === jid)
    setForm((f) => ({ ...f, destGroupJid: jid, destGroupName: g?.name ?? jid }))
  }

  function toggleInstagramDestination(id) {
    setForm((current) => ({ ...current, instagramDestinationIds: current.instagramDestinationIds.includes(id) ? current.instagramDestinationIds.filter((value) => value !== id) : [...current.instagramDestinationIds, id] }))
  }

  async function handleSave() {
    const validationError = validateOfferAutomationForm(form)
    if (validationError) {
      setSaveError(validationError)
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      if (editId) {
        const previous = automations.find((item) => item.id === editId)
        await api.offerAutomationUpdate(editId, { ...form, confirmPublicationModeChange: previous?.publicationMode !== form.publicationMode })
      }
      else await api.offerAutomationCreate(form)
      setShowForm(false)
      await load()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(a) {
    try {
      await api.offerAutomationUpdate(a.id, { enabled: !a.enabled })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggleAll(enabled) {
    const targets = automations.filter((a) => a.enabled !== enabled)
    if (!targets.length) return
    setBulkToggling(enabled ? 'on' : 'off')
    setError('')
    try {
      await Promise.all(targets.map((a) => api.offerAutomationUpdate(a.id, { enabled })))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBulkToggling(null)
    }
  }

  async function handleDelete(a) {
    try {
      await api.offerAutomationDelete(a.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleTrigger(a) {
    setTriggering(a.id)
    setTriggerResult((r) => ({ ...r, [a.id]: null }))
    try {
      const res = await api.offerAutomationTrigger(a.id)
      setTriggerResult((r) => ({ ...r, [a.id]: res.result }))
      await load()
    } catch (err) {
      setTriggerResult((r) => ({ ...r, [a.id]: { error: err.message } }))
    } finally {
      setTriggering(null)
    }
  }

  if (loading) {
    return <div className="pnl-card" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', color: 'var(--ink-soft)' }}>Carregando…</div>
  }

  // Feature Pro: sem o plano, a página vira paywall (badge + benefícios +
  // CTA), mantendo só a listagem/remoção do que já existe.
  if (!hasProLikeAccess(planSubject)) {
    return (
      <div className="pnl-grid" style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div className="pnl-note-box is-info">
          🛍️ Por enquanto, o garimpo automático busca produtos só na <strong>Shopee</strong>. Mercado Livre, Amazon, SHEIN, Magalu e AliExpress ainda não têm busca automática por palavra-chave.
        </div>
        <LockedPage
          feature="garimpo"
          featureLabel="as ofertas automáticas"
          steps={[
            { title: 'Escolha um tema', desc: 'Ex.: air fryer, tênis, perfume.' },
            { title: 'Escolha o desconto', desc: 'O robô procura na Shopee a partir do desconto que você definir.' },
            { title: 'Escolha o grupo e o horário', desc: 'Ex.: das 8h às 22h. Salvou, começou.' },
          ]}
        >
          <OfertasAutomaticasPreview />
        </LockedPage>
        {error && <div className="pnl-note-box is-error" role="alert">{error}</div>}
        {automations.length > 0 && (
          <section className="pnl-card">
            <div className="pnl-card-title">Suas automações (desativadas)</div>
            <p className="pnl-hint" style={{ marginTop: 6 }}>Elas ficam guardadas e voltam a funcionar assim que o plano permitir.</p>
            {automations.map((a) => (
              <div key={a.id} style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{a.keyword}</strong>
                  <p className="pnl-hint" style={{ marginTop: 2 }}>{automationDestinationLabel(a, instagramDestinations)}</p>
                </div>
                <button className="pnl-btn" onClick={() => setDeleteTarget(a)}>Excluir</button>
              </div>
            ))}
          </section>
        )}
        {deleteTarget && (
          <ConfirmDialog
            open
            title="Remover automação"
            message={`Tem certeza que deseja remover a automação para "${deleteTarget.keyword}"?`}
            confirmLabel="Remover"
            danger
            onConfirm={() => handleDelete(deleteTarget)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    )
  }

  const selectedTemplatePreview = templatePreview(templates, form.templateKey)

  // Métricas do card-mestre/stats — todas derivadas das automações reais.
  const activeCount = automations.filter((a) => a.enabled).length
  const pausedCount = automations.length - activeCount
  const lastSentTimes = automations.map((a) => a.lastSentAt).filter(Boolean).map((d) => new Date(d).getTime()).filter((n) => Number.isFinite(n))
  const lastRunMs = lastSentTimes.length ? Math.max(...lastSentTimes) : null
  function relativeAgo(ms) {
    if (!ms) return null
    const diff = Math.round((Date.now() - ms) / 60000)
    if (diff < 1) return 'agora mesmo'
    if (diff < 60) return `há ${diff} min`
    const h = Math.round(diff / 60)
    if (h < 24) return `há ${h} h`
    return `há ${Math.round(h / 24)} d`
  }
  const lastRunLabel = relativeAgo(lastRunMs)
  const allAutomationsEnabled = automations.length > 0 && activeCount === automations.length
  const bulkToggleLabel = allAutomationsEnabled ? 'Desativar todas' : 'Ativar todas'

  function intervalShortLabel(automation) {
    if (automation.intervalMinutes === DAILY_INTERVAL_MINUTES) return `Todo dia às ${automation.dailyRunTime || DEFAULT_DAILY_RUN_TIME}`
    if (automation.intervalMinutes < 60) return `A cada ${automation.intervalMinutes} min`
    return `A cada ${automation.intervalMinutes / 60} h`
  }

  function renderAutomationForm() {
    return (
        <section className="pnl-card pnl-grid">
          <div className="pnl-card-title">{editId ? 'Editar automação' : 'Nova automação'}</div>

          <div>
            <label className="pnl-label">O que você quer vender?</label>
            <input
              type="text"
              className="pnl-input"
              value={form.keyword}
              onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="Ex: decoração de festas, eletrônicos, moda feminina"
            />
            <p className="pnl-hint" style={{ marginTop: 4 }}>Use palavras que descrevem o tipo de produto.</p>
          </div>

          <div>
            <label className="pnl-label">Modelo da mensagem</label>
            <select className="pnl-input" value={form.templateKey} onChange={(e) => setForm((f) => ({ ...f, templateKey: e.target.value }))}>
              {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            <p className="pnl-hint" style={{ marginTop: 4 }}>Edite os modelos em Mensagens. O padrão “Automático clássico” mantém o texto atual.</p>
            {selectedTemplatePreview && <pre className="pnl-pre" style={{ background: 'var(--bg-soft)', borderRadius: 8, padding: 12, marginTop: 8, maxHeight: 112 }}>{selectedTemplatePreview}</pre>}
          </div>

          {reviewAvailable && <div>
            <label className="pnl-label">Como publicar?</label>
            <select className="pnl-input" value={form.publicationMode} onChange={(e) => setForm((f) => ({ ...f, publicationMode: e.target.value }))}>
              <option value="direct">Publicar automaticamente</option>
              <option value="review">Quero revisar antes de publicar</option>
            </select>
            <p className="pnl-hint" style={{ marginTop: 4 }}>{form.publicationMode === 'review' ? 'O bot prepara as ofertas, mas só publica o que você aprovar.' : 'O bot busca e publica sozinho, como funciona hoje.'}</p>
            {form.publicationMode === 'review' && <select aria-label="Quantidade de ofertas para revisão" className="pnl-input" style={{ marginTop: 8 }} value={form.reviewTargetSize} onChange={(e) => setForm((f) => ({ ...f, reviewTargetSize: Number(e.target.value) }))}><option value={5}>Guardar 5 ofertas</option><option value={10}>Guardar 10 ofertas</option><option value={20}>Guardar 20 ofertas</option></select>}
          </div>}

          <div>
            <label className="pnl-label">
              Enviar para qual grupo?{' '}
              <Link href="/painel/espelhamento" style={{ fontWeight: 400, textDecoration: 'underline' }}>Cadastre um grupo de destino aqui.</Link>
            </label>
            <select className="pnl-input" value={form.destGroupJid} onChange={(e) => handleGroupChange(e.target.value)}>
              <option value="">Selecione um grupo</option>
              {waGroups.map((g) => <option key={g.id} value={g.waJid}>{g.name}</option>)}
            </select>
            {!waGroups.length && <p className="pnl-field-error" style={{ marginTop: 4 }}>Nenhum grupo de destino cadastrado. Vá em Espelhamento para adicionar.</p>}
          </div>

          <InstagramDestinationPicker destinations={instagramDestinations} selectedIds={form.instagramDestinationIds} onToggle={toggleInstagramDestination} title="Também publicar no Instagram" />

          <div>
            <label className="pnl-label">Com que frequência enviar?</label>
            <select
              className="pnl-input"
              value={form.intervalMinutes}
              onChange={(e) => {
                const intervalMinutes = Number(e.target.value)
                setForm((f) => ({ ...f, intervalMinutes, dailyRunTime: intervalMinutes === DAILY_INTERVAL_MINUTES ? (f.dailyRunTime || DEFAULT_DAILY_RUN_TIME) : f.dailyRunTime }))
              }}
            >
              {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {form.intervalMinutes === DAILY_INTERVAL_MINUTES && (
            <div>
              <label className="pnl-label">Horário do envio diário</label>
              <input type="time" className="pnl-input" value={form.dailyRunTime} onChange={(e) => setForm((f) => ({ ...f, dailyRunTime: e.target.value }))} />
              <p className="pnl-hint" style={{ marginTop: 4 }}>A automação roda uma vez por dia nesse horário (horário de Brasília). Se o bot/API estiverem offline no minuto exato, ela envia assim que o cron voltar no mesmo dia.</p>
            </div>
          )}

          <div>
            <label className="pnl-label">Quantos produtos enviar de uma vez?</label>
            <select className="pnl-input" value={form.offersPerSend} onChange={(e) => setForm((f) => ({ ...f, offersPerSend: Number(e.target.value) }))}>
              {OFFERS_PER_SEND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="pnl-label">Qual o desconto mínimo para enviar?</label>
            <select className="pnl-input" value={form.minDiscountPct} onChange={(e) => setForm((f) => ({ ...f, minDiscountPct: Number(e.target.value) }))}>
              {DISCOUNT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="pnl-hint" style={{ marginTop: 4 }}>Só produtos com desconto real serão enviados.</p>
          </div>

          {/* Uma escolha só. A lista da Shopee saiu da tela em 2026-09-17:
              cinco palavras-chave medidas, as três listas devolveram o mesmo
              (ver src/offerAutomation/searchListType.js). */}
          <div>
            <label className="pnl-label">O que você quer que apareça primeiro?</label>
            <select className="pnl-input" value={form.sortType} onChange={(e) => setForm((f) => ({ ...f, sortType: Number(e.target.value) }))}>
              {SEARCH_ORDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="pnl-hint" style={{ marginTop: 4 }}>{searchOrderOption(form.sortType).hint}</p>
          </div>

          {/* Opção antiga: aparece SÓ em automação que já está com ela ligada,
              e só para desligar. Automação nova nunca nasce com isso, então
              este bloco some da tela assim que a cliente desmarcar e salvar. */}
          {form.prioritizeAMS && (
            <div className="pnl-note-box">
              <label className="pnl-check" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked onChange={() => setForm((f) => ({ ...f, prioritizeAMS: false }))} style={{ marginTop: 2 }} />
                <span>
                  <span style={{ display: 'block', color: 'var(--ink)' }}>Ofertas com comissão extra do vendedor passam na frente</span>
                  <span className="pnl-hint">Opção antiga, que continua valendo nesta automação. Ela passa na frente da ordem escolhida acima — enviando poucos produtos por vez, pode ser que só essas ofertas saiam. Desmarque e salve para usar só a ordem que você escolheu. Depois de desligar, ela não volta.</span>
                </span>
              </label>
            </div>
          )}

          <label className="pnl-check" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={form.useCoupons} onChange={(e) => setForm((f) => ({ ...f, useCoupons: e.target.checked }))} style={{ marginTop: 2 }} />
            <span>
              <span style={{ display: 'block', color: 'var(--ink)' }}>Usar meus cupons cadastrados nesta automação</span>
              <span className="pnl-hint">Quando o modelo da mensagem tiver a variável {'{cupom}'}, o bot escolhe sozinho o melhor cupom da loja cadastrado em Cupons.</span>
            </span>
          </label>

          {saveError && <div className="pnl-note-box is-error" role="alert">{saveError}</div>}

          <div className="pnl-toolbar">
            <button
              type="button"
              className="pnl-btn is-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="pnl-btn" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </section>
    )
  }

  return (
    <div className="pnl-grid offer-auto-page">
      <header className="pnl-pro-head">
        <div>
          <h2>Ofertas automáticas</h2>
          <p>Diga o que quer divulgar. O robô procura na Shopee, filtra pelo desconto e publica sozinho.</p>
        </div>
        <button type="button" className="pnl-btn is-primary" onClick={openCreate}>+ Novo tema</button>
      </header>
      <a className="offer-auto-guide" href={VIDEO_ATIVACAO_ROBO_URL} target="_blank" rel="noreferrer">
        <span className="offer-auto-guide-play" aria-hidden="true">▶</span>
        <span className="offer-auto-guide-copy">
          <strong>Veja na prática: como ativar as ofertas automáticas</strong>
          <small>Defina tema, destino e horário. Depois disso, suas ofertas rodam sozinhas.</small>
        </span>
        <span className="offer-auto-guide-time">4 min</span>
        <span className="offer-auto-guide-cta">Assistir <span aria-hidden="true">↗</span></span>
      </a>

      <div className="pnl-note-box is-info">
        🛍️ Por enquanto, o garimpo automático busca produtos só na <strong>Shopee</strong>. Mercado Livre, Amazon, SHEIN, Magalu e AliExpress ainda não têm busca automática por palavra-chave.
      </div>

      {automations.length > 0 && (
        <section className="offer-auto-status">
          <span className={`offer-auto-status-icon ${activeCount > 0 ? 'is-on' : ''}`} aria-hidden="true">✓</span>
          <span className="offer-auto-status-copy">
            <strong>{activeCount > 0 ? 'Busca automática ligada' : 'Busca automática pausada'}</strong>
            <small>
              {activeCount > 0 ? `${activeCount} ${activeCount === 1 ? 'tema ativo' : 'temas ativos'}` : 'Nenhum tema está buscando ofertas'}
              {lastRunLabel ? ` · última busca ${lastRunLabel}` : ' · ainda não buscou'}
            </small>
          </span>
          <span className="offer-auto-bulk-label">{bulkToggling ? 'Atualizando…' : bulkToggleLabel}</span>
          <button type="button" className={`pnl-switch${allAutomationsEnabled ? ' is-on' : ''}`} onClick={() => handleToggleAll(!allAutomationsEnabled)} disabled={bulkToggling !== null} aria-label={`${bulkToggleLabel} automações de ofertas`} aria-pressed={allAutomationsEnabled}><span /></button>
        </section>
      )}

      {error && <div className="pnl-note-box is-error" role="alert">{error}</div>}

      {!automations.length && !showForm && (
        <div className="pnl-card pnl-empty">
          Nenhuma automação configurada ainda.<br />
          Crie uma busca por nicho, escolha o modelo da mensagem e teste com <strong>Enviar agora</strong> antes de ativar a recorrência.
        </div>
      )}

      {showForm && !editId && renderAutomationForm()}

      <section className="offer-auto-topics">
        <header className="offer-auto-section-head">
          <div>
            <h2>Temas que o bot procura</h2>
            <p>Edite um tema para ajustar loja, mensagem, horário e ordem da busca.</p>
          </div>
          {automations.length > 0 && <span>{activeCount} {activeCount === 1 ? 'ligado' : 'ligados'} · {pausedCount} {pausedCount === 1 ? 'pausado' : 'pausados'}</span>}
        </header>

        <div className="offer-auto-table-head" aria-hidden="true">
          <span>Tema</span><span>Destino</span><span>Desconto mín.</span><span>Ritmo</span><span>Ativo</span>
        </div>

        <div className="offer-auto-topic-list">
        {automations.map((a) => {
          const result = triggerResult[a.id]
          const reviewQueueOpen = openReviewQueues.has(a.id)
          return (
            <article key={a.id} className={`offer-auto-topic${a.enabled ? '' : ' is-paused'}`}>
              <div className="offer-auto-topic-main">
                <strong>{a.keyword}</strong>
                <small>{describeSearchChoice(a)} · {OFFERS_PER_SEND_OPTIONS.find((o) => o.value === a.offersPerSend)?.label ?? `${a.offersPerSend} produto(s)`}</small>
                <AutomationActions automation={a} triggering={triggering === a.id} reviewQueueOpen={reviewQueueOpen} onTrigger={() => handleTrigger(a)} onToggleQueue={() => setOpenReviewQueues((current) => { const next = new Set(current); if (next.has(a.id)) next.delete(a.id); else next.add(a.id); return next })} onEdit={() => openEdit(a)} onRemove={() => setDeleteTarget(a)} />
              </div>
              <div className={`offer-auto-topic-destination offer-auto-publication ${a.publicationMode === 'review' ? 'is-review' : 'is-direct'}`}>
                <strong>{a.publicationMode === 'review' ? 'Revisar antes' : 'Enviar direto'}</strong>
                {a.publicationMode === 'review' && <small>{a.approvedReviewCount || 0} {a.approvedReviewCount === 1 ? 'oferta aprovada' : 'ofertas aprovadas'} na fila</small>}
                <span>{automationDestinationLabel(a, instagramDestinations)}</span>
              </div>
              <div><span className="offer-auto-discount">{a.minDiscountPct > 0 ? `${a.minDiscountPct}% ou mais` : 'Qualquer oferta'}</span></div>
              <div className="offer-auto-rhythm">{intervalShortLabel(a)}<small>{nextSendLabel(a.lastSentAt, a.intervalMinutes, a.dailyRunTime)}</small></div>
              <div className="offer-auto-topic-toggle">
                <button
                  type="button"
                  className={`pnl-switch${a.enabled ? ' is-on' : ''}`}
                  onClick={() => handleToggle(a)}
                  title={a.enabled ? 'Pausar' : 'Ativar'}
                  aria-pressed={a.enabled}
                >
                  <span />
                </button>
              </div>
              {showForm && editId === a.id && renderAutomationForm()}
              {result && (
                <p className="offer-auto-result" style={{ color: result.error ? 'var(--danger)' : 'var(--accent-strong)' }}>
                  {result.error ? `Erro: ${result.error}` : result.skipped ? explainSkip(result.skipped) : `✓ ${result.sent} produto(s) enviado(s)`}
                </p>
              )}
              {a.publicationMode === 'review' && reviewQueueOpen && <div className="offer-auto-review" id={`review-queue-${a.id}`}><ReviewQueue automation={a} /></div>}
            </article>
          )
        })}
        </div>
      </section>

      <section className="offer-auto-rules">
        <header className="offer-auto-section-head"><div><h2>Antes de deixar rodando</h2><p>Três atalhos para conferir a configuração das ofertas.</p></div></header>
        <div className="offer-auto-rule"><span>Modelo das mensagens</span><Link href="/painel/mensagens">Editar mensagens <span aria-hidden="true">→</span></Link></div>
        <div className="offer-auto-rule"><span>Como a oferta aparece (foto, marca e card)</span><Link href="/painel/grupos">Editar nos grupos <span aria-hidden="true">→</span></Link></div>
        <div className="offer-auto-rule"><span>Teste antes de automatizar</span><small>Use “Enviar agora” em um tema e confira o resultado no grupo.</small></div>
      </section>

      {deleteTarget && (
        <ConfirmDialog
          open
          title="Remover automação"
          message={`Tem certeza que deseja remover a automação para "${deleteTarget.keyword}"?`}
          confirmLabel="Remover"
          danger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
