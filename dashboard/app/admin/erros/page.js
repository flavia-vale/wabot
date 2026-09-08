'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const COPY = {
  timeout: ['Demorou demais e desistiu', 'O site, leitura ou envio não respondeu a tempo.', 'Ver se cresceu para várias clientes; se sim, investigar o serviço.'],
  channel_forbidden: ['Sem permissão para publicar', 'O robô perdeu permissão em um grupo ou canal.', 'Orientar a cliente a tornar o robô administrador.'],
  channel_throttled: ['WhatsApp limitou os envios', 'O WhatsApp pediu que este canal desacelerasse.', 'Acompanhar recorrência antes de alterar a operação.'],
  queue_full: ['Fila interna cheia', 'Entraram mais trabalhos do que a fila conseguiu absorver.', 'Ver capacidade, workers e trabalhos parados.'],
  worker_restart: ['Robô reiniciou no meio do envio', 'O worker caiu ou reiniciou com trabalho pendente.', 'Cruzar horário com deploys e reinícios do supervisor.'],
  decrypt: ['Mensagem não pôde ser lida', 'O WhatsApp não conseguiu decifrar uma mensagem recebida.', 'Pontual é esperado; repetição na mesma cliente pede reconexão.'],
  baileys: ['WhatsApp recusou a operação', 'A biblioteca recebeu uma recusa do WhatsApp.', 'Separar pelo código e conferir conexão da cliente.'],
  incoming_error: ['Falha ao preparar a oferta', 'A oferta falhou antes de chegar à etapa de envio.', 'Abrir a assinatura técnica e identificar a loja envolvida.'],
  conversion: ['Falha ao transformar o link', 'Uma loja ou credencial impediu a conversão em afiliado.', 'Ver cliente e loja; validar credencial ou resposta da loja.'],
  credential_expired: ['Credencial precisa de atenção', 'A loja recusou ou perdeu a credencial cadastrada.', 'Pedir renovação à cliente; a oferta pode ter usado fallback.'],
  config_block: ['Bloqueado por configuração', 'O robô seguiu uma regra ou encontrou cadastro incompleto.', 'Não é pane: mostrar à cliente qual configuração corrigir.'],
  dedup: ['Repetição evitada', 'A mesma oferta foi bloqueada para não ser publicada de novo.', 'Comportamento esperado; investigar só se o volume fugir do padrão.'],
  other: ['Falha ainda não classificada', 'Existe erro, mas a causa ainda não ganhou uma categoria própria.', 'Priorizar assinatura nova e criar classificação depois do diagnóstico.'],
  unknown: ['Sem classificação', 'Registro antigo ou fora do contrato atual.', 'Ler a amostra técnica e classificar antes que se repita.'],
}

const nf = value => new Intl.NumberFormat('pt-BR').format(Number(value || 0))
const when = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
const copyFor = category => COPY[category] || COPY.unknown

function Stat({ label, value, note, tone = 'slate' }) {
  const colors = { red: 'border-red-200 bg-red-50 text-red-950', amber: 'border-amber-200 bg-amber-50 text-amber-950', blue: 'border-blue-200 bg-blue-50 text-blue-950', slate: 'border-slate-200 bg-white text-slate-950' }
  return <article className={`rounded-2xl border p-4 ${colors[tone]}`}><p className="text-[11px] font-black uppercase tracking-[.18em] opacity-60">{label}</p><p className="mt-2 text-3xl font-black tabular-nums">{nf(value)}</p><p className="mt-1 text-xs opacity-70">{note}</p></article>
}

function Trend({ rows }) {
  const max = Math.max(1, ...rows.map(row => row.incidents))
  return <div className="flex h-36 items-end gap-1" aria-label="Erros reais por hora">{rows.map(row => <div key={row.at} className="group relative flex min-w-0 flex-1 items-end"><div className="w-full rounded-t-sm bg-red-500 transition hover:bg-red-700" style={{ height: `${Math.max(4, row.incidents / max * 100)}%` }} /><span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[10px] text-white group-hover:block">{when(row.at)} · {nf(row.incidents)}</span></div>)}</div>
}

export default function AdminErrorsPage() {
  const [period, setPeriod] = useState('24h')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kind, setKind] = useState('incident')
  const [query, setQuery] = useState('')

  async function load(nextPeriod = period) {
    setLoading(true); setError('')
    try { await api.adminMe(); setData(await api.adminErrorObservability(nextPeriod)) }
    catch (err) { setError(err.message || 'Não foi possível carregar os erros.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    Promise.all([api.adminMe(), api.adminErrorObservability(period)])
      .then(([, result]) => { if (active) { setData(result); setError('') } })
      .catch(err => { if (active) setError(err.message || 'Não foi possível carregar os erros.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period])

  const groups = useMemo(() => (data?.groups || []).filter(row => row.kind === kind && (!query || `${row.key} ${copyFor(row.category).join(' ')}`.toLowerCase().includes(query.toLowerCase()))), [data, kind, query])
  if (loading && !data) return <LoadingState title="Lendo os erros" message="Agrupando causas, novidades e clientes afetadas." />

  return <main className="min-h-screen bg-[#f4f3ef] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-[28px] border border-slate-300 bg-[#101820] p-6 text-white shadow-xl shadow-slate-900/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.28em] text-red-300">Central de diagnóstico</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Erros, sem adivinhação.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">O que falhou, o que apareceu pela primeira vez e quem está sentindo o impacto. Bloqueios esperados ficam separados para não parecer incidente.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Período" value={period} onChange={event => setPeriod(event.target.value)} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold"><option className="text-slate-950" value="6h">Últimas 6h</option><option className="text-slate-950" value="24h">Últimas 24h</option><option className="text-slate-950" value="7d">Últimos 7 dias</option></select><button onClick={() => load()} className="rounded-xl bg-red-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-red-300">Atualizar</button><Link href="/admin" className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold hover:bg-white/10">Voltar</Link></div></div>
      </header>
      {error && <Alert type="error" title="Falha ao carregar" message={error} />}
      {data && <>
        {(data.dataCoverage?.currentTruncated || data.dataCoverage?.baselineTruncated) && <Alert type="warning" title="Recorte parcial" message={`A janela ultrapassou ${nf(data.dataCoverage.rowLimit)} registros. Os números abaixo representam os eventos mais recentes; reduza o período para uma leitura completa.`} />}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Falhas reais" value={data.totals.incidents} note="pedem diagnóstico" tone="red" /><Stat label="Causas novas" value={data.totals.newSignatures} note="não vistas nos 7 dias anteriores" tone="amber" /><Stat label="Clientes afetadas" value={data.totals.affectedUsers} note="por ao menos uma falha real" tone="blue" /><Stat label="Bloqueios esperados" value={data.totals.expectedBlocks} note="regras, cadastro e repetições" /></section>
        <section className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]"><article className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-red-700">Pulso</p><h2 className="mt-1 text-xl font-black">Falhas reais ao longo do tempo</h2></div><span className="text-xs text-slate-500">cada barra = 1 hora com evento</span></div><div className="mt-5"><Trend rows={data.trend || []} /></div></article><article className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-widest text-slate-500">Onde concentra</p><h2 className="mt-1 text-xl font-black">Tipos de ocorrência</h2><div className="mt-4 space-y-3">{(data.categories || []).slice(0, 6).map(row => <div key={row.category}><div className="flex justify-between gap-3 text-sm"><span className="font-bold">{copyFor(row.category)[0]}</span><span className="tabular-nums text-slate-500">{nf(row.count)} · {nf(row.affectedUsers)} clientes</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-slate-800" style={{ width: `${Math.max(3, row.count / Math.max(1, data.categories[0]?.count) * 100)}%` }} /></div></div>)}</div></article></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-red-700">Causas agrupadas</p><h2 className="mt-1 text-2xl font-black">O que está acontecendo</h2></div><div className="flex flex-wrap gap-2"><button onClick={() => setKind('incident')} className={`rounded-xl px-3 py-2 text-sm font-bold ${kind === 'incident' ? 'bg-red-600 text-white' : 'bg-slate-100'}`}>Falhas reais</button><button onClick={() => setKind('expected_block')} className={`rounded-xl px-3 py-2 text-sm font-bold ${kind === 'expected_block' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>Bloqueios esperados</button><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar causa" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div></div><div className="mt-5 divide-y divide-slate-100">{groups.map(row => { const copy = copyFor(row.category); return <article key={row.key} className="grid gap-3 py-4 md:grid-cols-[1fr_110px_130px]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{copy[0]}</h3>{row.isNew && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800">Nova</span>}<span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{row.category}</span></div><p className="mt-1 text-sm text-slate-600">{copy[1]}</p><p className="mt-2 text-xs font-semibold text-slate-800">Próximo passo: {copy[2]}</p><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer font-bold">Ver assinatura técnica</summary><code className="mt-2 block break-all rounded-lg bg-slate-950 p-2 text-slate-200">{row.key}</code></details></div><div><p className="text-2xl font-black tabular-nums">{nf(row.count)}</p><p className="text-xs text-slate-500">ocorrências</p><p className="mt-2 text-sm font-bold">{nf(row.affectedUsers)}</p><p className="text-xs text-slate-500">clientes</p></div><div className="text-xs text-slate-500"><p>Primeiro nesta janela</p><p className="font-bold text-slate-800">{when(row.firstSeenAt)}</p><p className="mt-2">Mais recente</p><p className="font-bold text-slate-800">{when(row.lastSeenAt)}</p></div></article>})}{!groups.length && <p className="py-8 text-center text-sm text-slate-500">Nenhuma ocorrência neste recorte.</p>}</div></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-widest text-blue-700">Impacto humano</p><h2 className="mt-1 text-2xl font-black">Quem está tendo esses erros</h2><p className="mt-1 text-sm text-slate-500">Ordenado por falhas reais. Abra o histórico para ver conexão, lojas, uso e contexto da cliente.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="py-3">Cliente</th><th>Plano</th><th>Falhas</th><th>Tipos</th><th>Última</th><th></th></tr></thead><tbody>{(data.impactedUsers || []).map(user => <tr key={user.userId} className="border-b border-slate-100"><td className="py-3"><p className="font-bold">{user.name || 'Sem nome'}</p><p className="text-xs text-slate-500">{user.email || user.userId}</p></td><td>{user.plan || '—'}</td><td className="font-black tabular-nums text-red-700">{nf(user.count)}</td><td><div className="flex flex-wrap gap-1">{user.categories.slice(0, 3).map(category => <span key={category} className="rounded bg-slate-100 px-2 py-1 text-xs">{copyFor(category)[0]}</span>)}</div></td><td className="text-xs text-slate-500">{when(user.lastSeenAt)}</td><td className="text-right"><Link href={`/admin/clientes/${encodeURIComponent(user.userId)}`} className="font-bold text-blue-700 hover:underline">Abrir histórico →</Link></td></tr>)}</tbody></table></div></section>
      </>}
    </div>
  </main>
}
