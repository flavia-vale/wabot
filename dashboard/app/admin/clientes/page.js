'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import { PayingTag } from '@/components/PayingTag'
import { SharedPhoneTag } from '@/components/SharedPhoneTag'

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
    trial: ['Em teste', 'bg-ds-warn/20 text-ds-warn-ink'],
    active: ['Assinante', 'bg-ds-accent/20 text-ds-accent-strong'],
    expired: ['Vencido', 'bg-ds-danger/20 text-ds-danger'],
    banned: ['Banido', 'bg-ds-danger/20 text-ds-danger'],
    suspended: ['Suspenso', 'bg-ds-warn/20 text-ds-warn-ink'],
  }
  const [label, tone] = map[customer.accessStatus] ?? ['—', 'bg-ds-bg-soft text-ds-ink-soft']
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${tone}`}>{label}</span>
}

function WaDot({ status }) {
  const connected = status === 'connected'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ds-ink-soft">
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-ds-accent-strong' : 'bg-ds-bg-soft'}`} />
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
    return <span className="inline-block rounded-full bg-ds-accent/20 px-2 py-0.5 text-[10.5px] font-bold text-ds-accent-strong">Recorrente</span>
  }
  if (sub) {
    // "Aguardando" era dito também para quem JÁ pagou e só falta a confirmação
    // do Mercado Pago chegar — o backend separa os dois casos.
    if (sub.awaitingConfirmation) {
      return <span className="inline-block rounded-full bg-ds-warn/20 px-2 py-0.5 text-[10.5px] font-bold text-ds-warn-ink">Recorrente (confirmando)</span>
    }
    const label = subStatus === 'pending' ? 'Recorrente (não concluída)' : subStatus === 'paused' ? 'Recorrente (pausada)' : 'Recorrente (cancelada)'
    return <span className="inline-block rounded-full bg-ds-bg-soft px-2 py-0.5 text-[10.5px] font-bold text-ds-ink-soft">{label}</span>
  }
  if ((customer.paidCount ?? 0) > 0) {
    return <span className="inline-block rounded-full bg-ds-bg-soft px-2 py-0.5 text-[10.5px] font-bold text-ds-ink-soft">Avulso</span>
  }
  return <span className="text-xs text-ds-ink-faint">—</span>
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
  { key: 'numeros', label: 'Números ligados', sortable: false },
]

/* Todos os números de WhatsApp que a conta já ligou.
 *
 * Mais de um NÃO é defeito: a cliente pode ter trocado de chip. O que importa
 * é conseguir cruzar com outras contas — foi assim que apareceram quatro
 * contas ligando o mesmo número. O primeiro fica visível e o resto entra na
 * contagem, para a coluna não empurrar a tabela para fora da tela. */
function WaPhones({ phones }) {
  const lista = Array.isArray(phones) ? phones : []
  if (!lista.length) return <span className="text-ds-ink-faint">—</span>
  const [primeiro, ...resto] = lista
  return (
    <span className="whitespace-nowrap text-xs text-ds-ink-soft" title={lista.join(', ')}>
      {primeiro}
      {resto.length > 0 && <span className="ml-1 font-semibold text-ds-warn-ink">+{resto.length}</span>}
    </span>
  )
}

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
    <main className="min-h-screen bg-ds-bg px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ds-accent-strong">Admin</p>
            <h1 className="text-[19px] font-black text-ds-ink">Clientes</h1>
            <p className="text-sm text-ds-ink-soft">{formatNumber(data?.total ?? 0)} no total. Clique num cliente para ver o histórico completo.</p>
          </div>
          <Link href="/admin" className="rounded-xl border border-ds-line bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-ink hover:bg-ds-bg">Voltar ao admin</Link>
        </div>

        <section className="rounded-2xl border border-ds-line bg-ds-surface p-4 shadow-sm">
          <form
            onSubmit={(event) => { event.preventDefault(); setQuery(current => ({ ...current, page: 1, search: searchInput.trim() })) }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nome, e-mail ou celular"
              className="w-full max-w-sm rounded-xl border border-ds-line px-3 py-2 text-sm outline-none focus:border-ds-accent-strong"
            />
            <button type="submit" className="rounded-xl bg-ds-accent-strong px-4 py-2 text-sm font-bold text-ds-surface hover:bg-ds-accent-strong/85">Buscar</button>
            <div className="ml-auto flex flex-wrap gap-1">
              {SITUACAO_FILTERS.map(([key, label]) => (
                <button
                  key={key || 'todos'}
                  type="button"
                  onClick={() => setQuery(current => ({ ...current, page: 1, situacao: key }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${situacao === key ? 'bg-ds-ink text-ds-surface ring-ds-ink' : 'bg-ds-surface text-ds-ink-soft ring-ds-line'}`}
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
          <section className="overflow-x-auto rounded-2xl border border-ds-line bg-ds-surface shadow-sm">
            <table className="adm-zebra min-w-full text-sm">
              <thead className="bg-ds-surface text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ds-ink-faint">
                <tr>
                  {COLUMNS.map(column => (
                    <th key={column.key} className="px-4 py-3 font-bold">
                      {column.sortable ? (
                        <button type="button" onClick={() => toggleSort(column.key)} className="flex items-center gap-1 hover:text-ds-ink">
                          {column.label}
                          {sort === column.key && <span>{dir === 'desc' ? '↓' : '↑'}</span>}
                        </button>
                      ) : column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-line">
                {customers.map(customer => (
                  <tr key={customer.id} className="hover:bg-ds-accent/10">
                    <td className="px-4 py-3">
                      <Link href={`/admin/clientes/${customer.id}`} className="block">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-ds-ink hover:text-ds-accent-strong">{customer.name || '—'}</span>
                          <PayingTag status={customer.payingStatus} compact />
                          <SharedPhoneTag status={customer.sharedPhoneStatus} contas={customer.sharedPhoneAccounts} compact />
                        </span>
                        <span className="block text-xs text-ds-ink-soft">{customer.email}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ds-ink-soft">{formatDate(customer.createdAt)}</td>
                    <td className="px-4 py-3"><SituacaoBadge customer={customer} /></td>
                    <td className="px-4 py-3 text-ds-ink-soft">{customer.planLabel}</td>
                    <td className="px-4 py-3"><CobrancaBadge customer={customer} /></td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-ds-ink">{formatDaysUntil(customer.accessExpiresAt)}</td>
                    <td className="px-4 py-3 font-semibold text-ds-ink">{formatCurrency(customer.ltv)}</td>
                    <td className="px-4 py-3 text-ds-ink-soft">{customer.groupCounts?.monitor ?? 0}/{customer.groupCounts?.post ?? 0}</td>
                    <td className="px-4 py-3 text-ds-ink-soft">{formatNumber(customer.sends30d)}</td>
                    <td className="px-4 py-3"><WaDot status={customer.waSession?.status} /></td>
                    <td className="px-4 py-3"><WaPhones phones={customer.waPhones} /></td>
                  </tr>
                ))}
                {!customers.length && !loading && (
                  <tr><td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-ds-ink-faint">Nenhum cliente encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {data && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setQuery(current => ({ ...current, page: Math.max(1, current.page - 1) }))} disabled={page <= 1} className="rounded-xl border border-ds-line bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-ink disabled:opacity-40">Anterior</button>
            <span className="text-sm text-ds-ink-soft">Página {page} de {totalPages}</span>
            <button onClick={() => setQuery(current => ({ ...current, page: Math.min(totalPages, current.page + 1) }))} disabled={page >= totalPages} className="rounded-xl border border-ds-line bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-ink disabled:opacity-40">Próxima</button>
          </div>
        )}
      </div>
    </main>
  )
}
