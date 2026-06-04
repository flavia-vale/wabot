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

  const now = useMemo(() => new Date(), [])
  const dateLabel = useMemo(
    () => now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
    [now],
  )
  const subtitle = `${greeting(now.getHours())}, ${firstName(user)} — ${dateLabel}`
  usePainelHeader({ title: 'Painel', subtitle })

  useEffect(() => {
    let active = true
    Promise.allSettled([api.logsSummary('today'), api.logs('all', 1, 6)]).then(([s, r]) => {
      if (!active) return
      if (s.status === 'fulfilled') setSummary(s.value)
      else setLoadError('Não foi possível carregar as métricas de hoje.')
      if (r.status === 'fulfilled') setRecent(Array.isArray(r.value?.logs) ? r.value.logs : [])
      else setRecent([])
    })
    return () => { active = false }
  }, [])

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
      {/* Hero */}
      <section className="pnl-hero">
        <div>
          <div className="pnl-hero-label">Mensagens postadas hoje</div>
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

      {/* Últimos envios */}
      <section className="pnl-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="pnl-card-title">Últimos envios</div>
            <div className="pnl-card-note">o que o bot processou agora há pouco</div>
          </div>
          <Link href="/dashboard/logs" className="pnl-link">Ver tudo →</Link>
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
