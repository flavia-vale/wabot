'use client'

/* Ofertas automáticas — reskin Menta do corpo. Mesma lógica da tela de
 * dashboard original: api.offerAutomations / Create / Update / Delete / Trigger
 * + api.groups + loadTemplateStore. Reusa o ConfirmDialog existente. Nenhuma
 * mudança no back end — só o visual do formulário e da lista. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
import { usePainelHeader } from '../PainelShell'

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
  const [templates, setTemplates] = useState([])
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [triggering, setTriggering] = useState(null)
  const [triggerResult, setTriggerResult] = useState({})

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [list, groups, templateStore] = await Promise.all([
        api.offerAutomations(),
        api.groups().then((gs) => gs.filter((g) => g.role === 'post')),
        loadTemplateStore(),
      ])
      setAutomations(list)
      setWaGroups(groups)
      setTemplates(composeTemplates(templateStore))
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
    })
    setSaveError('')
    setShowForm(true)
  }

  function handleGroupChange(jid) {
    const g = waGroups.find((g) => g.waJid === jid)
    setForm((f) => ({ ...f, destGroupJid: jid, destGroupName: g?.name ?? jid }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      if (editId) await api.offerAutomationUpdate(editId, form)
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

  const selectedTemplatePreview = templatePreview(templates, form.templateKey)

  return (
    <div className="pnl-grid" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="pnl-toolbar" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="pnl-btn is-primary" onClick={openCreate}>+ Nova automação</button>
      </div>

      <Link className="pnl-note-box" href="/painel/mensagens" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <span>🎲 Quer que cada mensagem saia diferente? Configure ganchos e CTAs.</span>
        <span className="pnl-link-btn">Editar em Mensagens →</span>
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

      {showForm && (
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

          <div>
            <label className="pnl-label">Enviar para qual grupo?</label>
            <select className="pnl-input" value={form.destGroupJid} onChange={(e) => handleGroupChange(e.target.value)}>
              <option value="">Selecione um grupo</option>
              {waGroups.map((g) => <option key={g.id} value={g.waJid}>{g.name}</option>)}
            </select>
            {!waGroups.length && <p className="pnl-field-error" style={{ marginTop: 4 }}>Nenhum grupo de destino cadastrado. Vá em Grupos para adicionar.</p>}
          </div>

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
              disabled={saving || !form.keyword.trim() || !form.destGroupJid || (form.intervalMinutes === DAILY_INTERVAL_MINUTES && !form.dailyRunTime)}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="pnl-btn" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </section>
      )}

      <div className="pnl-grid">
        {automations.map((a) => {
          const result = triggerResult[a.id]
          return (
            <div key={a.id} className="pnl-card">
              <div className="pnl-card-head" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{a.keyword}”</p>
                  <p className="pnl-card-note" style={{ marginTop: 2 }}>→ {a.destGroupName}</p>
                  <p className="pnl-hint" style={{ marginTop: 4 }}>
                    {INTERVAL_OPTIONS.find((o) => o.value === a.intervalMinutes)?.label ?? `${a.intervalMinutes} min`}{a.intervalMinutes === DAILY_INTERVAL_MINUTES && a.dailyRunTime ? ` às ${a.dailyRunTime}` : ''}
                    {' · '}
                    {OFFERS_PER_SEND_OPTIONS.find((o) => o.value === a.offersPerSend)?.label ?? `${a.offersPerSend} produto(s)`}
                    {' · '}
                    {DISCOUNT_OPTIONS.find((o) => o.value === a.minDiscountPct)?.label ?? `${a.minDiscountPct}% OFF mín.`}
                  </p>
                  <p className="pnl-hint">Modelo: {templateName(templates, a.templateKey || 'automatico_classico')} · {nextSendLabel(a.lastSentAt, a.intervalMinutes, a.dailyRunTime)}</p>
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
              <div className="pnl-toolbar" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                <button type="button" className="pnl-link-btn" onClick={() => handleTrigger(a)} disabled={triggering === a.id}>
                  {triggering === a.id ? 'Enviando…' : 'Enviar agora'}
                </button>
                <button type="button" className="pnl-link-btn" style={{ color: 'var(--ink-soft)' }} onClick={() => openEdit(a)}>Editar</button>
                <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(a)}>Remover</button>
              </div>
              {result && (
                <p className="pnl-hint" style={{ marginTop: 8, color: result.error ? 'var(--danger)' : 'var(--accent-strong)' }}>
                  {result.error ? `Erro: ${result.error}` : result.skipped ? explainSkip(result.skipped) : `✓ ${result.sent} produto(s) enviado(s)`}
                </p>
              )}
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
