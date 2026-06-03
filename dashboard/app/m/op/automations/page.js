'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { MobileConfirmDialog } from '@/components/mobile/MobileModal'
import { mobi, cfgStyles, tint, tintBorder } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileRoutes } from '@/components/mobile/routes'
import { api } from '@/lib/api'
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'

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
  { value: 20, label: 'Pelo menos 20% de desconto' },
  { value: 30, label: 'Pelo menos 30% de desconto' },
  { value: 50, label: 'Só acima de 50%' },
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

const explainSkip = (code) => SKIP_LABELS[code] ?? `Ignorado: ${code}`

const emptyForm = {
  destGroupJid: '',
  destGroupName: '',
  keyword: '',
  templateKey: 'automatico_classico',
  intervalMinutes: 240,
  offersPerSend: 1,
  minDiscountPct: 20,
}

const s = {
  actionLink: { border: 'none', background: 'transparent', color: 'var(--accent-strong)', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', padding: 0 },
  dangerLink: { border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', padding: 0 },
  cardActions: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 },
  result: (danger) => ({ fontSize: 12, color: danger ? 'var(--danger)' : 'var(--success)', marginTop: 10, lineHeight: 1.4 }),
}

function optionLabel(options, value, fallback) {
  return options.find((option) => option.value === value)?.label ?? fallback
}

function templateName(templates, key) {
  return templates.find((template) => template.key === key)?.name ?? 'Automático clássico'
}

function templatePreview(templates, key) {
  return (templates.find((template) => template.key === key)?.body || '').split('\n').slice(0, 4).join('\n')
}

function nextSendLabel(lastSentAt, intervalMinutes) {
  if (!lastSentAt) return 'Próximo envio: assim que o bot estiver ativo'
  const next = new Date(new Date(lastSentAt).getTime() + intervalMinutes * 60_000)
  if (next <= new Date()) return 'Próximo envio: em breve'
  const diff = Math.round((next - Date.now()) / 60_000)
  if (diff < 60) return `Próximo envio: em ${diff} min`
  return `Próximo envio: em ${Math.round(diff / 60)}h`
}

export default function MobileAutomationsPage() {
  useMobileRoutePerf('m/op/automations')
  const router = useRouter()
  const [automations, setAutomations] = useState([])
  const [groups, setGroups] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [resultById, setResultById] = useState({})
  const [pendingDelete, setPendingDelete] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [list, allGroups, templateStore] = await Promise.all([
        api.offerAutomations(),
        api.groups().then((items) => Array.isArray(items) ? items.filter((group) => group.role === 'post') : []),
        loadTemplateStore(),
      ])
      setAutomations(Array.isArray(list) ? list : [])
      setGroups(allGroups)
      setTemplates(composeTemplates(templateStore))
    } catch (err) {
      setError(err.message || 'Não foi possível carregar automações.')
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

  function openEdit(item) {
    setEditId(item.id)
    setForm({
      destGroupJid: item.destGroupJid || '',
      destGroupName: item.destGroupName || '',
      keyword: item.keyword || '',
      templateKey: item.templateKey || 'automatico_classico',
      intervalMinutes: item.intervalMinutes || 240,
      offersPerSend: item.offersPerSend || 1,
      minDiscountPct: item.minDiscountPct ?? 20,
    })
    setSaveError('')
    setShowForm(true)
  }

  function handleGroupChange(jid) {
    const group = groups.find((item) => item.waJid === jid)
    setForm((current) => ({ ...current, destGroupJid: jid, destGroupName: group?.name ?? jid }))
  }

  async function save() {
    setSaving(true)
    setSaveError('')
    try {
      if (editId) await api.offerAutomationUpdate(editId, form)
      else await api.offerAutomationCreate(form)
      setShowForm(false)
      await load()
    } catch (err) {
      setSaveError(err.message || 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(item) {
    setBusyId(`toggle-${item.id}`)
    setError('')
    try {
      await api.offerAutomationUpdate(item.id, { enabled: !item.enabled })
      await load()
    } catch (err) {
      setError(err.message || 'Não foi possível alterar status.')
    } finally {
      setBusyId('')
    }
  }

  async function trigger(item) {
    setBusyId(`trigger-${item.id}`)
    setResultById((current) => ({ ...current, [item.id]: null }))
    try {
      const response = await api.offerAutomationTrigger(item.id)
      setResultById((current) => ({ ...current, [item.id]: response?.result ?? { sent: 0 } }))
      await load()
    } catch (err) {
      setResultById((current) => ({ ...current, [item.id]: { error: err.message || 'Falha ao enviar agora.' } }))
    } finally {
      setBusyId('')
    }
  }

  async function confirmRemove() {
    const item = pendingDelete
    if (!item) return
    setBusyId(`delete-${item.id}`)
    setError('')
    try {
      await api.offerAutomationDelete(item.id)
      setPendingDelete(null)
      await load()
    } catch (err) {
      setError(err.message || 'Não foi possível remover.')
      setPendingDelete(null)
    } finally {
      setBusyId('')
    }
  }

  if (loading) return <MobileShell title="Automações" active="espelhar" showBack onBack={() => router.back()}><div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando automações..." /></div></MobileShell>
  if (error && automations.length === 0) return <MobileShell title="Automações" active="espelhar" showBack onBack={() => router.back()}><div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} onRetry={() => load()} /></div></MobileShell>

  const canSave = form.keyword.trim() && form.destGroupJid
  const selectedTemplatePreview = templatePreview(templates, form.templateKey)

  return (
    <MobileShell title="Automações" active="espelhar" showBack onBack={() => router.back()}>
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Operação automática</div>
        <div style={cfgStyles.pageTitle}>Ofertas automáticas</div>
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>Configure buscas recorrentes e envie promoções automaticamente para seus destinos.</div>
          <div style={{ fontSize: 11.5, color: 'var(--warn, #a16207)', lineHeight: 1.45, background: tint('#f59e0b', 12), border: tintBorder('#f59e0b', 28), borderRadius: 12, padding: '9px 10px' }}>
            Antes de deixar ligado: conecte o WhatsApp, confira as credenciais Shopee e teste com “Enviar agora”.
          </div>
          <button type="button" onClick={openCreate} style={mobi.btn('accent', true)}>+ Nova automação</button>
          <button type="button" onClick={() => router.push(mobileRoutes.accountVariations)} style={mobi.btn('ghost', true)}>Editar ganchos, CTAs e modelos</button>
        </div>
      </div>

      {error && <div style={{ padding: '12px 16px 0', color: 'var(--danger)', fontSize: 12 }}>{error}</div>}

      {showForm && (
        <div style={cfgStyles.cardWrap}>
          <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{editId ? 'Editar automação' : 'Nova automação'}</div>
            <label>
              <div style={cfgStyles.label}>O que vender?</div>
              <input style={cfgStyles.field} value={form.keyword} onChange={(event) => setForm((current) => ({ ...current, keyword: event.target.value }))} placeholder="Ex: decoração de festa" />
            </label>
            <label>
              <div style={cfgStyles.label}>Modelo da mensagem</div>
              <select style={cfgStyles.field} value={form.templateKey} onChange={(event) => setForm((current) => ({ ...current, templateKey: event.target.value }))}>
                {templates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}
              </select>
              {selectedTemplatePreview && <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', maxHeight: 110, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: 10, fontSize: 11, lineHeight: 1.45, color: 'var(--ink-soft)', background: 'var(--surface-soft)' }}>{selectedTemplatePreview}</pre>}
            </label>
            <label>
              <div style={cfgStyles.label}>Destino</div>
              <select style={cfgStyles.field} value={form.destGroupJid} onChange={(event) => handleGroupChange(event.target.value)}>
                <option value="">Selecione um grupo/canal</option>
                {groups.map((group) => <option key={group.id} value={group.waJid}>{group.name}</option>)}
              </select>
            </label>
            <label>
              <div style={cfgStyles.label}>Frequência</div>
              <select style={cfgStyles.field} value={form.intervalMinutes} onChange={(event) => setForm((current) => ({ ...current, intervalMinutes: Number(event.target.value) }))}>
                {INTERVAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <div style={cfgStyles.label}>Produtos por envio</div>
              <select style={cfgStyles.field} value={form.offersPerSend} onChange={(event) => setForm((current) => ({ ...current, offersPerSend: Number(event.target.value) }))}>
                {OFFERS_PER_SEND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <div style={cfgStyles.label}>Desconto mínimo</div>
              <select style={cfgStyles.field} value={form.minDiscountPct} onChange={(event) => setForm((current) => ({ ...current, minDiscountPct: Number(event.target.value) }))}>
                {DISCOUNT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {saveError && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{saveError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" onClick={() => setShowForm(false)} style={mobi.btn('ghost', true)}>Cancelar</button>
              <button type="button" onClick={save} disabled={saving || !canSave} style={{ ...mobi.btn('accent', true), opacity: saving || !canSave ? 0.55 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={cfgStyles.sectionLabel}>Automações cadastradas</div>
      <div style={{ padding: '0 16px 24px', display: 'grid', gap: 10 }}>
        {automations.length === 0 && !showForm ? (
          <div style={{ ...cfgStyles.cardP, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13 }}>Nenhuma automação cadastrada ainda. Crie uma busca, escolha um modelo e teste antes de ativar.</div>
        ) : automations.map((item) => {
          const result = resultById[item.id]
          return (
            <div key={item.id} style={{ ...cfgStyles.cardP, padding: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <button type="button" onClick={() => toggle(item)} disabled={busyId === `toggle-${item.id}`} style={cfgStyles.toggle(Boolean(item.enabled))} aria-label={item.enabled ? 'Pausar automação' : 'Ativar automação'}>
                  <span style={cfgStyles.toggleKnob(Boolean(item.enabled))} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>“{item.keyword}”</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>→ {item.destGroupName || item.destGroupJid}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, lineHeight: 1.45 }}>
                    {optionLabel(INTERVAL_OPTIONS, item.intervalMinutes, `${item.intervalMinutes} min`)} · {optionLabel(OFFERS_PER_SEND_OPTIONS, item.offersPerSend, `${item.offersPerSend} produto(s)`)} · {optionLabel(DISCOUNT_OPTIONS, item.minDiscountPct, `${item.minDiscountPct}% OFF`)} · Modelo: {templateName(templates, item.templateKey || 'automatico_classico')}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>{nextSendLabel(item.lastSentAt, item.intervalMinutes)}</div>
                </div>
              </div>
              <div style={s.cardActions}>
                <button type="button" style={s.actionLink} onClick={() => trigger(item)} disabled={busyId === `trigger-${item.id}`}>{busyId === `trigger-${item.id}` ? 'Enviando...' : 'Enviar agora'}</button>
                <button type="button" style={s.actionLink} onClick={() => openEdit(item)}>Editar</button>
                <button type="button" style={s.dangerLink} onClick={() => setPendingDelete(item)} disabled={busyId === `delete-${item.id}`}>Remover</button>
              </div>
              {result && <div style={s.result(Boolean(result.error))}>{result.error ? `Erro: ${result.error}` : result.skipped ? explainSkip(result.skipped) : `✓ ${result.sent ?? 0} produto(s) enviado(s)`}</div>}
            </div>
          )
        })}
      </div>

      <MobileConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remover automação?"
        message={pendingDelete ? `A automação "${pendingDelete.keyword}" deixará de enviar ofertas automaticamente.` : ''}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        danger
        busy={Boolean(pendingDelete) && busyId === `delete-${pendingDelete.id}`}
        onConfirm={confirmRemove}
        onCancel={() => setPendingDelete(null)}
      />
    </MobileShell>
  )
}
