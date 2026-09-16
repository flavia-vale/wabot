'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'

const mib = value => value == null ? '—' : `${(Number(value) / 1024 / 1024).toFixed(1)} MiB`
const age = value => value ? new Date(value).toLocaleString('pt-BR') : '—'
const tone = outcome => outcome === 'success' ? 'bg-emerald-100 text-emerald-800' : outcome === 'failure' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'

export default function ShardPocPage() {
  const [admin, setAdmin] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState('')
  const loadingRef = useRef(false)
  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try { setData(await api.adminShardPocOverview()); setError('') }
    catch (err) { setError(err?.message || 'Não foi possível ler o teste controlado.') }
    finally { loadingRef.current = false; setLoading(false) }
  }, [])
  useEffect(() => { let active = true; api.adminMe().then(me => { if (active) setAdmin(me) }).catch(err => { if (active) { setError(err?.message || 'Acesso negado.'); setLoading(false) } }); return () => { active = false } }, [])
  const canRead = admin?.permissions?.includes('tech:read')
  useEffect(() => {
    if (!canRead) return
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 5_000)
    return () => window.clearInterval(timer)
  }, [canRead, load])
  const totals = useMemo(() => (data?.members || []).reduce((out, member) => {
    const pid = member.runtime?.pid
    if (!pid || !out.pids.has(pid)) {
      if (pid) out.pids.add(pid)
      out.rss += Number(member.runtime?.rssBytes || 0); out.heap += Number(member.runtime?.heapUsedBytes || 0); out.external += Number(member.runtime?.externalBytes || 0)
    }
    out.failures += Number(member.failures24h || 0)
    return out
  }, { rss: 0, heap: 0, external: 0, failures: 0, pids: new Set() }), [data])
  const act = async (member, action) => {
    const warning = action === 'rollback'
      ? `VOLTAR ${member.email} AO WORKER INDIVIDUAL? A sessão será reconectada.`
      : `MOVER ${member.email} PARA O SHARD? Confirme que o rollback já foi validado.`
    if (!window.confirm(warning)) return
    setActing(`${member.id}:${action}`)
    try { if (action === 'rollback') await api.adminShardPocRollback(member.id); else await api.adminShardPocStart(member.id); await load() }
    catch (err) { setError(err?.message || 'A operação controlada falhou.') }
    finally { setActing('') }
  }

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.25em] text-violet-300">ADMIN · TESTE CONTROLADO · PRODUÇÃO</p><h1 className="mt-1 text-3xl font-black">Shard WhatsApp · 4 contas</h1><p className="mt-2 max-w-3xl text-sm text-slate-300">Observação ao vivo das quatro contas candidatas. Mover só aparece no modo enabled; o rollback permanece disponível para quem tem permissão técnica de escrita.</p></div><Link href="/admin" className="flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-bold">Voltar ao ADMIN</Link></header>
    {error && <p role="alert" className="rounded-xl border border-red-500/50 bg-red-950/60 p-4 font-semibold text-red-100">{error}</p>}
    {loading && !data && <p className="rounded-xl bg-slate-900 p-5">Carregando telemetria…</p>}
    {admin && !canRead && <p className="rounded-xl bg-red-950 p-5">Você não tem permissão técnica.</p>}
    {data && <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ['Modo', data.experimentMode === 'observe' ? 'Somente observar' : data.experimentMode],
        ['RSS das 4', mib(totals.rss)], ['Heap usado', mib(totals.heap)], ['Memória externa', mib(totals.external)],
      ].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>)}</section>
      <section className={`rounded-2xl border p-4 ${data.ready ? 'border-emerald-500/40 bg-emerald-950/30' : 'border-amber-500/40 bg-amber-950/30'}`}><p className="font-black">{data.ready ? 'As 4 candidatas estão conectadas' : 'Seleção ainda não está pronta para cutover'}</p><p className="mt-1 text-sm text-slate-300">{data.selectionNote} Atualizado em {age(data.generatedAt)} · supervisor {data.supervisorMode}.</p></section>
      <section><h2 className="mb-3 text-xl font-black">Contas sugeridas</h2><div className="grid gap-3 lg:grid-cols-2">{data.members.map(member => <article key={member.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black">{member.name || 'Sem nome'}</p><p className="text-sm text-slate-400">{member.email}</p></div><span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black text-violet-200">{member.selectionProfile}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><span className="text-slate-500">RSS</span><b className="block">{mib(member.runtime?.rssBytes)}</b></div><div><span className="text-slate-500">Heap</span><b className="block">{mib(member.runtime?.heapUsedBytes)}</b></div><div><span className="text-slate-500">Loop p95</span><b className="block">{member.runtime?.eventLoopDelayMs?.p95 ?? '—'} ms</b></div><div><span className="text-slate-500">PID</span><b className="block">{member.runtime?.pid ?? '—'}</b></div></div><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-slate-800 px-2 py-1">{member.messages24h} eventos/24h</span><span className="rounded-lg bg-slate-800 px-2 py-1">{member.mediaMessages24h} com mídia</span><span className="rounded-lg bg-slate-800 px-2 py-1">{member.failures24h} insucessos</span><span className="rounded-lg bg-slate-800 px-2 py-1">{member.session?.status}/{member.session?.lifecycle}</span></div>{member.metricsError && <p className="mt-3 text-xs font-semibold text-amber-300">{member.metricsError}</p>}<div className="mt-4 flex flex-wrap gap-2">{data.experimentMode === 'enabled' && admin?.permissions?.includes('tech:write') && <button type="button" disabled={Boolean(acting)} onClick={() => void act(member, 'start')} className="min-h-11 rounded-xl bg-violet-600 px-3 text-xs font-black text-white disabled:opacity-50">{acting === `${member.id}:start` ? 'Movendo…' : 'Mover para shard'}</button>}{admin?.permissions?.includes('tech:write') && <button type="button" disabled={Boolean(acting)} onClick={() => void act(member, 'rollback')} className="min-h-11 rounded-xl bg-red-700 px-3 text-xs font-black text-white disabled:opacity-50">{acting === `${member.id}:rollback` ? 'Restaurando…' : 'Voltar ao worker individual'}</button>}</div></article>)}</div></section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900"><div className="border-b border-slate-800 p-5"><h2 className="text-xl font-black">Sucessos e insucessos das 4 contas</h2><p className="text-sm text-slate-400">Últimas 24h, até 250 eventos. Texto, links e identificadores de grupos não são expostos.</p></div><div className="max-h-[36rem] overflow-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-500"><tr><th className="p-3">Quando</th><th className="p-3">Conta</th><th className="p-3">Tipo</th><th className="p-3">Resultado</th><th className="p-3">Estado/detalhe</th><th className="p-3">Mídia</th></tr></thead><tbody>{data.events.map(event => <tr key={event.id} className="border-t border-slate-800"><td className="p-3 text-slate-400">{age(event.at)}</td><td className="p-3 font-semibold">{event.account}</td><td className="p-3">{event.kind}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${tone(event.outcome)}`}>{event.outcome}</span></td><td className="p-3">{event.status} · {event.detail || '—'}</td><td className="p-3">{event.mediaBytes ? mib(event.mediaBytes) : '—'}</td></tr>)}</tbody></table>{!data.events.length && <p className="p-6 text-slate-400">Nenhum evento nas últimas 24h.</p>}</div></section>
    </>}
  </div></main>
}
