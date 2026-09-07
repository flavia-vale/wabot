'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const asArray = (value) => (Array.isArray(value) ? value : [])

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))
}

function formatDaysUntil(value) {
  if (!value) return '—'
  const expiresAt = new Date(value)
  if (Number.isNaN(expiresAt.getTime())) return '—'

  const days = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `Venceu há ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}`
  if (days === 0) return 'Vence hoje'
  return `${days} ${days === 1 ? 'dia' : 'dias'}`
}

const SITUACAO_FILTERS = [
  ['', 'Todos'],
  ['trial', 'Em teste'],
  ['ativo', 'Assinantes'],
  ['vencido', 'Vencidos'],
  ['bloqueado', 'Bloqueados'],
]

// Situação em uma palavra, com cor. A tela de lista não explica nada — ela
// serve para achar o cliente e entrar no histórico dele.
function SituacaoBadge({ customer }) {
  const map = {
    trial: ['Em teste', 'bg-amber-100 text-amber-800'],
    active: ['Assinante', 'bg-emerald-100 text-emerald-800'],
    expired: ['Vencido', 'bg-red-100 text-red-700'],
    banned: ['Banido', 'bg-red-100 text-red-700'],
    suspended: ['Suspenso', 'bg-orange-100 text-orange-700'],
  }
  const [label, tone] = map[customer.accessStatus] ?? ['—', 'bg-slate-100 text-slate-600']
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>
}

function WaDot({ status }) {
  const connected = status === 'connected'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      {connected ? 'Conectado' : 'Fora do ar'}
    </span>
  )
}

// Se assinou de forma recorrente (Mercado Pago cobrando sozinho) ou pagou
// avulso (30 dias, sem renovação automática) — ou nunca pagou nada. Só olhar
// "Plano" não responde isso: o mesmo plano (ex.: Pro) pode ter vindo de
// qualquer um dos dois caminhos.
function CobrancaBadge({ customer }) {
  const sub = customer.subscription
  const subStatus = String(sub?.status ?? '').toLowerCase()
  if (sub && ['authorized', 'active'].includes(subStatus)) {
    return <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Recorrente</span>
  }
  if (sub) {
    const label = subStatus === 'pending' ? 'Recorrente (aguardando)' : subStatus === 'paused' ? 'Recorrente (pausada)' : 'Recorrente (cancelada)'
    return <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{label}</span>
  }
  if ((customer.paidCount ?? 0) > 0) {
    return <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">Avulso</span>
  }
  return <span className="text-xs text-slate-400">—</span>
}

const COLUMNS = [
  { key: 'name', label: 'Cliente', sortable: true },
  { key: 'createdAt', label: 'Cadastro', sortable: true },
  { key: 'situacao', label: 'Situação', sortable: false },
  { key: 'plan', label: 'Plano', sortable: true },
  { key: 'cobranca', label: 'Cobrança', sortable: false },
  { key: 'accessExpiresAt', label: 'Vence em', sortable: true },
  { key: 'ltv', label: 'Pago', sortable: false },
  { key: 'grupos', label: 'Grupos', sortable: false },
  { key: 'sends30d', label: 'Envios 30d', sortable: false },
  { key: 'wa', label: 'WhatsApp', sortable: false },
]

export default function AdminClientesPage() {
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState({ search: '', situacao: '', sort: 'createdAt', dir: 'desc', page: 1 })
  // Um estado só, carimbado com a busca que o produziu. "Carregando" e "erro"
  // são DERIVADOS dele em vez de flags próprias — flag setada dentro do efeito
  // dispara renderização em cascata (regra react-hooks/set-state-in-effect) e
  // ainda pode dessincronizar da resposta que chegou.
  const [result, setResult] = useState(null)

  const { search, situacao, sort, dir, page } = query
  const queryKey = `${search}|${situacao}|${sort}|${dir}|${page}`

  useEffect(() => {
    let cancelled = false
    api.adminCustomers({ search, situacao, sort, dir, page, limit: 50 })
      .then(data => { if (!cancelled) setResult({ key: queryKey, data, error: '' }) })
      .catch(err => { if (!cancelled) setResult({ key: queryKey, data: null, error: err?.message || 'Não foi possível carregar a lista de clientes.' }) })
    return () => { cancelled = true }
  }, [queryKey, search, situacao, sort, dir, page])

  const isCurrent = result?.key === queryKey
  const loading = !isCurrent
  const error = isCurrent ? result.error : ''
  // Mantém a tabela anterior na tela enquanto a próxima página chega, em vez
  // de piscar vazio a cada clique de ordenação.
  const data = result?.data ?? null

  function toggleSort(key) {
    if (!COLUMNS.find(col => col.key === key)?.sortable) return
    setQuery(current => ({
      ...current,
      page: 1,
      sort: key,
      dir: current.sort === key && current.dir === 'desc' ? 'asc' : 'desc',
    }))
  }

  const customers = asArray(data?.customers)
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? 50)))

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Admin</p>
            <h1 className="text-2xl font-black text-slate-900">Clientes</h1>
            <p className="text-sm text-slate-500">{formatNumber(data?.total ?? 0)} no total. Clique num cliente para ver o histórico completo.</p>
          </div>
          <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Voltar ao admin</Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form
            onSubmit={(event) => { event.preventDefault(); setQuery(current => ({ ...current, page: 1, search: searchInput.trim() })) }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nome, e-mail ou celular"
              className="w-full max-w-sm rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">Buscar</button>
            <div className="ml-auto flex flex-wrap gap-1">
              {SITUACAO_FILTERS.map(([key, label]) => (
                <button
                  key={key || 'todos'}
                  type="button"
                  onClick={() => setQuery(current => ({ ...current, page: 1, situacao: key }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${situacao === key ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </form>
        </section>

        {error && <Alert type="error" title="Clientes" message={error} />}
        {loading && !data && <LoadingState />}

        {data && (
          <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {COLUMNS.map(column => (
                    <th key={column.key} className="px-4 py-3 font-bold">
                      {column.sortable ? (
                        <button type="button" onClick={() => toggleSort(column.key)} className="flex items-center gap-1 hover:text-slate-900">
                          {column.label}
                          {sort === column.key && <span>{dir === 'desc' ? '↓' : '↑'}</span>}
                        </button>
                      ) : column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map(customer => (
                  <tr key={customer.id} className="hover:bg-emerald-50/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/clientes/${customer.id}`} className="block">
                        <span className="font-bold text-slate-900 hover:text-emerald-700">{customer.name || '—'}</span>
                        <span className="block text-xs text-slate-500">{customer.email}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(customer.createdAt)}</td>
                    <td className="px-4 py-3"><SituacaoBadge customer={customer} /></td>
                    <td className="px-4 py-3 text-slate-600">{customer.planLabel}</td>
                    <td className="px-4 py-3"><CobrancaBadge customer={customer} /></td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{formatDaysUntil(customer.accessExpiresAt)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{formatCurrency(customer.ltv)}</td>
                    <td className="px-4 py-3 text-slate-600">{customer.groupCounts?.monitor ?? 0}/{customer.groupCounts?.post ?? 0}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(customer.sends30d)}</td>
                    <td className="px-4 py-3"><WaDot status={customer.waSession?.status} /></td>
                  </tr>
                ))}
                {!customers.length && !loading && (
                  <tr><td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-400">Nenhum cliente encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {data && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setQuery(current => ({ ...current, page: Math.max(1, current.page - 1) }))} disabled={page <= 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Anterior</button>
            <span className="text-sm text-slate-500">Página {page} de {totalPages}</span>
            <button onClick={() => setQuery(current => ({ ...current, page: Math.min(totalPages, current.page + 1) }))} disabled={page >= totalPages} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Próxima</button>
          </div>
        )}
      </div>
    </main>
  )
}
