'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LogsSummary } from '@/components/logs/LogsSummary'

const PLATFORM_COLORS = {
  shopee:        'bg-orange-100 text-orange-700',
  amazon:        'bg-yellow-100 text-yellow-700',
  mercadolivre:  'bg-blue-100 text-blue-700',
  magazineluiza: 'bg-purple-100 text-purple-700',
}

const STATUS_TABS = [
  ['all', 'Todos'],
  ['queued', 'Na fila'],
  ['sending', 'Enviando'],
  ['success', 'Sucesso'],
  ['skipped', 'Ignorados'],
  ['error', 'Erros'],
]

const STATUS_META = {
  queued: {
    label: '⏳ Na fila',
    className: 'bg-slate-100 text-slate-600',
  },
  sending: {
    label: '↗ Enviando',
    className: 'bg-blue-100 text-blue-700',
  },
  success: {
    label: '✓ Enviado',
    className: 'bg-green-100 text-green-700',
  },
  skipped: {
    label: '⏭ Ignorado',
    className: 'bg-slate-100 text-slate-600',
  },
  error: {
    label: '✗ Erro',
    className: 'bg-red-100 text-red-700',
  },
}

// Tradução dos prefixos canônicos de errorMsg para linguagem de cliente.
// Mantém-se sincronizado com src/errorTaxonomy.js.
function explainErrorMsg(errorMsg) {
  if (!errorMsg) return null
  if (errorMsg.startsWith('warning:amazon_cookies_expired')) {
    return 'Seus cookies da Amazon (sitestripe) expiraram. As ofertas continuam saindo com link longo de afiliado e creditando comissão, mas para voltar a gerar links curtos amzn.to, renove os cookies em Configurações → Credenciais → Amazon.'
  }
  if (errorMsg.startsWith('skip:dedup')) {
    return 'Link já enviado nas últimas 2 horas — bloqueado para não duplicar.'
  }
  if (errorMsg.startsWith('skip:blocked_keyword')) {
    return 'Contém uma palavra que você marcou para bloquear.'
  }
  if (errorMsg.startsWith('skip:title_mismatch')) {
    return 'O texto da oferta não combina com o produto do link. Bloqueado por segurança.'
  }
  if (errorMsg.startsWith('skip:text_too_large')) {
    return 'Mensagem muito grande — ignorada para não atrasar o restante da fila.'
  }
  if (errorMsg.startsWith('skip:no_valid_conversions')) {
    return 'Nenhum link da mensagem pôde ser convertido em link de afiliado.'
  }
  if (errorMsg.startsWith('skip:policy')) {
    if (errorMsg.endsWith(':unsupported_store')) {
      return 'Essa promoção foi ignorada porque ainda não fazemos conversão automática de afiliado para essa loja.'
    }
    return 'Mensagem fora das regras de encaminhamento que você configurou para este grupo.'
  }
  if (errorMsg.startsWith('skip:decrypt_failed')) {
    return 'O WhatsApp não conseguiu decifrar essa mensagem na sua ponta. Costuma ser pontual.'
  }
  if (errorMsg.startsWith('skip:incoming_error')) {
    return 'Tivemos um erro ao processar essa mensagem antes de enviar.'
  }
  if (errorMsg.startsWith('timeout:send')) {
    return 'O envio para o canal/grupo de destino demorou demais e foi cancelado.'
  }
  if (errorMsg.startsWith('timeout:incoming')) {
    return 'A leitura e o preparo dessa promoção demoraram demais. Costuma ser site de produto lento.'
  }
  if (errorMsg.startsWith('error:queue_full')) {
    return 'Fila interna de envios cheia neste instante — tente novamente em alguns minutos.'
  }
  if (errorMsg.startsWith('error:worker_restart')) {
    return 'O bot reiniciou enquanto essa mensagem estava esperando para ser enviada.'
  }
  if (errorMsg.startsWith('error:channel_forbidden')) {
    return 'O bot não tem permissão para postar nesse canal. Verifique se ele ainda é admin.'
  }
  if (errorMsg.startsWith('error:channel_throttled')) {
    return 'O WhatsApp limitou temporariamente os envios para esse canal. Tentaremos novamente.'
  }
  if (errorMsg.startsWith('error:baileys')) {
    return 'O WhatsApp recusou o envio. Pode ser instabilidade momentânea.'
  }
  if (errorMsg.startsWith('error:conversion')) {
    return `Não conseguimos converter o link em afiliado: ${errorMsg.slice('error:conversion:'.length)}`
  }
  if (errorMsg.startsWith('error:other')) {
    return errorMsg.slice('error:other:'.length) || 'Falha não classificada.'
  }
  return errorMsg
}

function isBenignStatus(log) {
  return log.status === 'skipped'
}

function DedupHitsChip({ hits }) {
  const n = Number(hits) || 0
  if (n <= 0) return null
  return (
    <span
      className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
      title="Mesmo link bloqueado novamente nas últimas 2h — proteção contra repetição."
    >
      +{n.toLocaleString('pt-BR')} {n === 1 ? 'repetição bloqueada' : 'repetições bloqueadas'}
    </span>
  )
}

const LIMIT = 20

function getStatusMeta(status) {
  return STATUS_META[status] ?? {
    label: status || 'Desconhecido',
    className: 'bg-gray-100 text-gray-600',
  }
}

function StatusBadge({ log }) {
  const meta = getStatusMeta(log.status)
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function formatSentAt(sentAt) {
  if (!sentAt) return '—'
  return new Date(sentAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function ErrorDetails({ log, expanded, onToggle }) {
  if (!log.errorMsg) return null

  const benign = isBenignStatus(log)
  const detailsId = `log-error-${log.id}`
  const explained = explainErrorMsg(log.errorMsg)
  const buttonText = expanded
    ? (benign ? 'Ocultar motivo' : 'Ocultar detalhes do erro')
    : (benign ? 'Ver motivo' : 'Ver detalhes do erro')

  const buttonTone = benign
    ? 'text-slate-600 hover:text-slate-800 focus-visible:ring-slate-400'
    : 'text-red-600 hover:text-red-700 focus-visible:ring-red-500'
  const detailTone = benign
    ? 'bg-slate-50 text-slate-700'
    : 'bg-red-50 text-red-700'

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className={`text-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${buttonTone}`}
      >
        {buttonText}
      </button>
      {expanded && (
        <p id={detailsId} className={`mt-2 whitespace-pre-wrap rounded-lg p-2 text-xs ${detailTone}`} role="status">
          {explained}
        </p>
      )}
    </div>
  )
}

function LogMobileCard({ log, errorExpanded, onToggleError }) {
  return (
    <div className="bg-white rounded-xl shadow p-3 text-sm">
      <div className="flex justify-between gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_COLORS[log.platform] || 'bg-gray-100 text-gray-600'}`}>
          {log.platform}
        </span>
        <span className="text-xs text-gray-400">{formatSentAt(log.sentAt)}</span>
      </div>
      <p className="text-gray-700 mt-2"><strong>Origem:</strong> {log.sourceGroupName}</p>
      <p className="text-gray-700"><strong>Destino:</strong> {log.destGroupName}</p>
      <p className="text-gray-600 truncate" title={log.messageText}>{log.messageText}</p>
      <div className="mt-2 flex flex-wrap items-center"><StatusBadge log={log} /><DedupHitsChip hits={log.dedupHits} /></div>
      <ErrorDetails log={log} expanded={errorExpanded} onToggle={onToggleError} />
    </div>
  )
}

function SearchEmptyState({ query, onClear }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
      <p className="text-sm font-medium text-gray-700">Nenhum log encontrado para “{query}”.</p>
      <p className="mt-1 text-xs text-gray-500">Revise o termo ou limpe a busca para voltar à lista de logs.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 rounded-lg bg-gray-800 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
      >
        Limpar busca
      </button>
    </div>
  )
}

export default function LogsPage() {
  const [tab, setTab] = useState('all')
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [expandedErrorIds, setExpandedErrorIds] = useState(() => new Set())

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(handle)
  }, [search])

  const query = debouncedSearch.trim()

  useEffect(() => {
    let active = true
    async function loadLogs() {
      setLoading(true)
      setError('')
      try {
        const data = await api.logs(tab, page, LIMIT, query)
        if (!active) return
        setLogs(data.logs)
        setTotal(data.total)
      } catch (e) {
        if (active) setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadLogs()
    return () => { active = false }
  }, [tab, page, query])

  async function handleClear() {
    setError('')
    try {
      await api.logsClear()
      setPage(1)
      const data = await api.logs(tab, 1, LIMIT, query)
      setLogs(data.logs)
      setTotal(data.total)
    } catch (e) {
      setError(e.message)
    }
  }

  function changeTab(t) {
    setTab(t)
    setPage(1)
  }

  function handleSearchChange(e) {
    setSearch(e.target.value)
    setPage(1)
  }

  function clearSearch() {
    setSearch('')
    setPage(1)
  }

  function toggleErrorDetails(logId) {
    setExpandedErrorIds(current => {
      const next = new Set(current)
      if (next.has(logId)) next.delete(logId)
      else next.add(logId)
      return next
    })
  }

  const totalPages = Math.ceil(total / LIMIT)
  const clearConfirmMessage = total > 0
    ? query
      ? `Esta ação é permanente. Você está vendo ${total} registro${total !== 1 ? 's' : ''} no filtro atual, mas a limpeza apagará todo o histórico de logs da sua conta, inclusive registros fora desta busca. Depois de limpar, não será possível recuperar esses logs pelo painel.`
      : `Esta ação é permanente e apagará ${total} registro${total !== 1 ? 's' : ''} do seu histórico de envios. Depois de limpar, não será possível recuperar esses logs pelo painel.`
    : 'Esta ação é permanente. Não há registros no filtro atual, mas a limpeza removerá qualquer log disponível no seu histórico.'

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">📋 Logs de Envio</h1>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="text-sm font-semibold text-red-600 hover:text-red-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          Limpar todos os logs
        </button>
      </div>

      <LogsSummary />

      <div className="flex gap-0 mb-4 border-b border-gray-200 overflow-x-auto" aria-label="Filtrar logs por status">
        {STATUS_TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => changeTab(value)}
            aria-pressed={tab === value}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
              tab === value
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4"><ErrorState title="Falha ao carregar logs" message={error} /></div>}

      <div className="mb-4">
        <label htmlFor="logs-search" className="mb-1 block text-sm font-medium text-gray-700">Buscar logs</label>
        <input
          id="logs-search"
          value={search}
          onChange={handleSearchChange}
          placeholder="Conteúdo, grupo, plataforma, URL, status ou erro"
          aria-describedby="logs-search-help"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <p id="logs-search-help" className="mt-1 text-xs text-gray-500">
          A busca consulta o histórico filtrado no servidor e mantém a paginação alinhada aos resultados.
        </p>
      </div>

      {loading ? (
        <LoadingState message="Carregando logs de envio..." />
      ) : logs.length === 0 ? (
        query ? <SearchEmptyState query={query} onClear={clearSearch} /> : <EmptyState message="Nenhum log encontrado." />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {logs.map(log => (
              <LogMobileCard
                key={`m-${log.id}`}
                log={log}
                errorExpanded={expandedErrorIds.has(log.id)}
                onToggleError={() => toggleErrorDetails(log.id)}
              />
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Plataforma</th>
                  <th className="text-left px-4 py-3">Origem</th>
                  <th className="text-left px-4 py-3">Destino</th>
                  <th className="text-left px-4 py-3">Preview</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 align-top w-44">
                      <span
                        className={`inline-block max-w-full rounded-full px-2 py-0.5 text-xs font-medium break-words ${PLATFORM_COLORS[log.platform] || 'bg-gray-100 text-gray-600'}`}
                        title={log.platform}
                      >
                        {log.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate" title={log.sourceGroupName}>
                      {log.sourceGroupName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate" title={log.destGroupName}>
                      {log.destGroupName}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={log.messageText}>
                      {log.messageText}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-wrap items-center"><StatusBadge log={log} /><DedupHitsChip hits={log.dedupHits} /></div>
                      <ErrorDetails
                        log={log}
                        expanded={expandedErrorIds.has(log.id)}
                        onToggle={() => toggleErrorDetails(log.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {formatSentAt(log.sentAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>{total} registro{total !== 1 ? 's' : ''}{query ? ` para “${query}”` : ''}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span>{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Próxima →
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <ConfirmDialog open={showClearConfirm} title="Limpar todos os logs" message={clearConfirmMessage} confirmLabel="Limpar todos os logs" danger onCancel={() => setShowClearConfirm(false)} onConfirm={async () => { setShowClearConfirm(false); await handleClear() }} />
    </div>
  )
}
