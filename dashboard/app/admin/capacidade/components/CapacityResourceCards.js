// Recursos do host: um cartão por recurso, com COR do estado e barra de uso.
//
// Antes eram quatro caixas brancas iguais com uma lista de números e uma
// bolinha cinza no rodapé — dava para ler tudo e não saber se estava bem ou
// mal. Pedido da dona do produto (2026-09-05): a cor tem que responder isso
// antes da leitura.
//
// A barra mostra sempre "quanto do recurso está EM USO", nunca o que sobra:
// duas barras com sentidos opostos na mesma tela é o jeito mais rápido de ler
// errado.
const STATE = {
  healthy: { label: 'Saudável', card: 'border-emerald-300 bg-emerald-50', bar: 'bg-emerald-500', chip: 'bg-emerald-600 text-white', value: 'text-emerald-950' },
  attention: { label: 'Atenção', card: 'border-amber-300 bg-amber-50', bar: 'bg-amber-500', chip: 'bg-amber-500 text-white', value: 'text-amber-950' },
  critical: { label: 'Crítico', card: 'border-red-300 bg-red-50', bar: 'bg-red-500', chip: 'bg-red-600 text-white', value: 'text-red-950' },
  unknown: { label: 'Sem medição', card: 'border-slate-300 bg-slate-100', bar: 'bg-slate-400', chip: 'bg-slate-500 text-white', value: 'text-slate-900' },
}
const normalize = (state) => STATE[state] ? state : 'unknown'
const pct = (value) => value == null ? '—' : `${Math.round(value)}%`
const mb = (value) => value == null ? '—' : value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${Math.round(value)} MB`
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null
const share = (part, total) => { const a = finite(part); const b = finite(total); return a == null || !b ? null : Math.max(0, Math.min(100, a / b * 100)) }

export default function CapacityResourceCards({ resources = {}, health = {} }) {
  const memoryUsedPercent = resources.memory?.totalMb && resources.memory?.availableMb != null
    ? share(resources.memory.totalMb - resources.memory.availableMb, resources.memory.totalMb)
    : null
  const cards = [
    {
      key: 'memory',
      title: 'Memória RAM',
      value: pct(memoryUsedPercent),
      usedPercent: memoryUsedPercent,
      resume: `${mb(resources.memory?.availableMb)} livres de ${mb(resources.memory?.totalMb)}`,
      details: [`Livre de fato: ${mb(resources.memory?.freeMb)}`, `Cache recuperável: ${mb(resources.memory?.cacheMb)}`, `Processos (RSS): ${mb(resources.memory?.processRssMb)}`],
    },
    {
      key: 'cpu',
      title: 'CPU e carga',
      value: pct(resources.cpu?.percent),
      usedPercent: finite(resources.cpu?.percent),
      resume: `carga 1 min: ${resources.cpu?.load1 ?? '—'}`,
      details: [`Load 5 min: ${resources.cpu?.load5 ?? '—'}`, `Load 15 min: ${resources.cpu?.load15 ?? '—'}`],
    },
    {
      key: 'disk',
      title: 'Disco',
      value: pct(resources.disk?.usedPercent),
      usedPercent: finite(resources.disk?.usedPercent),
      resume: `${mb(resources.disk?.availableMb)} livres de ${mb(resources.disk?.totalMb)}`,
      details: [`Usado: ${mb(resources.disk?.usedMb)}`, `Inodes usados: ${pct(resources.disk?.inodeUsedPercent)}`],
    },
    {
      key: 'swap',
      title: 'Swap',
      value: pct(share(resources.swap?.usedMb, resources.swap?.totalMb)),
      usedPercent: share(resources.swap?.usedMb, resources.swap?.totalMb),
      resume: `${mb(resources.swap?.usedMb)} em uso de ${mb(resources.swap?.totalMb)}`,
      // Swap ocupado NÃO é capacidade extra; o que denuncia falta de memória é
      // haver movimento (entrada/saída), não o valor parado.
      details: [`Entrada: ${resources.swap?.inKbPerSec == null ? '—' : resources.swap.inKbPerSec} KB/s`, `Saída: ${resources.swap?.outKbPerSec == null ? '—' : resources.swap.outKbPerSec} KB/s`, health.swap?.active ? 'Há movimento de swap agora — sinal de falta de memória.' : 'Ocupado, sem movimento: não é falta de memória agora.'],
    },
  ]
  return <section aria-labelledby="capacity-resources-title"><h2 id="capacity-resources-title" className="mb-3 text-lg font-black text-slate-950">Recursos do host</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => {
    const state = normalize(health[card.key]?.state)
    const style = STATE[state]
    return <article key={card.key} className={`rounded-2xl border-2 p-5 shadow-sm ${style.card}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-black text-slate-800">{card.title}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${style.chip}`}>{style.label}</span>
      </div>
      <strong className={`mt-2 block text-3xl tabular-nums ${style.value}`}>{card.value}</strong>
      <p className="text-xs font-semibold text-slate-600">{card.usedPercent == null ? 'sem medição' : 'em uso'} · {card.resume}</p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/70 ring-1 ring-black/5" role="img" aria-label={`${card.title}: ${card.value} em uso`}>
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.max(2, Math.min(100, card.usedPercent ?? 0))}%` }} />
      </div>
      <ul className="mt-3 space-y-1 text-xs text-slate-600">{card.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
    </article>
  })}</div></section>
}
