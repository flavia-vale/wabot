'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

const PIX_KEY_TYPE_LABELS = { cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória' }

function formatCurrency(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function StatusBadge({ status }) {
  if (status === 'approved') return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Aprovado</span>
  if (status === 'rejected') return <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Rejeitado</span>
  return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Pendente</span>
}

function CommissionStatusBadge({ status }) {
  if (status === 'paid') return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Pago</span>
  return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Pendente</span>
}

function CommissionTypeBadge({ type }) {
  if (type === 'recurring') return <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">Recorrente</span>
  return <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">Inicial</span>
}

function RejectModal({ onConfirm, onCancel }) {
  const [notes, setNotes] = useState('')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-base font-bold text-gray-900 mb-3">Rejeitar candidatura</h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Motivo da rejeição (opcional)"
          rows={3}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-red-300 resize-none"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">Cancelar</button>
          <button onClick={() => onConfirm(notes)} className="rounded-lg px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700">Rejeitar</button>
        </div>
      </div>
    </div>
  )
}

function CandidaturesTab() {
  const [profiles, setProfiles] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [actionMessage, setActionMessage] = useState('')

  function loadProfiles() {
    setLoading(true)
    api.adminAffiliates({ status: statusFilter })
      .then(result => { setProfiles(result.profiles ?? []); setLoading(false) })
      .catch(() => { setProfiles([]); setLoading(false) })
  }

  useEffect(() => {
    let active = true
    api.adminAffiliates({ status: statusFilter })
      .then(result => { if (active) { setProfiles(result.profiles ?? []); setLoading(false) } })
      .catch(() => { if (active) { setProfiles([]); setLoading(false) } })
    return () => { active = false }
  }, [statusFilter])

  async function handleApprove(id) {
    setActionMessage('')
    try {
      await api.adminAffiliateApprove(id)
      setActionMessage('Afiliado aprovado.')
      loadProfiles()
    } catch (err) {
      setActionMessage(err.message || 'Erro ao aprovar.')
    }
  }

  async function handleReject(id, notes) {
    setRejectTarget(null)
    setActionMessage('')
    try {
      await api.adminAffiliateReject(id, notes)
      setActionMessage('Candidatura rejeitada.')
      loadProfiles()
    } catch (err) {
      setActionMessage(err.message || 'Erro ao rejeitar.')
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['pending', 'Pendentes'], ['approved', 'Aprovados'], ['rejected', 'Rejeitados'], ['all', 'Todos']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${statusFilter === val ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {actionMessage && <p className="mb-3 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{actionMessage}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 py-4">Carregando...</p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">Nenhum resultado.</p>
      ) : (
        <div className="rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Nome / Email</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Chave PIX</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Candidatura</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {profiles.map(p => (
                <tr key={p.id} className="bg-white">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{p.user?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{p.user?.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">{p.pixKey}</td>
                  <td className="px-4 py-3 text-gray-500">{PIX_KEY_TYPE_LABELS[p.pixKeyType] ?? p.pixKeyType}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(p.appliedAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3">
                    {p.status !== 'approved' && (
                      <button onClick={() => handleApprove(p.id)} className="mr-2 text-xs font-semibold text-emerald-700 hover:underline">Aprovar</button>
                    )}
                    {p.status !== 'rejected' && (
                      <button onClick={() => setRejectTarget(p.id)} className="text-xs font-semibold text-red-600 hover:underline">Rejeitar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          onConfirm={(notes) => handleReject(rejectTarget, notes)}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}

function ApprovedTab() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [overrideEdits, setOverrideEdits] = useState({})
  const [overrideSaving, setOverrideSaving] = useState({})
  const [overrideMsg, setOverrideMsg] = useState({})

  useEffect(() => {
    let active = true
    api.adminAffiliates({ status: 'approved', limit: '100' })
      .then(result => {
        if (!active) return
        const fetched = result.profiles ?? []
        setProfiles(fetched)
        const edits = {}
        fetched.forEach(p => {
          edits[p.id] = {
            pct: p.commissionPercentOverride?.toString() ?? '',
            recurringPct: p.commissionRecurringPercentOverride?.toString() ?? '',
          }
        })
        setOverrideEdits(edits)
        setLoading(false)
      })
      .catch(() => { if (active) { setProfiles([]); setLoading(false) } })
    return () => { active = false }
  }, [])

  async function handleOverrideSave(id) {
    const edit = overrideEdits[id] ?? {}
    setOverrideSaving(prev => ({ ...prev, [id]: true }))
    setOverrideMsg(prev => ({ ...prev, [id]: '' }))
    try {
      await api.adminAffiliateUpdate(id, {
        commissionPercentOverride: edit.pct === '' ? null : Number(edit.pct),
        commissionRecurringPercentOverride: edit.recurringPct === '' ? null : Number(edit.recurringPct),
      })
      setOverrideMsg(prev => ({ ...prev, [id]: 'Salvo.' }))
    } catch (err) {
      setOverrideMsg(prev => ({ ...prev, [id]: err.message || 'Erro ao salvar.' }))
    } finally {
      setOverrideSaving(prev => ({ ...prev, [id]: false }))
    }
  }

  if (loading) return <p className="text-sm text-gray-500 py-4">Carregando...</p>
  if (profiles.length === 0) return <p className="text-sm text-gray-400 py-4">Nenhum afiliado aprovado.</p>

  return (
    <div className="rounded-xl border border-gray-100 overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Nome / Email</th>
            <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Código</th>
            <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Indicados</th>
            <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Comissões pagas</th>
            <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Pendente</th>
            <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Override comissão (%)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {profiles.map(p => (
            <tr key={p.id} className="bg-white">
              <td className="px-4 py-3">
                <p className="font-semibold text-gray-900">{p.user?.name ?? '—'}</p>
                <p className="text-xs text-gray-500">{p.user?.email ?? '—'}</p>
              </td>
              <td className="px-4 py-3 font-mono text-sm text-gray-700">{p.code}</td>
              <td className="px-4 py-3 text-right text-gray-700">{p.totalReferrals}</td>
              <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(p.paidCommissions ?? 0)}</td>
              <td className="px-4 py-3 text-right font-semibold text-amber-700">{formatCurrency(p.pendingCommissions ?? 0)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 w-20 shrink-0">Inicial:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="padrão"
                      value={overrideEdits[p.id]?.pct ?? ''}
                      onChange={e => setOverrideEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], pct: e.target.value } }))}
                      className="border rounded px-2 py-1 text-xs w-20 outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 w-20 shrink-0">Recorrente:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="padrão"
                      value={overrideEdits[p.id]?.recurringPct ?? ''}
                      onChange={e => setOverrideEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], recurringPct: e.target.value } }))}
                      className="border rounded px-2 py-1 text-xs w-20 outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOverrideSave(p.id)}
                      disabled={overrideSaving[p.id]}
                      className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                    >
                      {overrideSaving[p.id] ? 'Salvando...' : 'Salvar'}
                    </button>
                    {overrideMsg[p.id] && (
                      <span className="text-xs text-gray-500">{overrideMsg[p.id]}</span>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CommissionsTab() {
  const [commissions, setCommissions] = useState([])
  const [month, setMonth] = useState(currentMonth)
  const [loading, setLoading] = useState(true)
  const [bulkMessage, setBulkMessage] = useState('')

  function loadCommissions() {
    setLoading(true)
    api.adminAffiliateCommissions({ month })
      .then(result => { setCommissions(result.commissions ?? []); setLoading(false) })
      .catch(() => { setCommissions([]); setLoading(false) })
  }

  useEffect(() => {
    let active = true
    api.adminAffiliateCommissions({ month })
      .then(result => { if (active) { setCommissions(result.commissions ?? []); setLoading(false) } })
      .catch(() => { if (active) { setCommissions([]); setLoading(false) } })
    return () => { active = false }
  }, [month])

  async function handleMarkPaid(id) {
    try {
      await api.adminAffiliateCommissionMarkPaid(id)
      loadCommissions()
    } catch (err) {
      setBulkMessage(err.message || 'Erro ao marcar como pago.')
    }
  }

  async function handleMarkAllPaid() {
    setBulkMessage('')
    try {
      const result = await api.adminAffiliateCycleMarkAllPaid(month)
      setBulkMessage(`${result.updated} comissões marcadas como pagas.`)
      loadCommissions()
    } catch (err) {
      setBulkMessage(err.message || 'Erro ao marcar todas como pagas.')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mês</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <button
          onClick={handleMarkAllPaid}
          className="mt-4 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 transition"
        >
          Marcar mês inteiro como pago
        </button>
      </div>

      {bulkMessage && <p className="mb-3 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{bulkMessage}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 py-4">Carregando...</p>
      ) : commissions.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">Nenhuma comissão neste mês.</p>
      ) : (
        <div className="rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Afiliado</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Indicado</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Plano</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Tipo</th>
                <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Venda</th>
                <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Comissão</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Data</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {commissions.map(c => (
                <tr key={c.id} className="bg-white">
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    <p className="font-semibold">{c.affiliate?.user?.name ?? '—'}</p>
                    <p className="text-gray-400">{c.affiliate?.user?.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    <p>{c.referredUser?.name ?? '—'}</p>
                    <p className="text-gray-400">{c.referredUser?.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.payment?.plan ?? '—'}</td>
                  <td className="px-4 py-3"><CommissionTypeBadge type={c.commissionType} /></td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(c.saleAmountCents)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(c.commissionAmountCents)}</td>
                  <td className="px-4 py-3"><CommissionStatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    {c.status === 'pending' && (
                      <button onClick={() => handleMarkPaid(c.id)} className="text-xs font-semibold text-emerald-700 hover:underline">Pagar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SettingsTab() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [cookieHours, setCookieHours] = useState('')
  const [commissionPct, setCommissionPct] = useState('')
  const [recurringCommissionPct, setRecurringCommissionPct] = useState('')
  const [recurringEnabled, setRecurringEnabled] = useState(true)

  useEffect(() => {
    let active = true
    api.adminAffiliateSettings()
      .then(result => {
        if (!active) return
        setSettings(result)
        setCookieHours(String(result.cookieDurationHours))
        setCommissionPct(String(result.commissionPercent))
        setRecurringCommissionPct(String(result.commissionRecurringPercent ?? 30))
        setRecurringEnabled(result.recurringCommissionEnabled ?? true)
      })
      .catch(() => { if (active) setSettings(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const result = await api.adminAffiliateSettingsUpdate({
        cookieDurationHours: Number(cookieHours),
        commissionPercent: Number(commissionPct),
        commissionRecurringPercent: Number(recurringCommissionPct),
        recurringCommissionEnabled: recurringEnabled,
      })
      setSettings(result)
      setMessage('Configurações salvas.')
    } catch (err) {
      setMessage(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500 py-4">Carregando...</p>

  return (
    <form onSubmit={handleSave} className="max-w-sm flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Duração do cookie (horas)</label>
        <input
          type="number"
          min="1"
          value={cookieHours}
          onChange={e => setCookieHours(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Percentual de comissão inicial (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          value={commissionPct}
          onChange={e => setCommissionPct(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Comissão recorrente (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          value={recurringCommissionPct}
          onChange={e => setRecurringCommissionPct(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="recurringEnabled"
          checked={recurringEnabled}
          onChange={e => setRecurringEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-400"
        />
        <label htmlFor="recurringEnabled" className="text-sm font-medium text-gray-700">Habilitar comissão recorrente</label>
      </div>
      {message && <p className="text-sm text-gray-700">{message}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-emerald-700 transition"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}

const TABS = [
  { key: 'candidatures', label: 'Candidaturas' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'commissions', label: 'Comissões' },
  { key: 'settings', label: 'Configurações' },
]

export default function AdminAffiliatePage() {
  const [isAdmin, setIsAdmin] = useState(undefined)
  const [activeTab, setActiveTab] = useState('candidatures')

  useEffect(() => {
    api.adminMe()
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false))
  }, [])

  if (isAdmin === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <Alert type="error" message="Acesso negado. Esta página é restrita a administradores." />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Admin / Afiliados</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-semibold transition border-b-2 -mb-px ${activeTab === tab.key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'candidatures' && <CandidaturesTab />}
        {activeTab === 'approved' && <ApprovedTab />}
        {activeTab === 'commissions' && <CommissionsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
