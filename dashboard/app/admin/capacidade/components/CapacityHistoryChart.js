'use client'

// Histórico e previsão.
//
// Pedido da dona do produto (2026-09-05): "os gráficos não me dizem nada, não
// têm eixo X nem Y e não informam se estamos bem ou mal". Três mudanças:
//   1. VEREDITO em primeiro lugar, em uma frase — o gráfico passa a ilustrar
//      uma conclusão, em vez de ser a conclusão;
//   2. eixos identificados (valores à esquerda, datas embaixo, com unidade);
//   3. cada série pequena diz se está subindo ou caindo e se isso é bom.
//
// Os rótulos ficam em HTML ao redor do SVG, nunca dentro dele: o desenho usa
// `preserveAspectRatio="none"` (estica a escala) e texto lá dentro sairia
// deformado.

const numeric = (number) => Number.isFinite(Number(number)) ? Number(number) : null
const dateLabel = (date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit' }).format(new Date(date))
const dayLabel = (date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(date))
const number = (value, suffix = '') => numeric(value) == null ? '—' : `${Math.round(numeric(value) * 10) / 10}${suffix}`
const confidence = { high: 'alta', medium: 'média', low: 'baixa', insufficient: 'insuficiente' }
const resourceSeries = [
  // `goodWhenRising` diz o que é BOA notícia nesta série. Sem isso, uma linha
  // subindo parece sempre ruim (ou sempre boa), e é o oposto entre "RAM livre"
  // e "disco usado".
  { key: 'memoryAvailableMb', label: 'RAM disponível', suffix: ' MB', color: '#0891b2', goodWhenRising: true },
  { key: 'swapUsedMb', label: 'Swap utilizado', suffix: ' MB', color: '#7c3aed', goodWhenRising: false },
  { key: 'cpuPercent', label: 'CPU utilizada', suffix: '%', color: '#2563eb', goodWhenRising: false },
  { key: 'diskUsedPercent', label: 'Disco utilizado', suffix: '%', color: '#d97706', goodWhenRising: false },
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

// Veredito em uma frase: quantos robôs contra o limite seguro do período.
function readOccupancy(last) {
  const sessions = numeric(last?.connectedSessions) ?? numeric(last?.productionWorkers)
  const limit = numeric(last?.safeSessionLimit)
  if (sessions == null || !limit) return { tone: 'unknown', headline: 'Ainda não dá para dizer se estamos bem', detail: 'Falta medição de sessões ou do limite seguro no período.' }
  const usedPct = Math.round(sessions / limit * 100)
  if (usedPct >= 100) return { tone: 'critical', headline: 'Estamos NO LIMITE', detail: `${sessions} robôs para um limite seguro de ${limit}. Não abrir vaga nova antes de aumentar a memória.` }
  if (usedPct >= 85) return { tone: 'attention', headline: 'Estamos apertados', detail: `${sessions} robôs de ${limit} (${usedPct}%). Dá para planejar o aumento com calma, mas já é hora de planejar.` }
  return { tone: 'ok', headline: 'Estamos bem', detail: `${sessions} robôs de ${limit} que cabem com segurança (${usedPct}%). Ainda cabem ${limit - sessions}.` }
}

const VERDICT_TONE = {
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  attention: 'border-amber-300 bg-amber-50 text-amber-900',
  critical: 'border-red-300 bg-red-50 text-red-900',
  unknown: 'border-slate-300 bg-slate-100 text-slate-800',
}

// Tendência da série pequena: primeiro valor contra o último, com o sentido
// certo para cada recurso.
function readTrend(values, series) {
  if (values.length < 2) return null
  const first = values[0]
  const last = values.at(-1)
  const delta = last - first
  const base = Math.abs(first) || 1
  if (Math.abs(delta) / base < 0.05) return { text: 'estável no período', tone: 'text-slate-600' }
  const rising = delta > 0
  const good = rising === series.goodWhenRising
  return {
    text: `${rising ? 'subiu' : 'caiu'} ${number(Math.abs(delta), series.suffix)} no período — ${good ? 'bom sinal' : 'piorando'}`,
    tone: good ? 'text-emerald-700' : 'text-amber-700',
  }
}

function Eixos({ children, maxLabel, midLabel, minLabel, unidade, primeiraData, ultimaData }) {
  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <div className="flex w-16 shrink-0 flex-col justify-between py-1 text-right text-[10px] font-bold tabular-nums text-slate-500">
          <span>{maxLabel}</span>
          <span>{midLabel}</span>
          <span>{minLabel}</span>
        </div>
        <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2">{children}</div>
      </div>
      <div className="mt-1 flex gap-2">
        <span className="w-16 shrink-0 text-right text-[10px] font-bold uppercase tracking-wide text-slate-400">{unidade}</span>
        <span className="flex flex-1 justify-between text-[10px] font-bold text-slate-500"><span>{primeiraData}</span><span className="uppercase tracking-wide text-slate-400">tempo →</span><span>{ultimaData}</span></span>
      </div>
    </div>
  )
}

export default function CapacityHistoryChart({ history, forecast, loading }) {
  const points = history?.points || []
  const drawable = points.filter((point) => point.at && numeric(point.connectedSessions) != null)
  const max = Math.max(1, ...drawable.flatMap((point) => [numeric(point.connectedSessions) || 0, numeric(point.productionWorkers) || 0, numeric(point.safeSessionLimit) || 0]))
  const coords = (key) => drawable.map((point, index) => numeric(point[key]) == null ? null : `${drawable.length === 1 ? 0 : index / (drawable.length - 1) * 100},${100 - numeric(point[key]) / max * 90}`).filter(Boolean).join(' ')
  const firstAt = drawable[0]?.at ? new Date(drawable[0].at).getTime() : null; const lastAt = drawable.at(-1)?.at ? new Date(drawable.at(-1).at).getTime() : null
  const eventMarkers = (history?.events || []).map((event) => ({ ...event, x: firstAt != null && lastAt > firstAt ? Math.max(0, Math.min(100, (new Date(event.occurredAt).getTime() - firstAt) / (lastAt - firstAt) * 100)) : 0 }))
  const growthRows = [7, 30, 90].map((days) => forecast?.growth?.[days]).filter(Boolean)
  const verdict = readOccupancy(drawable.at(-1))
  if (loading && !history) return <section className="rounded-2xl bg-white p-5" aria-busy="true">Carregando histórico…</section>
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="capacity-history-title">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 id="capacity-history-title" className="text-lg font-black text-slate-950">Histórico e previsão</h2><p className="text-sm text-slate-600">Quantos robôs estavam no ar ao longo do período, contra o limite que cabe com segurança.</p></div><p className="text-sm font-bold text-slate-700">Confiança da previsão: {confidence[forecast?.confidence] || 'insuficiente'}</p></div>

    <p className={`mt-4 rounded-xl border-2 p-4 text-sm font-bold ${VERDICT_TONE[verdict.tone]}`}>{verdict.headline}. <span className="font-semibold">{verdict.detail}</span></p>

    {drawable.length > 1 ? <>
      <Eixos
        maxLabel={Math.round(max)}
        midLabel={Math.round(max / 2)}
        minLabel="0"
        unidade="robôs"
        primeiraData={firstAt ? dayLabel(firstAt) : '—'}
        ultimaData={lastAt ? dayLabel(lastAt) : '—'}
      >
        <svg role="img" aria-labelledby="capacity-chart-title capacity-chart-desc" viewBox="0 0 100 105" className="h-64 w-full motion-reduce:transition-none" preserveAspectRatio="none"><title id="capacity-chart-title">Histórico de sessões, workers, limite seguro e eventos</title><desc id="capacity-chart-desc">Eixo vertical em número de robôs, de zero ao máximo do período; eixo horizontal em tempo, da data mais antiga à mais recente. Linha azul: robôs conectados. Linha cinza: processos no ar. Linha tracejada laranja: limite seguro. Losangos marcam eventos.</desc>
          <line x1="0" y1="10" x2="100" y2="10" stroke="#e2e8f0" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
          <line x1="0" y1="55" x2="100" y2="55" stroke="#e2e8f0" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
          <line x1="0" y1="100" x2="100" y2="100" stroke="#94a3b8" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
          <polyline points={coords('safeSessionLimit')} fill="none" stroke="#d97706" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/><polyline points={coords('productionWorkers')} fill="none" stroke="#64748b" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><polyline points={coords('connectedSessions')} fill="none" stroke="#0891b2" strokeWidth="2" vectorEffect="non-scaling-stroke"/>{eventMarkers.map((event, index) => <rect key={`${event.occurredAt}-${index}`} x={event.x - 1} y="1" width="2" height="2" transform={`rotate(45 ${event.x} 2)`} fill="#be123c"><title>{event.title} · {dateLabel(event.occurredAt)}</title></rect>)}</svg>
      </Eixos>
      <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-slate-700"><span className="text-cyan-700">━ Robôs conectados</span><span className="text-slate-500">━ Processos no ar</span><span className="text-amber-700">┄ Limite seguro</span><span className="text-rose-700">◆ Acontecimento</span></div>
    </> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">Histórico insuficiente para desenhar a série.</p>}

    <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Histórico dos recursos do host">
      {resourceSeries.map((series) => {
        const values = points.map((point) => numeric(point[series.key])).filter((value) => value != null)
        const ceiling = Math.max(1, ...values)
        const paths = segments(points, series.key, ceiling)
        const trend = readTrend(values, series)
        return <figure key={series.key} className="rounded-xl border border-slate-200 bg-white p-3">
          <figcaption className="flex items-center justify-between gap-2 text-sm font-black text-slate-900"><span>{series.label}</span><span className="tabular-nums text-slate-600">agora: {number(values.at(-1), series.suffix)}</span></figcaption>
          {trend && <p className={`text-xs font-bold ${trend.tone}`}>{trend.text}</p>}
          {paths.length ? <div className="mt-2 flex gap-2">
            <div className="flex w-14 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] font-bold tabular-nums text-slate-500"><span>{number(ceiling, series.suffix)}</span><span>0</span></div>
            <div className="min-w-0 flex-1 rounded-lg bg-slate-50 p-1">
              <svg role="img" aria-label={`${series.label} no período; eixo vertical de zero a ${number(ceiling, series.suffix)}; lacunas representam dados ausentes`} viewBox="0 0 100 105" className="h-24 w-full" preserveAspectRatio="none">
                <line x1="0" y1="100" x2="100" y2="100" stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
                {paths.map((path, index) => <polyline key={index} points={path.join(' ')} fill="none" stroke={series.color} strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}
              </svg>
            </div>
          </div> : <p className="mt-2 text-sm text-slate-600">Sem observações no período.</p>}
          {paths.length > 0 && <p className="mt-1 pl-16 text-[10px] font-bold text-slate-400">{points[0]?.at ? dayLabel(points[0].at) : ''} → {points.at(-1)?.at ? dayLabel(points.at(-1).at) : ''}</p>}
        </figure>
      })}
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-cyan-50 p-4"><h3 className="font-black text-cyan-950">Quando o limite chega</h3>{forecast?.centralThresholdAt ? <><p className="mt-1 text-sm">Provavelmente em <strong>{dateLabel(forecast.centralThresholdAt)}</strong></p><p className="text-sm">Entre {dateLabel(forecast.range.earliestAt)} e {dateLabel(forecast.range.latestAt)}</p></> : <p className="mt-1 text-sm">{forecast?.explanation || 'Ainda não há histórico estável suficiente.'}</p>}</div><div className="rounded-xl bg-slate-50 p-4"><h3 className="font-black text-slate-900">Quantos robôs entraram</h3><ul className="mt-1 grid grid-cols-3 gap-2">{[7, 30, 90].map((days) => { const row = forecast?.growth?.[days]; return <li key={days}><strong className="block tabular-nums">{row?.net == null ? '—' : `${row.net >= 0 ? '+' : ''}${number(row.net)}`}</strong><span className="text-xs text-slate-600">em {days} dias</span></li> })}</ul>{growthRows.length === 0 && <p className="text-sm text-slate-600">Sem dados comparáveis.</p>}</div></div>

    {(history?.events || []).length > 0 && <div className="mt-4"><h3 className="text-sm font-black text-slate-900">Acontecimentos no período</h3><ol className="mt-2 space-y-2">{history.events.map((event, index) => <li key={`${event.occurredAt}-${event.type}-${index}`} className="border-l-2 border-cyan-700 pl-3 text-sm"><time className="font-semibold">{dateLabel(event.occurredAt)}</time> · {event.title} <span className="text-slate-500">({event.source})</span></li>)}</ol></div>}
    <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-cyan-800">Ver tabela equivalente com todas as séries</summary><div className="max-h-80 overflow-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead><tr>{['Data','Estado','Sessões','Workers','Limite','RAM disponível','RAM livre','Cache','RSS processos','CPU','Load 1/5/15','Swap','Swap in/out','Disco','Inodes'].map((heading) => <th className="p-2" key={heading}>{heading}</th>)}</tr></thead><tbody>{points.map((point, index) => <tr key={`${point.at}-${index}`} className="border-t border-slate-100"><td className="p-2">{dateLabel(point.at)}</td><td className="p-2">{point.state || '—'}</td><td className="p-2 tabular-nums">{point.connectedSessions ?? '—'}</td><td className="p-2 tabular-nums">{point.productionWorkers ?? '—'}</td><td className="p-2 tabular-nums">{point.safeSessionLimit ?? '—'}</td><td className="p-2 tabular-nums">{number(point.memoryAvailableMb, ' MB')}</td><td className="p-2 tabular-nums">{number(point.memoryFreeMb, ' MB')}</td><td className="p-2 tabular-nums">{number(point.memoryCacheMb, ' MB')}</td><td className="p-2 tabular-nums">{number(point.processRssTotalMb, ' MB')}</td><td className="p-2 tabular-nums">{number(point.cpuPercent, '%')}</td><td className="p-2 tabular-nums">{number(point.load1)} / {number(point.load5)} / {number(point.load15)}</td><td className="p-2 tabular-nums">{number(point.swapUsedMb, ' MB')}</td><td className="p-2 tabular-nums">{number(point.swapInKbPerSec)} / {number(point.swapOutKbPerSec)} KB/s</td><td className="p-2 tabular-nums">{number(point.diskUsedPercent, '%')}</td><td className="p-2 tabular-nums">{number(point.inodeUsedPercent, '%')}</td></tr>)}</tbody></table></div></details>
  </section>
}
