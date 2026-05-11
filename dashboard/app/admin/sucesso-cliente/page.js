'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const DAY_MS = 24 * 60 * 60 * 1000
const CS_ALLOWED_EMAILS = ['flavia.vale@usp.br', 'flaviaroberta.1496@gmail.com', 'tacianeaas02@gmail.com']
const CS_PERMISSION_KEYS = ['customer_success', 'customer_success_ops', 'success']
const resolveAdminEmail = admin => String(admin?.email || admin?.user?.email || admin?.profile?.email || '').toLowerCase().trim()
const toDate = value => { const d = value ? new Date(value) : null; return d && !Number.isNaN(d.getTime()) ? d : null }
const daysUntil = value => { const d = toDate(value); return d ? Math.ceil((d.getTime() - Date.now()) / DAY_MS) : null }
const formatDate = value => { const d = toDate(value); return d ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d) : '—' }
const normalizePhone = phone => String(phone || '').replace(/\D/g, '')
const normalizeSessionStatus = status => String(status || '').toLowerCase().trim()
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

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

const DRILL_FILTERS = {
  all: { label: 'Todos', apply: () => true },
  risky: { label: 'Com risco', apply: user => Number(user?.riskFlags?.length || 0) > 0 },
  wa_disconnected: { label: 'WhatsApp desconectado', apply: user => normalizeSessionStatus(user?.waSession?.status) !== 'connected' },
  payment_pending: { label: 'Pagamento pendente', apply: user => String(user?.accessStatus || '').toLowerCase() !== 'active' },
  no_first_success: { label: 'Sem primeiro envio', apply: user => Number(user?.successCount || 0) === 0 },
  high_errors: { label: 'Erros 24h > 5', apply: user => Number(user?.errorCount24h || 0) > 5 },
}

function getHealthScore(user) {
  let score = 100
  if (!user?.botRunning) score -= 25
  if (normalizeSessionStatus(user?.waSession?.status) !== 'connected') score -= 25
  if (Number(user?.errorCount24h || 0) > 5) score -= 15
  if (Number(user?.successCount || 0) === 0) score -= 20
  const remaining = daysUntil(user?.accessExpiresAt)
  if (remaining !== null && remaining <= 3) score -= 15
  if (!user?.contactPhone) score -= 10
  return clamp(score, 0, 100)
}

function getHealthTone(score) {
  if (score >= 80) return 'green'
  if (score >= 50) return 'yellow'
  return 'red'
}

function toneClasses(tone) {
  if (tone === 'green') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (tone === 'yellow') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-red-50 text-red-700 ring-red-200'
}

function StatCard({ label, value, hint, tone = 'green', onClick, active = false }) {
  const clickable = typeof onClick === 'function'
  return (
    <article
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? event => { if (event.key === 'Enter' || event.key === ' ') onClick() } : undefined}
      className={`rounded-2xl p-4 shadow-sm ring-1 ${toneClasses(tone)} ${clickable ? 'cursor-pointer transition hover:opacity-90' : ''} ${active ? 'ring-2 ring-offset-1' : ''}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-80">{hint}</p>}
    </article>
  )
}

function ActionAlertBanner({ users, onFilterSelect }) {
  const waDisconnected = users.filter(user => normalizeSessionStatus(user?.waSession?.status) !== 'connected').length
  const paymentPending = users.filter(user => String(user?.accessStatus || '').toLowerCase() !== 'active').length
  const highErrors = users.filter(user => Number(user?.errorCount24h || 0) > 5).length

  const hasCritical = waDisconnected > 0 || highErrors > 0
  return (
    <section className={`rounded-2xl p-4 ring-1 shadow-sm ${hasCritical ? 'bg-gradient-to-r from-red-50 to-rose-50 ring-red-200' : 'bg-gradient-to-r from-emerald-50 to-green-50 ring-emerald-200'}`}>
      <p className={`text-xs font-black uppercase tracking-wide ${hasCritical ? 'text-red-700' : 'text-emerald-700'}`}>
        {hasCritical ? 'Atenção operacional imediata' : 'Operação estável'}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
        <button onClick={() => onFilterSelect('wa_disconnected')} className="rounded-full bg-white px-3 py-1 text-red-700 ring-1 ring-red-200">WhatsApp off: {waDisconnected}</button>
        <button onClick={() => onFilterSelect('payment_pending')} className="rounded-full bg-white px-3 py-1 text-amber-700 ring-1 ring-amber-200">Pagamento pendente: {paymentPending}</button>
        <button onClick={() => onFilterSelect('high_errors')} className="rounded-full bg-white px-3 py-1 text-red-700 ring-1 ring-red-200">Erros 24h &gt; 5: {highErrors}</button>
      </div>
    </section>
  )
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
  const [drillFilter, setDrillFilter] = useState('all')

  const loadUsers = useCallback(async (search = query) => {
    const data = await api.adminUsers({ limit: 200, search })
    setUsers(data?.users ?? [])
  }, [query])

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
    const timer = setTimeout(() => {
      loadUsers().catch(err => setError(err.message || 'Erro ao carregar clientes.'))
    }, 0)
    return () => clearTimeout(timer)
  }, [admin, hasCustomerSuccessAccess, loadUsers])

  const usersWithHealth = useMemo(() => users.map(user => ({ ...user, healthScore: getHealthScore(user) })), [users])
  const filteredUsers = useMemo(() => {
    const filter = DRILL_FILTERS[drillFilter] || DRILL_FILTERS.all
    return usersWithHealth.filter(filter.apply)
  }, [usersWithHealth, drillFilter])

  const prioritizedUsers = useMemo(
    () => [...filteredUsers].sort((a, b) => (daysUntil(a.accessExpiresAt) ?? 99) - (daysUntil(b.accessExpiresAt) ?? 99)),
    [filteredUsers],
  )

  const metrics = useMemo(() => {
    const total = usersWithHealth.length
    const active = usersWithHealth.filter(u => String(u.accessStatus || '').toLowerCase() === 'active').length
    const exp3 = usersWithHealth.filter(u => { const d = daysUntil(u.accessExpiresAt); return d !== null && d >= 0 && d <= 3 }).length
    const waDown = usersWithHealth.filter(u => normalizeSessionStatus(u?.waSession?.status) !== 'connected').length
    const atRisk = usersWithHealth.filter(u => u.healthScore < 50).length
    const healthAvg = total ? Math.round(usersWithHealth.reduce((acc, user) => acc + user.healthScore, 0) / total) : 0
    return { total, active, exp3, waDown, atRisk, healthAvg }
  }, [usersWithHealth])

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

  return <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-5 py-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="sticky top-0 z-10 rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-sm backdrop-blur flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Admin · Sucesso do Cliente</p><h1 className="text-3xl font-black text-gray-900">Sucesso do Cliente</h1><p className="text-xs text-gray-500">Central de comando com sinalização pró-ativa</p></div><div className="flex gap-2"><button onClick={() => loadUsers().catch(err => setError(err.message || 'Erro ao atualizar.'))} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Atualizar</button><Link href="/admin" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200">Admin original</Link></div></header>
    {error && <Alert type="error" title="Sucesso do Cliente" message={error} />}
    <ActionAlertBanner users={usersWithHealth} onFilterSelect={setDrillFilter} />
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <StatCard label="Clientes totais" value={metrics.total} tone="green" onClick={() => setDrillFilter('all')} active={drillFilter === 'all'} />
      <StatCard label="Health Score médio" value={`${metrics.healthAvg}%`} tone={getHealthTone(metrics.healthAvg)} hint="Média ponderada do uso + operação" />
      <StatCard label="Ativos" value={metrics.active} tone="green" />
      <StatCard label="Risco de churn (3d)" value={metrics.exp3} tone={metrics.exp3 > 0 ? 'yellow' : 'green'} onClick={() => setDrillFilter('risky')} active={drillFilter === 'risky'} />
      <StatCard label="WhatsApp off" value={metrics.waDown} tone={metrics.waDown > 0 ? 'red' : 'green'} onClick={() => setDrillFilter('wa_disconnected')} active={drillFilter === 'wa_disconnected'} />
      <StatCard label="Crítico (score < 50)" value={metrics.atRisk} tone={metrics.atRisk > 0 ? 'red' : 'green'} onClick={() => setDrillFilter('risky')} active={drillFilter === 'risky'} />
    </section>

    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-gray-900">Fila priorizada para contato</h2><p className="text-xs font-semibold text-emerald-700">Filtro ativo: {DRILL_FILTERS[drillFilter]?.label || DRILL_FILTERS.all.label}</p></div><form onSubmit={e => { e.preventDefault(); loadUsers(query).catch(err => setError(err.message || 'Erro ao buscar.')) }} className="flex gap-2"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome/e-mail" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" /><button className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">Buscar</button></form></div>
    <div className="mb-3 flex flex-wrap gap-2 text-xs">
      {Object.entries(DRILL_FILTERS).map(([key, config]) => (
        <button key={key} onClick={() => setDrillFilter(key)} className={`rounded-full px-3 py-1.5 font-bold ring-1 transition ${drillFilter === key ? 'bg-emerald-600 text-white ring-emerald-600 shadow-sm' : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'}`}>{config.label}</button>
      ))}
    </div>
    <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Telefone</th><th className="px-3 py-2">Plano</th><th className="px-3 py-2">Saúde</th><th className="px-3 py-2">Operação</th><th className="px-3 py-2">Atividade</th><th className="px-3 py-2">Riscos</th><th className="px-3 py-2">Validade</th><th className="px-3 py-2">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{prioritizedUsers.map(user => { const phone = normalizePhone(user.contactPhone); const remaining = daysUntil(user.accessExpiresAt); const sessionDisconnected = normalizeSessionStatus(user?.waSession?.status) !== 'connected'; const paymentPending = String(user?.accessStatus || '').toLowerCase() !== 'active'; const healthTone = getHealthTone(user.healthScore); const rowTone = sessionDisconnected || paymentPending ? 'bg-red-50/40' : healthTone === 'yellow' ? 'bg-amber-50/30' : ''; return <tr key={user.id} className={`align-top ${rowTone}`}><td className="px-3 py-3 font-semibold text-gray-900">{user.name || 'Sem nome'}</td><td className="px-3 py-3">{user.email}</td><td className="px-3 py-3">{user.contactPhone || 'Sem celular'}</td><td className="px-3 py-3 text-xs"><p className="font-semibold">{user.plan}</p><p className="text-gray-500">{user.accessStatus}</p></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${healthTone === 'green' ? 'bg-emerald-100 text-emerald-700' : healthTone === 'yellow' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{user.healthScore}%</span></td><td className="px-3 py-3 text-xs text-gray-600"><p>Bot: {user.botRunning ? 'rodando' : 'parado'}</p><p>WA: {user.waSession?.status || '—'}</p><p>Origem/Destino: {user.groupCounts?.monitor ?? 0}/{user.groupCounts?.post ?? 0}</p>{sessionDisconnected && <p className="mt-1 font-bold text-red-600">⚠ WhatsApp desconectado</p>}{paymentPending && <p className="mt-1 font-bold text-amber-600">⚠ Pagamento pendente</p>}</td><td className="px-3 py-3 text-xs text-gray-600"><p>Última: {formatDate(user.lastActivityAt)}</p><p>Erros 24h: {user.errorCount24h ?? 0}</p><p>Sucessos: {user.successCount ?? 0}</p></td><td className="px-3 py-3 text-xs">{(user.riskFlags?.length ? user.riskFlags : ['ok']).slice(0, 4).map(flag => <span key={flag} className={`mb-1 mr-1 inline-block rounded-full px-2 py-1 text-[11px] font-bold ${flag === 'ok' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{flag === 'ok' ? 'OK' : (RISK_LABELS[flag] || flag)}</span>)}</td><td className="px-3 py-3 text-xs"><p>{formatDate(user.accessExpiresAt)}</p><p className={remaining !== null && remaining <= 3 ? 'text-red-600' : 'text-gray-500'}>{remaining === null ? 'Sem data' : `${remaining} dias`}</p></td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><a href={phone ? `https://wa.me/${phone}` : undefined} target="_blank" rel="noreferrer" className={`rounded-lg px-3 py-2 text-xs font-bold ${phone ? 'bg-green-600 text-white' : 'pointer-events-none bg-gray-200 text-gray-500'}`}>WhatsApp</a><button onClick={() => openUserDetail(user.id)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Drill-down</button><button onClick={() => { setModalUser(user); setAdjustReason('Ajuste manual CS Ops'); setNewExpiry(user.accessExpiresAt ? new Date(user.accessExpiresAt).toISOString().slice(0, 16) : '') }} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-700">Ajustar validade</button></div></td></tr> })}</tbody></table></div></section>
    {selectedUser && <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-black text-gray-900">Drill-down do cliente</h3><button onClick={() => setSelectedUser(null)} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600">Fechar</button></div><p className="text-sm text-gray-600">{selectedUser.email} · {selectedUser.contactPhone || 'Sem celular'} · {selectedUser.plan}</p><div className="mt-3 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Última atividade</p><p className="font-bold">{formatDate(selectedUser.lastActivityAt)}</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Expiração</p><p className="font-bold">{formatDate(selectedUser.accessExpiresAt)}</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Erros 24h</p><p className="font-bold">{selectedUser.errorCount24h ?? 0}</p></div></div></section>}
    {modalUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-black text-gray-900">Confirmar ajuste de validade</h3><p className="mt-2 text-sm text-gray-600">Você tem certeza que deseja alterar o tempo de contrato deste cliente?</p><input type="datetime-local" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" /><textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Motivo do ajuste (mínimo 5 caracteres)" className="mt-3 min-h-20 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => { setModalUser(null); setAdjustReason('') }} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">Cancelar</button><button disabled={saving || !newExpiry || adjustReason.trim().length < 5} onClick={handleAdjustValidity} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar ajuste'}</button></div></div></div>}
  </div></main>
}
