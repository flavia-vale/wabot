'use client'

/* Ofertas automáticas — reskin Menta do corpo. Mesma lógica da tela de
 * dashboard original: api.offerAutomations / Create / Update / Delete / Trigger
 * + api.groups + loadTemplateStore. Reusa o ConfirmDialog existente. Nenhuma
 * mudança no back end — só o visual do formulário e da lista. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ProFeaturePaywall } from '@/components/ProFeaturePaywall'
import { hasInstagramStoriesAccess, hasProLikeAccess } from '@/lib/planEntitlements'
import InstagramDestinationPicker, { instagramDestinationsFromConnections } from '@/components/InstagramDestinationPicker'
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
import { usePainelHeader, PainelContentActions } from '../PainelShell'
import { ReviewQueue } from '@/components/offerAutomation/ReviewQueue'
import { validateOfferAutomationForm } from '@/lib/offerAutomationForm'

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

function templateName(templates, key) {
  return templates.find((t) => t.key === key)?.name ?? 'Automático clássico'
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

const emptyForm = {
  destGroupJid: '',
  destGroupName: '',
  keyword: '',
  templateKey: 'automatico_classico',
  intervalMinutes: 240,
  dailyRunTime: DEFAULT_DAILY_RUN_TIME,
  offersPerSend: 1,
  minDiscountPct: 20,
  prioritizeAMS: false,
  publicationMode: 'direct',
  reviewTargetSize: 10,
  instagramDestinationIds: [],
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
  usePainelHeader({ title: 'Ofertas automáticas', subtitle: 'O bot garimpa promoções na Shopee e posta sozinho' })

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
      prioritizeAMS: a.prioritizeAMS ?? false,
      publicationMode: a.publicationMode || 'direct',
      reviewTargetSize: a.reviewTargetSize || 10,
      instagramDestinationIds: a.instagramDestinationIds || [],
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
      <div className="pnl-grid" style={{ maxWidth: 720, margin: '0 auto' }}>
        <ProFeaturePaywall
          title="Ofertas automáticas"
          bullets={[
            'O bot garimpa promoções na Shopee pela sua palavra-chave e posta sozinho nos seus grupos.',
            'Filtros de desconto mínimo, ordenação por vendas/comissão e até 5 produtos por envio.',
            'Dedup inteligente: o mesmo produto não repete no mesmo grupo em 24h.',
          ]}
        />
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
  const destGroupCount = new Set(automations.map((a) => a.destGroupJid).filter(Boolean)).size
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
            <label className="pnl-label">Enviar para qual grupo?</label>
            <select className="pnl-input" value={form.destGroupJid} onChange={(e) => handleGroupChange(e.target.value)}>
              <option value="">Selecione um grupo</option>
              {waGroups.map((g) => <option key={g.id} value={g.waJid}>{g.name}</option>)}
            </select>
            {!waGroups.length && <p className="pnl-field-error" style={{ marginTop: 4 }}>Nenhum grupo de destino cadastrado. Vá em Grupos para adicionar.</p>}
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

          <label className="pnl-check" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={form.prioritizeAMS} onChange={(e) => setForm((f) => ({ ...f, prioritizeAMS: e.target.checked }))} style={{ marginTop: 2 }} />
            <span>
              <span style={{ display: 'block', color: 'var(--ink)' }}>Priorizar ofertas com comissão extra do vendedor</span>
              <span className="pnl-hint">Se ativado, o bot busca as duas e envia primeiro as com comissão extra.</span>
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
    <div className="pnl-grid" style={{ maxWidth: 720, margin: '0 auto' }}>
      <PainelContentActions>
        <button type="button" className="pnl-btn is-primary" onClick={openCreate}>+ Nova automação</button>
      </PainelContentActions>

      {automations.length > 0 && (
        <>
          <section className="pnl-master">
            <div className="pnl-master-ico">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="10" cy="10" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M10.5 6.5 8.5 10.2h3L9.5 13.8" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="pnl-master-title">{activeCount > 0 ? 'Garimpo automático ligado' : 'Garimpo automático pausado'}</span>
                <span className="pnl-master-status">
                  <span className={`pnl-dot ${activeCount > 0 ? 'is-on' : 'is-idle'}`} aria-hidden="true" />
                  {activeCount > 0 ? 'buscando' : 'nada ativo'}
                </span>
              </div>
              <div className="pnl-master-sub">
                {activeCount} {activeCount === 1 ? 'automação ativa' : 'automações ativas'}
                {lastRunLabel ? ` · última busca ${lastRunLabel}` : ' · ainda não buscou'}
              </div>
            </div>
            <button
              type="button"
              className="pnl-btn is-primary"
              onClick={() => handleToggleAll(!allAutomationsEnabled)}
              disabled={bulkToggling !== null}
              aria-label={`${bulkToggleLabel} automações de ofertas`}
              style={{ flexShrink: 0 }}
            >
              {bulkToggling ? 'Atualizando…' : bulkToggleLabel}
            </button>
          </section>

          <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {[
              { label: 'Automações ativas', value: activeCount, sub: `de ${automations.length}` },
              { label: 'Pausadas', value: pausedCount, sub: pausedCount === 1 ? 'automação' : 'automações' },
              { label: 'Grupos de destino', value: destGroupCount, sub: 'recebendo ofertas' },
              { label: 'Última busca', value: lastRunLabel || '—', sub: 'envio automático' },
            ].map((s) => (
              <div key={s.label} className="pnl-kpi">
                <div className="pnl-kpi-label">{s.label}</div>
                <div className="pnl-kpi-num">{s.value}</div>
                <div className="pnl-kpi-foot">{s.sub}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <Link className="pnl-note-box" href="/painel/mensagens" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <span>🎲 Quer que cada mensagem saia diferente? Configure ganchos e CTAs.</span>
        <span className="pnl-link-btn">Editar em Mensagens →</span>
      </Link>

      {/* Mesma regra da fila e do espelhamento: quem decide o formato é o grupo
          de destino. Ver src/core/imageModePolicy.js. */}
      <Link className="pnl-note-box" href="/painel/grupos" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <span>🖼️ Como a oferta aparece (foto, foto com a sua marca ou card que abre a loja) é escolhido em cada grupo de destino.</span>
        <span className="pnl-link-btn">Editar em Grupos →</span>
      </Link>

      <div className="pnl-note-box is-flight">
        <strong style={{ fontWeight: 600 }}>Checklist antes de automatizar</strong>
        <p style={{ marginTop: 4 }}>Conecte o WhatsApp, confira suas credenciais da Shopee, escolha um grupo de destino e use “Enviar agora” para validar o modelo antes de deixar a recorrência ligada.</p>
      </div>

      {error && <div className="pnl-note-box is-error" role="alert">{error}</div>}

      {!automations.length && !showForm && (
        <div className="pnl-card pnl-empty">
          Nenhuma automação configurada ainda.<br />
          Crie uma busca por nicho, escolha o modelo da mensagem e teste com <strong>Enviar agora</strong> antes de ativar a recorrência.
        </div>
      )}

      {showForm && !editId && renderAutomationForm()}

      <div className="pnl-grid">
        {automations.map((a) => {
          const result = triggerResult[a.id]
          const reviewQueueOpen = openReviewQueues.has(a.id)
          return (
            <div key={a.id} className="pnl-card">
              <div className="pnl-card-head" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, background: '#EE4D2D', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }} title="Shopee" aria-hidden="true">S</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{a.keyword}”</span>
                  </p>
                  <p className="pnl-card-note" style={{ marginTop: 2 }}>→ {automationDestinationLabel(a, instagramDestinations)}</p>
                  <p className="pnl-hint" style={{ marginTop: 4 }}>
                    {INTERVAL_OPTIONS.find((o) => o.value === a.intervalMinutes)?.label ?? `${a.intervalMinutes} min`}{a.intervalMinutes === DAILY_INTERVAL_MINUTES && a.dailyRunTime ? ` às ${a.dailyRunTime}` : ''}
                    {' · '}
                    {OFFERS_PER_SEND_OPTIONS.find((o) => o.value === a.offersPerSend)?.label ?? `${a.offersPerSend} produto(s)`}
                    {' · '}
                    {DISCOUNT_OPTIONS.find((o) => o.value === a.minDiscountPct)?.label ?? `${a.minDiscountPct}% OFF mín.`}
                  </p>
                  <p className="pnl-hint">Modelo: {templateName(templates, a.templateKey || 'automatico_classico')} · {nextSendLabel(a.lastSentAt, a.intervalMinutes, a.dailyRunTime)}</p>
                  {a.publicationMode === 'review' && <span className="pnl-tag is-flight" style={{ display: 'inline-block', marginTop: 6 }}>👀 Revisão antes de publicar</span>}
                  {a.prioritizeAMS && <span className="pnl-tag is-flight" style={{ display: 'inline-block', marginTop: 6 }}>⚡ Comissão extra priorizada</span>}
                </div>
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
              <div className="pnl-toolbar" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                {a.publicationMode !== 'review' && <button type="button" className="pnl-link-btn" onClick={() => handleTrigger(a)} disabled={triggering === a.id}>
                  {triggering === a.id ? 'Enviando…' : 'Enviar agora'}
                </button>
                {a.publicationMode === 'review' && <button
                  type="button"
                  className="pnl-link-btn"
                  aria-expanded={reviewQueueOpen}
                  aria-controls={`review-queue-${a.id}`}
                  onClick={() => setOpenReviewQueues((current) => {
                    const next = new Set(current)
                    if (next.has(a.id)) next.delete(a.id)
                    else next.add(a.id)
                    return next
                  })}
                >{reviewQueueOpen ? 'Recolher fila' : 'Ver fila'}</button>}
                <button type="button" className="pnl-link-btn" style={{ color: 'var(--ink-soft)' }} onClick={() => openEdit(a)}>Editar</button>
                <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(a)}>Remover</button>
              </div>
              {result && (
                <p className="pnl-hint" style={{ marginTop: 8, color: result.error ? 'var(--danger)' : 'var(--accent-strong)' }}>
                  {result.error ? `Erro: ${result.error}` : result.skipped ? explainSkip(result.skipped) : `✓ ${result.sent} produto(s) enviado(s)`}
                </p>
              )}
              {a.publicationMode === 'review' && reviewQueueOpen && <div id={`review-queue-${a.id}`}><ReviewQueue automation={a} /></div>}
            </div>
          )
        })}
      </div>

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
