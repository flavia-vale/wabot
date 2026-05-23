'use client'

import { useMemo, useState } from 'react'
import { MobileShell, MobileStateCard } from '@/components/mobile/MobileShell'
import { logItems } from '@/components/mobile/mobileData'
import { MobileErrorCard, MobileLoadingCard, useMockAsyncData } from '@/components/mobile/MobileAsyncState'
import { logMobileCriticalAction, useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { VirtualList } from '@/components/mobile/VirtualList'

function LogRow({ item, isOpen, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="w-full border-b border-[#edf3ef] p-3 text-left last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{item.title}</p>
        <span className="text-xs text-[#8FA09A]">{item.time}</span>
      </div>
      <p className="mt-1 text-xs text-[#5A6E68]">{item.store} · {item.flow}</p>
      <p className={`mt-1 text-xs font-semibold ${item.status === 'ok' ? 'text-[#3E9C7A]' : 'text-[#D97757]'}`}>{item.status === 'ok' ? 'Espelhado' : 'Falha'}</p>
      {isOpen && item.error ? <p className="mt-2 text-xs font-semibold text-[#D97757]">{item.error}</p> : null}
      {isOpen ? (
        <div className="mt-2">
          <span className="rounded-full border border-[#d7e7de] px-2 py-1 text-xs font-semibold">Detalhes expandidos</span>
        </div>
      ) : null}
    </button>
  )
}

export default function LogsPage() {
  useMobileRoutePerf('m/op/logs')
  const [filter, setFilter] = useState('todos')
  const [expanded, setExpanded] = useState(null)
  const [query, setQuery] = useState('')

  const filteredItems = useMemo(() => {
    const base = filter === 'todos' ? logItems : logItems.filter((item) => item.status === filter)
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter((item) => (`${item.title} ${item.store} ${item.flow}`).toLowerCase().includes(q))
  }, [filter, query])

  const { loading, error, data: items } = useMockAsyncData(filteredItems)

  return (
    <MobileShell title="Conversor" active="logs">
      <h2 className="text-lg font-semibold">Logs de envio</h2>

      <label htmlFor="logs-search" className="mt-3 block text-xs font-semibold text-[#5A6E68]">Buscar</label>
      <input
        id="logs-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Produto, loja ou fluxo"
        className="mt-1 w-full rounded-xl border border-[#d7e7de] bg-white px-3 py-2 text-sm"
      />

      <div className="mt-3 flex gap-2" role="tablist" aria-label="Filtro de logs">
        {['todos', 'ok', 'falha'].map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={filter === item}
            onClick={() => setFilter(item)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === item ? 'border-[#1F2D2A] bg-[#1F2D2A] text-white' : 'border-[#d7e7de] bg-white text-[#5A6E68]'}`}
          >
            {item === 'todos' ? 'Todos' : item === 'ok' ? 'Espelhados' : 'Falhas'}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <button
          type="button"
          className="rounded-full border border-[#d7e7de] px-3 py-2 text-xs font-semibold"
          onClick={() => logMobileCriticalAction('send_now', { from: 'logs-page' })}
        >
          Enviar agora (ação crítica)
        </button>
      </div>

      {loading ? <MobileLoadingCard label="Carregando logs..." /> : null}
      {error ? <div className="mt-3"><MobileErrorCard message={error} /></div> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="mt-3">
          <MobileStateCard title="Nenhum log encontrado" description="Ajuste seu filtro ou busca para localizar eventos." />
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#d7e7de] bg-white">
          {items.length > 8 ? (
            <VirtualList
              items={items}
              itemHeight={112}
              height={430}
              renderItem={(item) => (
                <LogRow
                  item={item}
                  isOpen={expanded === item.id}
                  onToggle={() => setExpanded((current) => (current === item.id ? null : item.id))}
                />
              )}
            />
          ) : (
            items.map((item) => (
              <LogRow
                key={item.id}
                item={item}
                isOpen={expanded === item.id}
                onToggle={() => setExpanded((current) => (current === item.id ? null : item.id))}
              />
            ))
          )}
        </div>
      ) : null}
    </MobileShell>
  )
}
