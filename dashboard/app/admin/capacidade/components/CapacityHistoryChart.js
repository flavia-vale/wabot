'use client'

const numeric = (number) => Number.isFinite(Number(number)) ? Number(number) : null
const dateLabel = (date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit' }).format(new Date(date))
const number = (value, suffix = '') => numeric(value) == null ? '—' : `${Math.round(numeric(value) * 10) / 10}${suffix}`
const confidence = { high: 'alta', medium: 'média', low: 'baixa', insufficient: 'insuficiente' }
const resourceSeries = [
  { key: 'memoryAvailableMb', label: 'RAM disponível', suffix: ' MB', color: '#0891b2' },
  { key: 'swapUsedMb', label: 'Swap utilizado', suffix: ' MB', color: '#7c3aed' },
  { key: 'cpuPercent', label: 'CPU utilizada', suffix: '%', color: '#2563eb' },
  { key: 'diskUsedPercent', label: 'Disco utilizado', suffix: '%', color: '#d97706' },
]

// Return separate polylines so a missing observation remains a visible gap
// instead of being silently bridged by the chart.
const segments = (points, key, max) => {
  const result = []; let current = []
  points.forEach((point, index) => {
    const value = numeric(point[key])
    if (value == null) { if (current.length) result.push(current); current = []; return }
    current.push(`${points.length === 1 ? 0 : index / (points.length - 1) * 100},${100 - value / max * 90}`)
  })
  if (current.length) result.push(current)
  return result
}

export default function CapacityHistoryChart({ history, forecast, loading }) {
  const points = history?.points || []
  const drawable = points.filter((point) => point.at && numeric(point.connectedSessions) != null)
  const max = Math.max(1, ...drawable.flatMap((point) => [numeric(point.connectedSessions) || 0, numeric(point.productionWorkers) || 0, numeric(point.safeSessionLimit) || 0]))
  const coords = (key) => drawable.map((point, index) => numeric(point[key]) == null ? null : `${drawable.length === 1 ? 0 : index / (drawable.length - 1) * 100},${100 - numeric(point[key]) / max * 90}`).filter(Boolean).join(' ')
  const firstAt = drawable[0]?.at ? new Date(drawable[0].at).getTime() : null; const lastAt = drawable.at(-1)?.at ? new Date(drawable.at(-1).at).getTime() : null
  const eventMarkers = (history?.events || []).map((event) => ({ ...event, x: firstAt != null && lastAt > firstAt ? Math.max(0, Math.min(100, (new Date(event.occurredAt).getTime() - firstAt) / (lastAt - firstAt) * 100)) : 0 }))
  const growthRows = [7, 30, 90].map((days) => forecast?.growth?.[days]).filter(Boolean)
  if (loading && !history) return <section className="rounded-2xl bg-white p-5" aria-busy="true">Carregando histórico…</section>
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="capacity-history-title">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 id="capacity-history-title" className="text-lg font-black text-slate-950">Histórico e previsão</h2><p className="text-sm text-slate-600">Sessões, workers e limite compartilham o eixo. Lacunas permanecem desconhecidas.</p></div><p className="text-sm font-bold text-slate-700">Confiança: {confidence[forecast?.confidence] || 'insuficiente'}</p></div>
    {drawable.length > 1 ? <div className="relative mt-5 overflow-hidden rounded-xl bg-slate-50 p-3"><svg role="img" aria-labelledby="capacity-chart-title capacity-chart-desc" viewBox="0 0 100 105" className="h-64 w-full motion-reduce:transition-none" preserveAspectRatio="none"><title id="capacity-chart-title">Histórico de sessões, workers, limite seguro e eventos</title><desc id="capacity-chart-desc">Linha sólida azul representa sessões conectadas, linha cinza representa workers e linha tracejada laranja representa limite seguro. Losangos marcam eventos no mesmo eixo temporal; detalhes aparecem abaixo.</desc><polyline points={coords('safeSessionLimit')} fill="none" stroke="#d97706" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/><polyline points={coords('productionWorkers')} fill="none" stroke="#64748b" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><polyline points={coords('connectedSessions')} fill="none" stroke="#0891b2" strokeWidth="2" vectorEffect="non-scaling-stroke"/>{eventMarkers.map((event, index) => <rect key={`${event.occurredAt}-${index}`} x={event.x - 1} y="1" width="2" height="2" transform={`rotate(45 ${event.x} 2)`} fill="#be123c"><title>{event.title} · {dateLabel(event.occurredAt)}</title></rect>)}</svg></div> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">Histórico insuficiente para desenhar a série.</p>}
    <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-700"><span>━ Sessões</span><span>━ Workers</span><span>┄ Limite seguro</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Histórico dos recursos do host">
      {resourceSeries.map((series) => { const values = points.map((point) => numeric(point[series.key])).filter((value) => value != null); const ceiling = Math.max(1, ...values); const paths = segments(points, series.key, ceiling); return <figure key={series.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><figcaption className="flex items-center justify-between gap-2 text-sm font-black text-slate-900"><span>{series.label}</span><span className="tabular-nums text-slate-600">{number(values.at(-1), series.suffix)}</span></figcaption>{paths.length ? <svg role="img" aria-label={`${series.label} no período; lacunas representam dados ausentes`} viewBox="0 0 100 105" className="mt-2 h-24 w-full" preserveAspectRatio="none">{paths.map((path, index) => <polyline key={index} points={path.join(' ')} fill="none" stroke={series.color} strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}</svg> : <p className="mt-2 text-sm text-slate-600">Sem observações no período.</p>}</figure> })}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-cyan-50 p-4"><h3 className="font-black text-cyan-950">Horizonte provável</h3>{forecast?.centralThresholdAt ? <><p className="mt-1 text-sm">Central: <strong>{dateLabel(forecast.centralThresholdAt)}</strong></p><p className="text-sm">Faixa: {dateLabel(forecast.range.earliestAt)} a {dateLabel(forecast.range.latestAt)}</p></> : <p className="mt-1 text-sm">{forecast?.explanation || 'Ainda não há histórico estável suficiente.'}</p>}</div><div className="rounded-xl bg-slate-50 p-4"><h3 className="font-black text-slate-900">Crescimento líquido</h3><ul className="mt-1 grid grid-cols-3 gap-2">{[7, 30, 90].map((days) => { const row = forecast?.growth?.[days]; return <li key={days}><strong className="block tabular-nums">{row?.net == null ? '—' : `${row.net >= 0 ? '+' : ''}${number(row.net)}`}</strong><span className="text-xs text-slate-600">{days} dias</span></li> })}</ul>{growthRows.length === 0 && <p className="text-sm text-slate-600">Sem dados comparáveis.</p>}</div></div>
    {(history?.events || []).length > 0 && <div className="mt-4"><h3 className="text-sm font-black text-slate-900">Eventos no período</h3><ol className="mt-2 space-y-2">{history.events.map((event, index) => <li key={`${event.occurredAt}-${event.type}-${index}`} className="border-l-2 border-cyan-700 pl-3 text-sm"><time className="font-semibold">{dateLabel(event.occurredAt)}</time> · {event.title} <span className="text-slate-500">({event.source})</span></li>)}</ol></div>}
    <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-cyan-800">Ver tabela equivalente com todas as séries</summary><div className="max-h-80 overflow-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead><tr>{['Data','Estado','Sessões','Workers','Limite','RAM disponível','RAM livre','Cache','RSS processos','CPU','Load 1/5/15','Swap','Swap in/out','Disco','Inodes'].map((heading) => <th className="p-2" key={heading}>{heading}</th>)}</tr></thead><tbody>{points.map((point, index) => <tr key={`${point.at}-${index}`} className="border-t border-slate-100"><td className="p-2">{dateLabel(point.at)}</td><td className="p-2">{point.state || '—'}</td><td className="p-2 tabular-nums">{point.connectedSessions ?? '—'}</td><td className="p-2 tabular-nums">{point.productionWorkers ?? '—'}</td><td className="p-2 tabular-nums">{point.safeSessionLimit ?? '—'}</td><td className="p-2 tabular-nums">{number(point.memoryAvailableMb, ' MB')}</td><td className="p-2 tabular-nums">{number(point.memoryFreeMb, ' MB')}</td><td className="p-2 tabular-nums">{number(point.memoryCacheMb, ' MB')}</td><td className="p-2 tabular-nums">{number(point.processRssTotalMb, ' MB')}</td><td className="p-2 tabular-nums">{number(point.cpuPercent, '%')}</td><td className="p-2 tabular-nums">{number(point.load1)} / {number(point.load5)} / {number(point.load15)}</td><td className="p-2 tabular-nums">{number(point.swapUsedMb, ' MB')}</td><td className="p-2 tabular-nums">{number(point.swapInKbPerSec)} / {number(point.swapOutKbPerSec)} KB/s</td><td className="p-2 tabular-nums">{number(point.diskUsedPercent, '%')}</td><td className="p-2 tabular-nums">{number(point.inodeUsedPercent, '%')}</td></tr>)}</tbody></table></div></details>
  </section>
}
