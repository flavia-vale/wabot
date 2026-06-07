'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader } from './PainelShell'

function greeting(hour) {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function firstName(user) {
  const n = (user?.name || '').trim()
  return n ? n.split(/\s+/)[0] : 'por aqui'
}

function relativeFromNow(iso) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  const diffMin = Math.round((Date.now() - then) / 60000)
  if (diffMin < 1) return 'agora mesmo'
  if (diffMin < 60) return `há ${diffMin} min`
  const h = Math.round(diffMin / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return `há ${d} d`
}

function shortTitle(text) {
  const firstLine = String(text || '').split('\n').map((l) => l.trim()).find(Boolean) || ''
  const clean = firstLine.replace(/https?:\/\/\S+/g, '').trim()
  if (!clean) return 'Mensagem enviada'
  return clean.length > 64 ? `${clean.slice(0, 63)}…` : clean
}

const STATUS_TAG = {
  success: { cls: 'is-success', label: 'enviado' },
  error: { cls: 'is-error', label: 'falhou' },
  skipped: { cls: 'is-skip', label: 'ignorado' },
  queued: { cls: 'is-flight', label: 'na fila' },
  sending: { cls: 'is-flight', label: 'enviando' },
}

function StatusTag({ status }) {
  const t = STATUS_TAG[status] || { cls: 'is-skip', label: status || '—' }
  return <span className={`pnl-tag ${t.cls}`}>{t.label}</span>
}

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0
}

export default function PainelPage() {
  const { online } = usePainel()
  const { user } = usePainel()

  const [summary, setSummary] = useState(null)
  const [recent, setRecent] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [period, setPeriod] = useState('today')
  const [series, setSeries] = useState(null)

  const now = useMemo(() => new Date(), [])
  const dateLabel = useMemo(
    () => now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
    [now],
  )
  const subtitle = `${greeting(now.getHours())}, ${firstName(user)} — ${dateLabel}`
  usePainelHeader({ title: 'Painel', subtitle })

  useEffect(() => {
    let active = true
    Promise.allSettled([api.logsSummary(period), api.logs('all', 1, 6)]).then(([s, r]) => {
      if (!active) return
      if (s.status === 'fulfilled') setSummary(s.value)
      else setLoadError('Não foi possível carregar as métricas do período.')
      if (r.status === 'fulfilled') setRecent(Array.isArray(r.value?.logs) ? r.value.logs : [])
      else setRecent([])
    })
    return () => { active = false }
  }, [period])

  // Série de 7 dias para o gráfico de colunas — independente do período dos KPIs.
  useEffect(() => {
    let active = true
    api.logsSeries(7)
      .then((s) => { if (active) setSeries(Array.isArray(s?.buckets) ? s.buckets : []) })
      .catch(() => { if (active) setSeries([]) })
    return () => { active = false }
  }, [])

  const PERIODS = [
    { key: 'today', label: 'Hoje', word: 'hoje' },
    { key: '7d', label: '7 dias', word: 'em 7 dias' },
    { key: '30d', label: '30 dias', word: 'em 30 dias' },
  ]
  const periodWord = PERIODS.find((p) => p.key === period)?.word ?? 'hoje'

  const counts = summary?.counts
  const success = num(counts?.success)
  const blocked = num(counts?.skippedConfig)
  const dedup = num(counts?.skippedDedup)
  const failed = num(counts?.timeoutTotal) + num(counts?.errorOther)
  const detected = success + dedup + blocked + failed
  const passedFilters = success + failed
  const deliveryRate = typeof summary?.deliveryRate === 'number' ? Math.round(summary.deliveryRate * 100) : null
  const lastRel = relativeFromNow(summary?.lastSendAt)
  const topDest = Array.isArray(summary?.topDestinations) ? summary.topDestinations : []
  const maxDest = topDest.reduce((m, d) => Math.max(m, num(d.sent)), 0) || 1
  const topSrc = Array.isArray(summary?.topSources) ? summary.topSources : []
  const maxSrc = topSrc.reduce((m, d) => Math.max(m, num(d.sent) + num(d.blocked)), 0) || 1

  const donutSegments = [
    { label: 'Entregues', value: success, color: 'var(--accent-strong)' },
    { label: 'Repetições bloqueadas', value: dedup, color: 'var(--accent-2)' },
    { label: 'Bloqueados pela regra', value: blocked, color: 'var(--accent-3)' },
    { label: 'Falhas', value: failed, color: 'var(--danger)' },
  ].filter((s) => s.value > 0)
  const donutTotal = donutSegments.reduce((sum, s) => sum + s.value, 0)

  const funnel = [
    { label: 'Detectados nos grupos', value: detected },
    { label: 'Passaram nos filtros', value: passedFilters },
    { label: 'Entregues', value: success },
  ]
  const funnelBase = detected || 1

  const loadingSummary = summary === null && !loadError
  const loadingRecent = recent === null

  return (
    <div className="pnl-grid" style={{ maxWidth: 1080, margin: '0 auto' }}>
      {/* Seletor de período */}
      <div className="pnl-chips">
        {PERIODS.map((p) => (
          <button key={p.key} type="button" className={`pnl-chip${period === p.key ? ' is-active' : ''}`} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Hero */}
      <section className="pnl-hero">
        <div>
          <div className="pnl-hero-label">Mensagens postadas {periodWord}</div>
          {loadingSummary
            ? <div className="pnl-skel" style={{ width: 120, height: 48, margin: '8px 0' }} />
            : <div className="pnl-hero-num pnl-serif">{success}</div>}
          <div className="pnl-hero-sub">
            {loadingSummary ? '—' : lastRel ? `último envio ${lastRel}` : 'nenhum envio registrado hoje'}
            {dedup > 0 && !loadingSummary ? ` · ${dedup} repetições bloqueadas` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <span className="pnl-hero-pill">{online === null ? 'verificando…' : online ? 'bot online' : 'bot offline'}</span>
          {deliveryRate !== null && <span className="pnl-hero-sub">{deliveryRate}% entregues</span>}
        </div>
      </section>

      {loadError && (
        <div className="pnl-card" style={{ borderColor: 'color-mix(in oklab, var(--danger) 40%, transparent)' }}>
          <p className="pnl-card-title" style={{ color: 'var(--danger)' }}>Falha ao carregar métricas</p>
          <p className="pnl-card-note">{loadError} Verifique sua conexão e recarregue a página.</p>
        </div>
      )}

      {/* KPIs */}
      <section className="pnl-kpis">
        <Kpi label="Postados hoje" value={success} foot={lastRel ? `último ${lastRel}` : 'sem envios ainda'} loading={loadingSummary} />
        <Kpi label="Processados" value={detected} foot="links lidos nos grupos" loading={loadingSummary} />
        <Kpi label="Bloqueados pela regra" value={blocked} foot="fora dos filtros" loading={loadingSummary} />
        <Kpi label="Taxa de entrega" value={deliveryRate === null ? '—' : `${deliveryRate}%`} foot={`${success} de ${passedFilters || 0}`} loading={loadingSummary} />
      </section>

      <div className="pnl-grid" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
        {/* Funil */}
        <section className="pnl-card">
          <div className="pnl-card-title">Funil do espelhamento</div>
          <div className="pnl-card-note">do link detectado até a entrega · hoje</div>
          {loadingSummary ? (
            <div className="pnl-funnel">
              {[0, 1, 2].map((k) => <div key={k} className="pnl-skel" style={{ height: 24 }} />)}
            </div>
          ) : detected === 0 ? (
            <p className="pnl-empty">Nenhum link processado hoje ainda. Assim que o bot detectar ofertas nos grupos monitorados, elas aparecem aqui.</p>
          ) : (
            <div className="pnl-funnel">
              {funnel.map((step) => {
                const pct = Math.round((step.value / funnelBase) * 100)
                return (
                  <div key={step.label} className="pnl-funnel-row">
                    <span>{step.label}</span>
                    <span className="pnl-funnel-bar"><span className="pnl-funnel-fill" style={{ width: `${pct}%` }} /></span>
                    <span className="pnl-funnel-pct">{step.value} · {pct}%</span>
                  </div>
                )
              })}
              {(blocked + dedup) > 0 && (
                <p className="pnl-card-note" style={{ marginTop: 4 }}>
                  {blocked + dedup} links não passaram — fora dos filtros ou repetidos.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Top grupos de destino */}
        <section className="pnl-card">
          <div className="pnl-card-title">Top grupos de destino</div>
          <div className="pnl-card-note">onde o bot mais postou hoje</div>
          {loadingSummary ? (
            <div className="pnl-bars">
              {[0, 1, 2].map((k) => <div key={k} className="pnl-skel" style={{ height: 28 }} />)}
            </div>
          ) : topDest.length === 0 ? (
            <p className="pnl-empty">Sem publicações hoje.</p>
          ) : (
            <div className="pnl-bars">
              {topDest.map((d) => (
                <div key={d.jid} className="pnl-bar-row">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <span className="pnl-bar-val">{num(d.sent)}</span>
                  <span className="pnl-bar-track"><span className="pnl-bar-fill" style={{ width: `${Math.round((num(d.sent) / maxDest) * 100)}%` }} /></span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Distribuição (rosca) + top origens */}
      <div className="pnl-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)' }}>
        <section className="pnl-card">
          <div className="pnl-card-title">Distribuição dos links</div>
          <div className="pnl-card-note">o que aconteceu com cada link · {periodWord}</div>
          {loadingSummary ? (
            <div className="pnl-skel" style={{ height: 160, marginTop: 12 }} />
          ) : donutTotal === 0 ? (
            <p className="pnl-empty">Nenhum link processado no período.</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
              <Donut segments={donutSegments} total={donutTotal} />
              <div className="pnl-legend">
                {donutSegments.map((s) => (
                  <div key={s.label} className="pnl-legend-row">
                    <span className="pnl-legend-dot" style={{ background: s.color }} />
                    {s.label}
                    <span className="pnl-legend-val">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="pnl-card">
          <div className="pnl-card-title">Top grupos de origem</div>
          <div className="pnl-card-note">de onde mais vieram links · {periodWord}</div>
          {loadingSummary ? (
            <div className="pnl-bars">
              {[0, 1, 2].map((k) => <div key={k} className="pnl-skel" style={{ height: 28 }} />)}
            </div>
          ) : topSrc.length === 0 ? (
            <p className="pnl-empty">Nenhum grupo de origem com atividade no período.</p>
          ) : (
            <div className="pnl-bars">
              {topSrc.map((d) => {
                const total = num(d.sent) + num(d.blocked)
                return (
                  <div key={d.jid} className="pnl-bar-row">
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    <span className="pnl-bar-val">{total}</span>
                    <span className="pnl-bar-track"><span className="pnl-bar-fill" style={{ width: `${Math.round((total / maxSrc) * 100)}%` }} /></span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Atividade — colunas dos últimos 7 dias */}
      <section className="pnl-card">
        <div className="pnl-card-title">Atividade · últimos 7 dias</div>
        <div className="pnl-card-note">entregues, bloqueados pela regra e falhas por dia</div>
        {series === null ? (
          <div className="pnl-skel" style={{ height: 180, marginTop: 12 }} />
        ) : series.every((b) => b.success + b.blocked + b.failed === 0) ? (
          <p className="pnl-empty">Sem atividade nos últimos 7 dias.</p>
        ) : (
          <>
            <StackedColumns buckets={series} />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
              {[
                { label: 'Entregues', color: 'var(--accent-strong)' },
                { label: 'Bloqueados', color: 'var(--accent-3)' },
                { label: 'Falhas', color: 'var(--danger)' },
              ].map((s) => (
                <span key={s.label} className="pnl-legend-row" style={{ flex: 'none' }}>
                  <span className="pnl-legend-dot" style={{ background: s.color }} />{s.label}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Últimos envios */}
      <section className="pnl-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="pnl-card-title">Últimos envios</div>
            <div className="pnl-card-note">o que o bot processou agora há pouco</div>
          </div>
          <Link href="/painel/envios" className="pnl-link">Ver tudo →</Link>
        </div>

        {loadingRecent ? (
          <div className="pnl-list" style={{ marginTop: 10 }}>
            {[0, 1, 2, 3].map((k) => <div key={k} className="pnl-skel" style={{ height: 44, margin: '6px 0' }} />)}
          </div>
        ) : recent.length === 0 ? (
          <p className="pnl-empty">Ainda não há envios registrados. Crie uma oferta ou conecte um grupo de origem para o bot começar a trabalhar.</p>
        ) : (
          <div className="pnl-list" style={{ marginTop: 6 }}>
            {recent.map((log) => {
              const t = log.sentAt ? new Date(log.sentAt) : null
              const time = t ? t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
              const dest = log.destGroupName && log.destGroup !== 'skipped' && log.destGroup !== 'conversion' ? log.destGroupName : null
              return (
                <div key={log.id} className="pnl-row">
                  <span className="pnl-row-time">{time}</span>
                  <span className="pnl-row-main">
                    <span className="pnl-row-title">{shortTitle(log.messageText)}</span>
                    <span className="pnl-row-meta">
                      {log.platform || 'loja'}{dest ? ` → ${dest}` : ''}
                    </span>
                  </span>
                  <StatusTag status={log.status} />
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function StackedColumns({ buckets }) {
  const W = 560
  const H = 180
  const padL = 8
  const padR = 8
  const padB = 24
  const padT = 10
  const n = buckets.length || 1
  const plotH = H - padB - padT
  const plotW = W - padL - padR
  const slot = plotW / n
  const barW = Math.min(30, slot * 0.6)
  const totals = buckets.map((b) => b.success + b.blocked + b.failed)
  const max = Math.max(...totals, 1)
  const grid = [0, 0.25, 0.5, 0.75, 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block', marginTop: 12 }} aria-hidden="true">
      {grid.map((g, i) => {
        const y = padT + plotH * (1 - g)
        return <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray={g === 0 ? '0' : '2 4'} />
      })}
      {buckets.map((b, i) => {
        const cx = padL + slot * i + slot / 2
        const segs = [
          { v: b.success, c: 'var(--accent-strong)' },
          { v: b.blocked, c: 'var(--accent-3)' },
          { v: b.failed, c: 'var(--danger)' },
        ]
        const heights = segs.map((s) => (s.v / max) * plotH)
        const offsets = heights.map((_, k) => heights.slice(0, k).reduce((a, c) => a + c, 0))
        return (
          <g key={b.key}>
            {segs.map((s, k) => (
              heights[k] > 0
                ? <rect key={k} x={cx - barW / 2} y={padT + plotH - offsets[k] - heights[k]} width={barW} height={heights[k]} fill={s.c} rx={k === segs.length - 1 ? 3 : 0} />
                : null
            ))}
            <text x={cx} y={H - 7} textAnchor="middle" fontSize="9.5" fill="var(--ink-faint)" fontFamily="Inter, sans-serif">{b.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Donut({ segments, total }) {
  const size = 160
  const r = 58
  const sw = 20
  const cx = size / 2
  const cy = size / 2
  const C = 2 * Math.PI * r
  const fracs = segments.map((s) => (total ? s.value / total : 0))
  const offsets = fracs.map((_, i) => fracs.slice(0, i).reduce((a, b) => a + b, 0))
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ flexShrink: 0 }} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={sw} />
      {segments.map((s, i) => {
        const dash = fracs[i] * C
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={sw}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-offsets[i] * C}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )
      })}
      <text x={cx} y={cy - 1} textAnchor="middle" fontSize="30" fontWeight="600" fill="var(--ink)" style={{ letterSpacing: '-0.02em' }}>{total}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fill="var(--ink-soft)">processados</text>
    </svg>
  )
}

function Kpi({ label, value, foot, loading }) {
  return (
    <div className="pnl-kpi">
      <div className="pnl-kpi-label">{label}</div>
      {loading
        ? <div className="pnl-skel" style={{ width: 60, height: 28, margin: '4px 0' }} />
        : <div className="pnl-kpi-num pnl-serif">{value}</div>}
      <div className="pnl-kpi-foot">{foot}</div>
    </div>
  )
}
