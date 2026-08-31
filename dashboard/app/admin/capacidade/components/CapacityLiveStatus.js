'use client'
import { useEffect, useState } from 'react'

const SOURCE_LABEL = { ok: 'normal', stale: 'atrasada', timeout: 'sem resposta', unavailable: 'indisponível' }
const COMPLETENESS = { complete: 'Coleta completa', partial: 'Coleta parcial', failed: 'Coleta falhou' }
function ageLabel(seconds) { if (!Number.isFinite(seconds)) return 'idade desconhecida'; if (seconds < 60) return `há ${seconds}s`; return `há ${Math.floor(seconds / 60)}min ${seconds % 60}s` }

export default function CapacityLiveStatus({ collectedAt, ageSeconds, completeness, sources = [] }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const collectedMs = collectedAt ? new Date(collectedAt).getTime() : NaN
  const liveAge = Number.isFinite(collectedMs) ? Math.max(0, Math.floor((now - collectedMs) / 1000)) : ageSeconds
  const stale = !Number.isFinite(liveAge) || liveAge > 600
  return <section aria-labelledby="capacity-live-title" className={`rounded-2xl border p-4 ${stale ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-600">Monitoramento automático</p><h2 id="capacity-live-title" className="mt-1 font-black text-slate-950">{stale ? 'Medição atrasada' : 'Painel recebendo dados'}</h2></div><span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${stale ? 'bg-amber-200 text-amber-950' : 'bg-emerald-200 text-emerald-950'}`}>{ageLabel(liveAge)}</span></div><p className="mt-2 text-sm text-slate-700">O servidor coleta uma nova fotografia a cada 5 minutos. Esta página verifica novidades a cada 30 segundos; o contador acima avança no navegador sem gerar chamadas extras.</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-700"><span className="rounded-lg bg-white/70 px-2 py-1">{COMPLETENESS[completeness] || 'Completude desconhecida'}</span>{sources.map((source) => <span key={source.name} className="rounded-lg bg-white/70 px-2 py-1">{source.name}: {SOURCE_LABEL[source.status] || 'desconhecida'}</span>)}</div></section>
}
