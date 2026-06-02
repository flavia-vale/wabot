'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileRoutes } from '@/components/mobile/routes'
import { api } from '@/lib/api'

const INTERVAL_OPTIONS = [
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [resultById, setResultById] = useState({})

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [list, allGroups] = await Promise.all([
        api.offerAutomations(),
        api.groups().then((items) => Array.isArray(items) ? items.filter((group) => group.role === 'post') : []),
      ])
      setAutomations(Array.isArray(list) ? list : [])
      setGroups(allGroups)
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

  async function remove(item) {
    if (!window.confirm(`Remover automação "${item.keyword}"?`)) return
    setBusyId(`delete-${item.id}`)
    setError('')
    try {
      await api.offerAutomationDelete(item.id)
      await load()
    } catch (err) {
      setError(err.message || 'Não foi possível remover.')
    } finally {
      setBusyId('')
    }
  }

  if (loading) return <MobileShell title="Automações" active="espelhar" showBack onBack={() => router.back()}><div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando automações..." /></div></MobileShell>
  if (error && automations.length === 0) return <MobileShell title="Automações" active="espelhar" showBack onBack={() => router.back()}><div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div></MobileShell>

  const canSave = form.keyword.trim() && form.destGroupJid

  return (
    <MobileShell title="Automações" active="espelhar" showBack onBack={() => router.back()}>
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Operação automática</div>
        <div style={cfgStyles.pageTitle}>Ofertas automáticas</div>
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>Configure buscas recorrentes e envie promoções automaticamente para seus destinos.</div>
          <button type="button" onClick={openCreate} style={mobi.btn('accent', true)}>+ Nova automação</button>
          <button type="button" onClick={() => router.push(mobileRoutes.accountVariations)} style={mobi.btn('ghost', true)}>Editar ganchos e CTAs</button>
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
          <div style={{ ...cfgStyles.cardP, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13 }}>Nenhuma automação cadastrada ainda.</div>
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
                    {optionLabel(INTERVAL_OPTIONS, item.intervalMinutes, `${item.intervalMinutes} min`)} · {optionLabel(OFFERS_PER_SEND_OPTIONS, item.offersPerSend, `${item.offersPerSend} produto(s)`)} · {optionLabel(DISCOUNT_OPTIONS, item.minDiscountPct, `${item.minDiscountPct}% OFF`)}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>{nextSendLabel(item.lastSentAt, item.intervalMinutes)}</div>
                </div>
              </div>
              <div style={s.cardActions}>
                <button type="button" style={s.actionLink} onClick={() => trigger(item)} disabled={busyId === `trigger-${item.id}`}>{busyId === `trigger-${item.id}` ? 'Enviando...' : 'Enviar agora'}</button>
                <button type="button" style={s.actionLink} onClick={() => openEdit(item)}>Editar</button>
                <button type="button" style={s.dangerLink} onClick={() => remove(item)} disabled={busyId === `delete-${item.id}`}>Remover</button>
              </div>
              {result && <div style={s.result(Boolean(result.error))}>{result.error ? `Erro: ${result.error}` : result.skipped ? explainSkip(result.skipped) : `✓ ${result.sent ?? 0} produto(s) enviado(s)`}</div>}
            </div>
          )
        })}
      </div>
    </MobileShell>
  )
}
