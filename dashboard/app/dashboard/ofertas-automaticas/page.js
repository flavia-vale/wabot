'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/States'
import { Alert } from '@/components/Alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const INTERVAL_OPTIONS = [
  { value: 60,   label: 'A cada 1 hora' },
  { value: 120,  label: 'A cada 2 horas' },
  { value: 240,  label: 'A cada 4 horas' },
  { value: 360,  label: 'A cada 6 horas' },
  { value: 720,  label: 'A cada 12 horas' },
  { value: 1440, label: 'Uma vez por dia' },
]

const DISCOUNT_OPTIONS = [
  { value: 0,  label: 'Qualquer produto em oferta' },
  { value: 10, label: 'Pelo menos 10% de desconto' },
  { value: 20, label: 'Pelo menos 20% de desconto (recomendado)' },
  { value: 30, label: 'Pelo menos 30% de desconto' },
  { value: 50, label: 'Só promoções acima de 50% (as maiores ofertas)' },
]

const OFFERS_PER_SEND_OPTIONS = [
  { value: 1, label: '1 produto por envio' },
  { value: 2, label: '2 produtos por envio' },
  { value: 3, label: '3 produtos por envio' },
]

const emptyForm = {
  destGroupJid: '',
  destGroupName: '',
  keyword: '',
  intervalMinutes: 240,
  offersPerSend: 1,
  minDiscountPct: 20,
}

function nextSendLabel(lastSentAt, intervalMinutes) {
  if (!lastSentAt) return 'Próximo envio: assim que o bot estiver ativo'
  const next = new Date(new Date(lastSentAt).getTime() + intervalMinutes * 60_000)
  const now = new Date()
  if (next <= now) return 'Próximo envio: em breve'
  const diff = Math.round((next - now) / 60_000)
  if (diff < 60) return `Próximo envio: em ${diff} min`
  return `Próximo envio: em ${Math.round(diff / 60)}h`
}

export default function OfertasAutomaticasPage() {
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(true)
  const [waGroups, setWaGroups] = useState([])
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
      const [list, groups] = await Promise.all([
        api.offerAutomations(),
        api.groups().then(gs => gs.filter(g => g.role === 'post')),
      ])
      setAutomations(list)
      setWaGroups(groups)
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
      intervalMinutes: a.intervalMinutes,
      offersPerSend: a.offersPerSend,
      minDiscountPct: a.minDiscountPct,
    })
    setSaveError('')
    setShowForm(true)
  }

  function handleGroupChange(jid) {
    const g = waGroups.find(g => g.waJid === jid)
    setForm(f => ({ ...f, destGroupJid: jid, destGroupName: g?.name ?? jid }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      if (editId) {
        await api.offerAutomationUpdate(editId, form)
      } else {
        await api.offerAutomationCreate(form)
      }
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
    setTriggerResult(r => ({ ...r, [a.id]: null }))
    try {
      const res = await api.offerAutomationTrigger(a.id)
      setTriggerResult(r => ({ ...r, [a.id]: res.result }))
      await load()
    } catch (err) {
      setTriggerResult(r => ({ ...r, [a.id]: { error: err.message } }))
    } finally {
      setTriggering(null)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ofertas automáticas</h1>
          <p className="text-sm text-gray-500 mt-1">
            O bot busca promoções na Shopee e envia automaticamente para seus grupos.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          + Nova automação
        </button>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 flex items-center justify-between text-sm">
        <span className="text-gray-600">🎲 Quer que cada mensagem saia diferente? Configure ganchos e CTAs.</span>
        <Link href="/dashboard/variacoes-de-texto" className="text-green-700 font-medium hover:underline shrink-0 ml-4">
          Editar ganchos e CTAs →
        </Link>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {!automations.length && !showForm && (
        <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed rounded-lg">
          Nenhuma automação configurada ainda.<br />
          Clique em <strong>+ Nova automação</strong> para começar.
        </div>
      )}

      {showForm && (
        <div className="border rounded-lg p-4 bg-white space-y-4">
          <h2 className="font-semibold text-gray-800">{editId ? 'Editar automação' : 'Nova automação'}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              O que você quer vender?
            </label>
            <input
              type="text"
              value={form.keyword}
              onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
              placeholder="Ex: decoração de festas, eletrônicos, moda feminina"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">Use palavras que descrevem o tipo de produto.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enviar para qual grupo?
            </label>
            <select
              value={form.destGroupJid}
              onChange={e => handleGroupChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Selecione um grupo</option>
              {waGroups.map(g => (
                <option key={g.id} value={g.waJid}>{g.name}</option>
              ))}
            </select>
            {!waGroups.length && (
              <p className="text-xs text-orange-500 mt-1">
                Nenhum grupo de destino cadastrado. Vá em Grupos e Canais para adicionar.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Com que frequência enviar?
            </label>
            <select
              value={form.intervalMinutes}
              onChange={e => setForm(f => ({ ...f, intervalMinutes: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {INTERVAL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantos produtos enviar de uma vez?
            </label>
            <select
              value={form.offersPerSend}
              onChange={e => setForm(f => ({ ...f, offersPerSend: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {OFFERS_PER_SEND_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Qual o desconto mínimo para enviar?
            </label>
            <select
              value={form.minDiscountPct}
              onChange={e => setForm(f => ({ ...f, minDiscountPct: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {DISCOUNT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Só produtos com desconto real serão enviados.</p>
          </div>

          {saveError && <Alert type="error">{saveError}</Alert>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.keyword.trim() || !form.destGroupJid}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {automations.map(a => {
          const result = triggerResult[a.id]
          return (
            <div key={a.id} className="border rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">&ldquo;{a.keyword}&rdquo;</p>
                  <p className="text-sm text-gray-500">→ {a.destGroupName}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {INTERVAL_OPTIONS.find(o => o.value === a.intervalMinutes)?.label ?? `${a.intervalMinutes} min`}
                    {' · '}
                    {OFFERS_PER_SEND_OPTIONS.find(o => o.value === a.offersPerSend)?.label ?? `${a.offersPerSend} produto(s)`}
                    {' · '}
                    {DISCOUNT_OPTIONS.find(o => o.value === a.minDiscountPct)?.label ?? `${a.minDiscountPct}% OFF mín.`}
                  </p>
                  <p className="text-xs text-gray-400">{nextSendLabel(a.lastSentAt, a.intervalMinutes)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(a)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${a.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    title={a.enabled ? 'Pausar' : 'Ativar'}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${a.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <button
                    onClick={() => handleTrigger(a)}
                    disabled={triggering === a.id}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    title="Enviar agora (teste)"
                  >
                    {triggering === a.id ? 'Enviando...' : 'Enviar agora'}
                  </button>
                  <button onClick={() => openEdit(a)} className="text-xs text-gray-500 hover:underline">Editar</button>
                  <button onClick={() => setDeleteTarget(a)} className="text-xs text-red-500 hover:underline">Remover</button>
                </div>
              </div>
              {result && (
                <p className={`text-xs mt-2 ${result.error ? 'text-red-500' : 'text-green-600'}`}>
                  {result.error
                    ? `Erro: ${result.error}`
                    : result.skipped
                      ? `Ignorado: ${result.skipped}`
                      : `✓ ${result.sent} produto(s) enviado(s)`}
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
