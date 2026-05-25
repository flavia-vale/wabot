'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { useMobileHomeData } from '@/components/mobile/useMobileHomeData'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

function HomeIcon({ name, size = 16 }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }
  if (name === 'link') return <svg {...props}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 1 0 11 21l1.5-1.5" /></svg>
  if (name === 'send') return <svg {...props}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
  return null
}

export default function MobileHomePage() {
  useMobileRoutePerf('m/home')
  const { summary, recent } = useMobileHomeData()
  const [nowLabel, setNowLabel] = useState('--:--')

  useEffect(() => {
    const formatNow = () => {
      const now = new Date()
      const hh = now.getHours().toString().padStart(2, '0')
      const mm = now.getMinutes().toString().padStart(2, '0')
      setNowLabel(`${hh}:${mm}`)
    }

    formatNow()
    const intervalId = window.setInterval(formatNow, 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <MobileShell title="Conversor" active="inicio">
      <section className="rounded-2xl bg-[#1F2D2A] p-5 text-white">
        <p className="text-xs uppercase tracking-wider text-white/70">Espelhamentos hoje</p>
        <p className="mt-1 text-5xl italic">{summary.mirroredToday}</p>
        <p className="mt-1 text-sm text-white/80">↑ 12% vs ontem · agora {nowLabel}</p>
      </section>

      <section className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-[#d7e7de] bg-white p-3"><p className="text-[11px] text-[#5A6E68]">Detectados</p><p className="text-xl font-semibold">{summary.detectedToday}</p></div>
        <div className="rounded-xl border border-[#d7e7de] bg-white p-3"><p className="text-[11px] text-[#5A6E68]">Taxa</p><p className="text-xl font-semibold">{summary.mirroredRate}%</p></div>
        <div className="rounded-xl border border-[#d7e7de] bg-white p-3"><p className="text-[11px] text-[#5A6E68]">Falhas</p><p className="text-xl font-semibold text-[#D97757]">{summary.alerts}</p></div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/m/op/converter" className="rounded-xl border border-[#d7e7de] bg-white p-3 text-sm font-semibold">
          <span className="inline-flex items-center gap-2"><HomeIcon name="link" />Converter link</span>
        </Link>
        <Link href="/m/op/sends" className="rounded-xl border border-[#d7e7de] bg-white p-3 text-sm font-semibold">
          <span className="inline-flex items-center gap-2"><HomeIcon name="send" />Ver envios</span>
        </Link>
      </section>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Espelhamentos recentes</h2>
          <Link href="/m/op/logs" className="text-xs font-semibold text-[#3E9C7A]">Ver tudo</Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#d7e7de] bg-white">
          {recent.map((item) => (
            <div key={`${item.title}-${item.when}`} className="border-b border-[#edf3ef] p-3 last:border-b-0">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-[#5A6E68]">{item.store} · {item.from} → {item.to}</p>
              <p className={`mt-1 text-xs font-semibold ${item.ok ? 'text-[#3E9C7A]' : 'text-[#D97757]'}`}>{item.when}</p>
            </div>
          ))}
        </div>
      </section>
    </MobileShell>
  )
}
