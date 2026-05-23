'use client'

import { useMemo, useState } from 'react'
import { MobileShell, MobileStateCard } from '@/components/mobile/MobileShell'
import { sendItems } from '@/components/mobile/mobileData'
import { MobileErrorCard, MobileLoadingCard, useMockAsyncData } from '@/components/mobile/MobileAsyncState'
import { logMobileCriticalAction, useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { VirtualList } from '@/components/mobile/VirtualList'

const tabs = [
  { key: 'fila', label: 'Na fila' },
  { key: 'enviados', label: 'Enviados' },
  { key: 'falhas', label: 'Falhas' },
]

function SendCard({ item }) {
  return (
    <article className="border-b border-[#edf3ef] p-3 last:border-b-0">
      <p className="text-sm font-semibold">{item.title}</p>
      <p className="mt-1 text-xs text-[#5A6E68]">{item.store} → {item.target}</p>
      <p className="mt-1 text-xs font-semibold text-[#5A6E68]">{item.when}</p>
      {item.error ? <p className="mt-1 text-xs font-semibold text-[#D97757]">{item.error}</p> : null}
      <div className="mt-2 flex gap-2">
        {item.status !== 'ok' ? (
          <button
            type="button"
            className="rounded-full border border-[#d7e7de] px-2 py-1 text-xs font-semibold"
            onClick={() => logMobileCriticalAction('retry_send', { title: item.title, status: item.status })}
          >
            Retry
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-full border border-[#d7e7de] px-2 py-1 text-xs font-semibold"
          onClick={() => logMobileCriticalAction('cancel_send', { title: item.title, status: item.status })}
        >
          Cancelar
        </button>
      </div>
    </article>
  )
}

export default function SendsPage() {
  useMobileRoutePerf('m/op/sends')
  const [tab, setTab] = useState('fila')
  const rawItems = useMemo(() => sendItems[tab] || [], [tab])
  const { loading, error, data: items } = useMockAsyncData(rawItems)

  return (
    <MobileShell title="Conversor" active="envios">
      <h2 className="text-lg font-semibold">Envios</h2>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-[#d7e7de] bg-white p-1" role="tablist" aria-label="Filtros de envios">
        {tabs.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-2 py-2 text-xs font-semibold ${tab === item.key ? 'bg-[#1F2D2A] text-white' : 'text-[#5A6E68]'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <MobileLoadingCard label="Carregando envios..." /> : null}
      {error ? <div className="mt-3"><MobileErrorCard message={error} /></div> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="mt-3">
          <MobileStateCard title="Sem itens" description="Não há envios neste filtro no momento." tone="neutral" />
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#d7e7de] bg-white" role="region" aria-label="Lista de envios">
          {items.length > 8 ? (
            <VirtualList
              items={items}
              itemHeight={132}
              height={430}
              renderItem={(item) => <SendCard item={item} />}
            />
          ) : (
            items.map((item) => <SendCard key={`${item.title}-${item.when}`} item={item} />)
          )}
        </div>
      ) : null}
    </MobileShell>
  )
}
