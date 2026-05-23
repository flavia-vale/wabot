'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { groupBuckets } from '@/components/mobile/mobileConfigData'
import { mobileRoutes } from '@/components/mobile/routes'

export default function GroupsPage() {
  const [tab, setTab] = useState('origem')
  const items = useMemo(() => groupBuckets[tab] || [], [tab])

  return (
    <MobileShell title="Conversor" active="inicio">
      <h2 className="text-lg font-semibold">Grupos e canais</h2>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-[#d7e7de] bg-white p-1">
        <button onClick={() => setTab('origem')} className={`rounded-lg px-2 py-2 text-xs font-semibold ${tab === 'origem' ? 'bg-[#1F2D2A] text-white' : 'text-[#5A6E68]'}`}>👁 Monitorar</button>
        <button onClick={() => setTab('destino')} className={`rounded-lg px-2 py-2 text-xs font-semibold ${tab === 'destino' ? 'bg-[#1F2D2A] text-white' : 'text-[#5A6E68]'}`}>⚡ Publicar</button>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-[#d7e7de] bg-white">
        {items.map((item) => (
          <div key={item.name} className="border-b border-[#edf3ef] p-3 last:border-b-0">
            <p className="text-sm font-semibold">{item.name}</p>
            <p className="mt-1 text-xs text-[#5A6E68]">{item.members} · {item.activity}</p>
            <p className={`mt-1 text-xs font-semibold ${item.enabled ? 'text-[#3E9C7A]' : 'text-[#8FA09A]'}`}>{item.enabled ? 'Ativo' : 'Pausado'}</p>
          </div>
        ))}
      </div>
      <Link href={mobileRoutes.configWhatsApp} className="mt-3 block rounded-full bg-[#1F2D2A] px-3 py-2 text-center text-sm font-semibold text-white">Adicionar grupo</Link>
    </MobileShell>
  )
}
