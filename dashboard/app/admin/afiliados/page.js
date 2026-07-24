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
  if (status === 'eligible') return <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-sky-700">Elegível</span>
  if (status === 'approved') return <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">Aprovada</span>
  if (status === 'held') return <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">Em análise</span>
  if (status === 'rejected') return <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Rejeitada</span>
  if (status === 'reversed') return <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-bold text-gray-600">Revertida</span>
  return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Pendente</span>
}

function CommissionTypeBadge({ type }) {
  if (type === 'recurring') return <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">Recorrente</span>
  return <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">Inicial</span>
}

const ACCESS_STATUS_BADGES = {
  active: { label: 'Ativo', cls: 'bg-emerald-100 text-emerald-700' },
  trial: { label: 'Trial', cls: 'bg-sky-100 text-sky-700' },
  awaiting_subscription: { label: 'Aguardando assinatura', cls: 'bg-indigo-100 text-indigo-700' },
  referral_expired: { label: 'Indicação vencida', cls: 'bg-gray-200 text-gray-600' },
  expired: { label: 'Expirado', cls: 'bg-gray-200 text-gray-600' },
  banned: { label: 'Banido', cls: 'bg-red-100 text-red-700' },
  suspended: { label: 'Suspenso', cls: 'bg-orange-100 text-orange-700' },
}

// Deriva a situação a partir dos campos crus (usado na aba Comissões, que não
// recebe accessStatus pronto do backend). Espelha resolveAccessStatus do service.
function deriveAccessStatus(user) {
  if (!user) return 'expired'
  if (user.status === 'banned' || user.status === 'suspended') return user.status
  if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) return 'expired'
  if (user.plan === 'trial') return 'trial'
  return 'active'
}

function AccessStatusBadge({ status }) {
  const cfg = ACCESS_STATUS_BADGES[status] ?? ACCESS_STATUS_BADGES.expired
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${cfg.cls}`}>{cfg.label}</span>
}

function ReferralsModal({ affiliate, onClose }) {
  const [data, setData] = useState(undefined)

  useEffect(() => {
    let active = true
    api.adminAffiliateReferrals(affiliate.id, { limit: '100' })
      .then(result => { if (active) setData(result) })
      .catch(() => { if (active) setData(null) })
    return () => { active = false }
  }, [affiliate.id])

  const referrals = data?.referrals ?? []

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Indicados de {affiliate.user?.name ?? affiliate.code}</h2>
            <p className="text-xs text-gray-500">Código <span className="font-mono">{affiliate.code}</span> · {affiliate.user?.email ?? ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-auto p-4">
          {data === undefined ? (
            <p className="text-sm text-gray-500 py-4">Carregando...</p>
          ) : referrals.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">Nenhum cliente se cadastrou com este código ainda.</p>
          ) : (
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Cliente</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Cadastro</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Situação</th>
                  <th className="text-right px-3 py-2 text-xs font-bold text-gray-500 uppercase">Pagamentos</th>
                  <th className="text-right px-3 py-2 text-xs font-bold text-gray-500 uppercase">Total pago</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Último pgto</th>
                  <th className="text-right px-3 py-2 text-xs font-bold text-gray-500 uppercase">Comissão gerada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {referrals.map(r => (
                  <tr key={r.userId} className="bg-white">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-gray-900">{r.name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{r.email ?? '—'}</p>
                      {r.contactPhone && <p className="text-xs text-gray-400">{r.contactPhone}</p>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">{formatDate(r.createdAt)}</td>
                    <td className="px-3 py-3"><AccessStatusBadge status={r.referralStatus} /></td>
                    <td className="px-3 py-3 text-right text-gray-700">{r.paymentCount}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{formatCurrency(r.totalPaidCents ?? 0)}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{r.lastPaymentAt ? formatDate(r.lastPaymentAt) : '—'}</td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900">{formatCurrency(r.commissionTotalCents ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
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
  const [referralsTarget, setReferralsTarget] = useState(null)

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
    <>
    <p className="mb-3 text-xs text-gray-500">Clique no número de indicados para ver quem se cadastrou com o código do afiliado.</p>
    <div className="rounded-xl border border-gray-100 overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Nome / Email</th>
            <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Código</th>
            <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Indicados</th>
            <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Comissões pagas</th>
            <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Pendente</th>
            <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Devedor</th>
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
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => setReferralsTarget(p)}
                  disabled={!p.totalReferrals}
                  className="font-semibold text-emerald-700 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-default"
                >
                  {p.totalReferrals}
                </button>
              </td>
              <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(p.paidCommissions ?? 0)}</td>
              <td className="px-4 py-3 text-right font-semibold text-amber-700">{formatCurrency(p.pendingCommissions ?? 0)}</td>
              <td className="px-4 py-3 text-right font-semibold text-red-700">{(p.debtCents ?? 0) > 0 ? formatCurrency(p.debtCents) : '—'}</td>
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
    {referralsTarget && <ReferralsModal affiliate={referralsTarget} onClose={() => setReferralsTarget(null)} />}
    </>
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

  async function handleApprove(id) {
    setBulkMessage('')
    try {
      await api.adminAffiliateCommissionApprove(id)
      loadCommissions()
    } catch (err) {
      setBulkMessage(err.message || 'Erro ao aprovar comissão.')
    }
  }

  async function handleReverse(id) {
    setBulkMessage('')
    const reason = window.prompt('Motivo da reversão (ex.: chargeback, reembolso, fraude confirmada)')
    if (!reason) return
    try {
      await api.adminAffiliateCommissionReverse(id, reason)
      loadCommissions()
    } catch (err) {
      setBulkMessage(err.message || 'Erro ao reverter comissão.')
    }
  }

  async function handleMarkPaid(id) {
    setBulkMessage('')
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
      setBulkMessage(`${result.updated} comissões elegíveis marcadas como pagas.`)
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
          Pagar elegíveis do mês
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
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Criada</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Elegível em</th>
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
                    <span className="inline-block mt-1"><AccessStatusBadge status={deriveAccessStatus(c.referredUser)} /></span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.payment?.plan ?? '—'}</td>
                  <td className="px-4 py-3"><CommissionTypeBadge type={c.commissionType} /></td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(c.saleAmountCents)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(c.commissionAmountCents)}</td>
                  <td className="px-4 py-3">
                    <CommissionStatusBadge status={c.status} />
                    {c.holdReason && <p className="mt-1 text-[11px] text-orange-700">{c.holdReason}</p>}
                    {c.reversalReason && <p className="mt-1 text-[11px] text-gray-500">{c.reversalReason}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.eligibleAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      {['held', 'eligible'].includes(c.status) && (
                        <button onClick={() => handleApprove(c.id)} className="text-xs font-semibold text-sky-700 hover:underline">Aprovar</button>
                      )}
                      {['eligible', 'approved'].includes(c.status) && (
                        <button onClick={() => handleMarkPaid(c.id)} className="text-xs font-semibold text-emerald-700 hover:underline">Pagar</button>
                      )}
                      {['pending', 'eligible', 'approved', 'held'].includes(c.status) && (
                        <button onClick={() => handleReverse(c.id)} className="text-xs font-semibold text-red-700 hover:underline">Reverter</button>
                      )}
                    </div>
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

const PAYOUT_STATUS_BADGES = {
  requested: { label: 'Em análise', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Recusado', cls: 'bg-red-100 text-red-700' },
}

function PayoutRequestBadge({ status }) {
  const cfg = PAYOUT_STATUS_BADGES[status] ?? PAYOUT_STATUS_BADGES.requested
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${cfg.cls}`}>{cfg.label}</span>
}

// T022 (009-affiliate-improvements-r1, US2): fila admin de solicitações de
// saque, com ações de confirmar (comissões viram paid + auditoria) e recusar
// (exige motivo; saldo do afiliado permanece disponível).
function PayoutRequestsTab() {
  const [status, setStatus] = useState('requested')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)

  function loadRequests() {
    setLoading(true)
    api.adminAffiliatePayoutRequests({ status })
      .then(result => { setRequests(result.requests ?? []); setLoading(false) })
      .catch(() => { setRequests([]); setLoading(false) })
  }

  useEffect(() => {
    let active = true
    api.adminAffiliatePayoutRequests({ status })
      .then(result => { if (active) { setRequests(result.requests ?? []); setLoading(false) } })
      .catch(() => { if (active) { setRequests([]); setLoading(false) } })
    return () => { active = false }
  }, [status])

  async function handleConfirm(id) {
    setMessage('')
    setBusyId(id)
    try {
      await api.adminAffiliatePayoutConfirm(id)
      setMessage('Saque confirmado: comissões marcadas como pagas.')
      loadRequests()
    } catch (err) {
      setMessage(err.message || 'Erro ao confirmar saque.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(id, reason) {
    setRejectTarget(null)
    setMessage('')
    setBusyId(id)
    try {
      await api.adminAffiliatePayoutReject(id, reason)
      setMessage('Solicitação de saque recusada.')
      loadRequests()
    } catch (err) {
      setMessage(err.message || 'Erro ao recusar saque.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['requested', 'Em análise'], ['paid', 'Pagos'], ['rejected', 'Recusados'], ['all', 'Todos']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatus(val)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${status === val ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p className="mb-3 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{message}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 py-4">Carregando...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">Nenhuma solicitação de saque nesta situação.</p>
      ) : (
        <div className="rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Afiliado</th>
                <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Valor</th>
                <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Devedor</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Solicitado em</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map(r => (
                <tr key={r.id} className="bg-white">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.affiliateCode ?? r.affiliateId}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(r.amountCents)}</td>
                  <td className="px-4 py-3 text-right text-red-700">{(r.debtCents ?? 0) > 0 ? formatCurrency(r.debtCents) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r.requestedAt)}</td>
                  <td className="px-4 py-3"><PayoutRequestBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    {r.status === 'requested' && (
                      <div className="flex flex-col items-start gap-1">
                        <button onClick={() => handleConfirm(r.id)} disabled={busyId === r.id} className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50">Confirmar</button>
                        <button onClick={() => setRejectTarget(r.id)} disabled={busyId === r.id} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">Recusar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectTarget && (
        <RejectPayoutModal
          onConfirm={(reason) => handleReject(rejectTarget, reason)}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}

function RejectPayoutModal({ onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function handleConfirm() {
    if (!reason.trim()) return setError('Motivo é obrigatório')
    onConfirm(reason.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-base font-bold text-gray-900 mb-3">Recusar solicitação de saque</h2>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Motivo da recusa (obrigatório, ex.: chave PIX inválida)"
          rows={3}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-red-300 resize-none"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">Cancelar</button>
          <button onClick={handleConfirm} className="rounded-lg px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700">Recusar</button>
        </div>
      </div>
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
  const [holdDays, setHoldDays] = useState('')
  const [attributionWindowDays, setAttributionWindowDays] = useState('')
  const [minPayoutCents, setMinPayoutCents] = useState('')
  const [orphanTouchWindowDays, setOrphanTouchWindowDays] = useState('')
  const [orphanTouchMode, setOrphanTouchMode] = useState('both')
  const [payoutRequestsEnabled, setPayoutRequestsEnabled] = useState(true)

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
        setHoldDays(String(result.commissionHoldDays ?? 30))
        setAttributionWindowDays(String(result.attributionWindowDays ?? 30))
        setMinPayoutCents(String(result.minPayoutCents ?? 5000))
        setOrphanTouchWindowDays(String(result.orphanTouchWindowDays ?? 7))
        setOrphanTouchMode(result.orphanTouchMode ?? 'both')
        setPayoutRequestsEnabled(result.payoutRequestsEnabled ?? true)
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
        commissionHoldDays: Number(holdDays),
        attributionWindowDays: Number(attributionWindowDays),
        attributionModel: 'last_non_direct',
        minPayoutCents: Number(minPayoutCents),
        orphanTouchWindowDays: Number(orphanTouchWindowDays),
        orphanTouchMode,
        payoutRequestsEnabled,
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hold de comissão (dias)</label>
        <input
          type="number"
          min="0"
          max="365"
          value={holdDays}
          onChange={e => setHoldDays(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <p className="mt-1 text-xs text-gray-500">Comissões ficam pendentes até esta janela passar, para reduzir risco de reembolso/chargeback.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Janela de atribuição (dias)</label>
        <input
          type="number"
          min="1"
          max="365"
          value={attributionWindowDays}
          onChange={e => setAttributionWindowDays(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <p className="mt-1 text-xs text-gray-500">Modelo atual: último clique não-direto, congelado no pagamento.</p>
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

      <hr className="border-gray-100" />
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Saque self-service (US2)</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Valor mínimo de saque (R$)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={minPayoutCents === '' ? '' : (Number(minPayoutCents) / 100).toString()}
          onChange={e => setMinPayoutCents(String(Math.round(Number(e.target.value || 0) * 100)))}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="payoutRequestsEnabled"
          checked={payoutRequestsEnabled}
          onChange={e => setPayoutRequestsEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-400"
        />
        <label htmlFor="payoutRequestsEnabled" className="text-sm font-medium text-gray-700">Habilitar solicitação de saque pelo afiliado</label>
      </div>

      <hr className="border-gray-100" />
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Atribuição órfã por dispositivo (US4)</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Janela de atribuição órfã (dias)</label>
        <input
          type="number"
          min="1"
          max="365"
          value={orphanTouchWindowDays}
          onChange={e => setOrphanTouchWindowDays(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Modo de atribuição órfã</label>
        <select
          value={orphanTouchMode}
          onChange={e => setOrphanTouchMode(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="off">Desligado (comportamento legado, 30 dias)</option>
          <option value="window">Só janela (sem hold)</option>
          <option value="hold">Só hold (sem restringir janela)</option>
          <option value="both">Janela + hold (padrão seguro)</option>
        </select>
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
  { key: 'payouts', label: 'Saques' },
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
        {activeTab === 'payouts' && <PayoutRequestsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
