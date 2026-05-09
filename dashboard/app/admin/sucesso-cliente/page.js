'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const DAY_MS = 24 * 60 * 60 * 1000
const CS_ALLOWED_EMAILS = ['flavia.vale@usp.br', 'flaviaroberta.1496@gmail.com', 'tacianeaas02@gmail.com']
const CS_PERMISSION_KEYS = ['customer_success', 'customer_success_ops', 'success']
const resolveAdminEmail = (admin) => String(admin?.email || admin?.user?.email || admin?.profile?.email || '').toLowerCase().trim()
const toDate = value => { const d = value ? new Date(value) : null; return d && !Number.isNaN(d.getTime()) ? d : null }
const daysUntil = value => { const d = toDate(value); return d ? Math.ceil((d.getTime() - Date.now()) / DAY_MS) : null }
const formatDate = value => { const d = toDate(value); return d ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d) : '—' }
const normalizePhone = phone => String(phone || '').replace(/\D/g, '')
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

export default function CustomerSuccessPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [admin, setAdmin] = useState(null)
  const [query, setQuery] = useState('')
  const [modalUser, setModalUser] = useState(null)
  const [newExpiry, setNewExpiry] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  async function loadUsers(search = query) {
    const data = await api.adminUsers({ limit: 200, search })
    setUsers(data?.users ?? [])
  }

  useEffect(() => {
    api.adminMe()
      .then(data => setAdmin(data))
      .catch(err => setError(err.message || 'Falha ao validar sessão.'))
      .finally(() => setLoading(false))
  }, [])

  const hasCustomerSuccessAccess = useMemo(() => {
    const email = resolveAdminEmail(admin)
    const permissions = Array.isArray(admin?.permissions) ? admin.permissions : []
    const hasPermission = permissions.some(permission => CS_PERMISSION_KEYS.includes(String(permission).toLowerCase().trim()))
    return CS_ALLOWED_EMAILS.includes(email) || hasPermission || admin?.role === 'owner'
  }, [admin])

  useEffect(() => {
    if (!admin || !hasCustomerSuccessAccess) return
    loadUsers().catch(err => setError(err.message || 'Erro ao carregar clientes.'))
  }, [admin, hasCustomerSuccessAccess])

  const prioritizedUsers = useMemo(() => [...users].sort((a, b) => (daysUntil(a.accessExpiresAt) ?? 99) - (daysUntil(b.accessExpiresAt) ?? 99)), [users])
  const metrics = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.accessStatus === 'active').length,
    expired: users.filter(u => u.accessStatus !== 'active').length,
    exp3: users.filter(u => { const d = daysUntil(u.accessExpiresAt); return d !== null && d >= 0 && d <= 3 }).length,
    exp7: users.filter(u => { const d = daysUntil(u.accessExpiresAt); return d !== null && d >= 0 && d <= 7 }).length,
  }), [users])

  async function handleAdjustValidity() {
    if (!modalUser || !newExpiry || adjustReason.trim().length < 5) return
    setSaving(true)
    try {
      await api.adminUpdateAccess(modalUser.id, { expiresAt: new Date(newExpiry).toISOString(), reason: adjustReason.trim() })
      setModalUser(null)
      setAdjustReason('')
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Falha ao ajustar validade.')
    } finally {
      setSaving(false)
    }
  }

  async function openUserDetail(id) {
    try {
      setSelectedUser(await api.adminUserDetail(id))
    } catch (err) {
      setError(err.message || 'Falha ao carregar detalhes do cliente.')
    }
  }

  if (loading) return <LoadingState />
  if (!admin) return <main className="min-h-screen bg-gray-50 p-6"><Alert type="error" title="Sucesso do Cliente" message={error || 'Sessão inválida. Faça login novamente.'} /></main>
  if (!hasCustomerSuccessAccess) return <main className="min-h-screen bg-gray-50 p-6"><Alert type="warning" title="Acesso restrito" message="A aba Sucesso do Cliente é exclusiva para usuários com esta permissão." /><div className="mt-4"><Link href="/admin" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200">Voltar ao Admin</Link></div></main>

  return <main className="min-h-screen bg-gray-50 px-5 py-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Admin · Sucesso do Cliente</p><h1 className="text-3xl font-black text-gray-900">Sucesso do Cliente</h1></div><div className="flex gap-2"><button onClick={() => loadUsers().catch(err => setError(err.message || 'Erro ao atualizar.'))} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Atualizar</button><Link href="/admin" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200">Admin original</Link></div></header>
    {error && <Alert type="error" title="Sucesso do Cliente" message={error} />}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[['Clientes totais', metrics.total], ['Churn Risk · 3 dias', metrics.exp3], ['Churn Risk · 7 dias', metrics.exp7], ['Health Score · Ativos', metrics.active], ['Health Score · Expirados', metrics.expired]].map(([label, value]) => <article key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"><p className="text-xs text-gray-400">{label}</p><p className="text-2xl font-black">{value}</p></article>)}</section>
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-black text-gray-900">Fila priorizada para contato</h2><form onSubmit={e => { e.preventDefault(); loadUsers(query).catch(err => setError(err.message || 'Erro ao buscar.')) }} className="flex gap-2"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome/e-mail" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" /><button className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">Buscar</button></form></div>
    <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Telefone</th><th className="px-3 py-2">Plano</th><th className="px-3 py-2">Operação</th><th className="px-3 py-2">Atividade</th><th className="px-3 py-2">Já enviou?</th><th className="px-3 py-2">Riscos</th><th className="px-3 py-2">Validade</th><th className="px-3 py-2">LTV inicial</th><th className="px-3 py-2">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{prioritizedUsers.map(user => { const phone = normalizePhone(user.contactPhone); const remaining = daysUntil(user.accessExpiresAt); const alreadySent = Number(user.successCount ?? 0) > 0; return <tr key={user.id} className="align-top"><td className="px-3 py-3 font-semibold text-gray-900">{user.name || 'Sem nome'}</td><td className="px-3 py-3">{user.email}</td><td className="px-3 py-3">{user.contactPhone || 'Sem celular'}</td><td className="px-3 py-3 text-xs"><p className="font-semibold">{user.plan}</p><p className="text-gray-500">{user.accessStatus}</p></td><td className="px-3 py-3 text-xs text-gray-600"><p>Bot: {user.botRunning ? 'rodando' : 'parado'}</p><p>WA: {user.waSession?.status || '—'}</p><p>Origem/Destino: {user.groupCounts?.monitor ?? 0}/{user.groupCounts?.post ?? 0}</p></td><td className="px-3 py-3 text-xs text-gray-600"><p>Última: {formatDate(user.lastActivityAt)}</p><p>Erros 24h: {user.errorCount24h ?? 0}</p></td><td className="px-3 py-3 text-xs">{alreadySent ? <span className="rounded-full bg-green-100 px-2 py-1 font-bold text-green-700">Sim ({user.successCount})</span> : <span className="rounded-full bg-red-600 px-2 py-1 font-bold text-white">NÃO ENVIOU</span>}</td><td className="px-3 py-3 text-xs">{(user.riskFlags?.length ? user.riskFlags : ['ok']).slice(0, 4).map(flag => <span key={flag} className={`mb-1 mr-1 inline-block rounded-full px-2 py-1 text-[11px] font-bold ${flag === 'ok' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{flag === 'ok' ? 'OK' : (RISK_LABELS[flag] || flag)}</span>)}</td><td className="px-3 py-3 text-xs"><p>{formatDate(user.accessExpiresAt)}</p><p className={remaining !== null && remaining <= 3 ? 'text-red-600' : 'text-gray-500'}>{remaining === null ? 'Sem data' : `${remaining} dias`}</p></td><td className="px-3 py-3">{user.daysSinceCreated ?? '—'} dias</td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><a href={phone ? `https://wa.me/${phone}` : undefined} target="_blank" rel="noreferrer" className={`rounded-lg px-3 py-2 text-xs font-bold ${phone ? 'bg-green-600 text-white' : 'pointer-events-none bg-gray-200 text-gray-500'}`}>WhatsApp</a><button onClick={() => openUserDetail(user.id)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Drill-down</button><button onClick={() => { setModalUser(user); setAdjustReason('Ajuste manual CS Ops'); setNewExpiry(user.accessExpiresAt ? new Date(user.accessExpiresAt).toISOString().slice(0, 16) : '') }} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-700">Ajustar validade</button></div></td></tr> })}</tbody></table></div></section>
    {selectedUser && <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-black text-gray-900">Drill-down do cliente</h3><button onClick={() => setSelectedUser(null)} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600">Fechar</button></div><p className="text-sm text-gray-600">{selectedUser.email} · {selectedUser.contactPhone || 'Sem celular'} · {selectedUser.plan}</p><div className="mt-3 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Última atividade</p><p className="font-bold">{formatDate(selectedUser.lastActivityAt)}</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Expiração</p><p className="font-bold">{formatDate(selectedUser.accessExpiresAt)}</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Erros 24h</p><p className="font-bold">{selectedUser.errorCount24h ?? 0}</p></div></div></section>}
    {modalUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-black text-gray-900">Confirmar ajuste de validade</h3><p className="mt-2 text-sm text-gray-600">Você tem certeza que deseja alterar o tempo de contrato deste cliente?</p><input type="datetime-local" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" /><textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Motivo do ajuste (mínimo 5 caracteres)" className="mt-3 min-h-20 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => { setModalUser(null); setAdjustReason('') }} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">Cancelar</button><button disabled={saving || !newExpiry || adjustReason.trim().length < 5} onClick={handleAdjustValidity} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar ajuste'}</button></div></div></div>}
  </div></main>
}
