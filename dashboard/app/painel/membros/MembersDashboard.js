'use client'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader } from '../PainelShell'
import { LockedPage } from '@/components/pro/ProGate'

const number = value => new Intl.NumberFormat('pt-BR').format(value)
const when = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : '—'

const PERIODS = [
  { key: 'd1', label: '24 h', delta: 'delta24h', text: 'nas últimas 24 h' },
  { key: 'd7', label: '7 dias', delta: 'delta7d', text: 'nos últimos 7 dias' },
  { key: 'd30', label: '30 dias', delta: 'delta30d', text: 'nos últimos 30 dias' },
]
const SORTS = [
  { key: 'name', label: 'Nome' },
  { key: 'growth', label: 'Maior crescimento' },
  { key: 'drop', label: 'Maior queda' },
  { key: 'size', label: 'Mais membros' },
]
const STORAGE_KEY = 'painel.membros.periodo'

function readStoredPeriod() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return PERIODS.some(p => p.key === stored) ? stored : 'd7'
  } catch { return 'd7' }
}

const signOf = diff => (diff > 0 ? '+' : '')
const pctText = pct => String(pct).replace('.', ',')

function Delta({ delta }) {
  if (!delta) return <span className="mb-meta">coletando histórico…</span>
  const tone = delta.diff > 0 ? 'is-up' : delta.diff < 0 ? 'is-down' : 'is-flat'
  return (
    <span className={`mb-delta ${tone}`}>
      {signOf(delta.diff)}{number(delta.diff)}
      {delta.pct != null && <small>({signOf(delta.diff)}{pctText(delta.pct)}%)</small>}
    </span>
  )
}

/* Gráfico pequeno (sem biblioteca): linha dos membros no período. */
function Sparkline({ points, tone }) {
  if (!points || points.length < 2) return null
  const W = 110
  const H = 34
  const sizes = points.map(p => p.size)
  const min = Math.min(...sizes)
  const max = Math.max(...sizes)
  const span = max - min || 1
  const coords = points.map((p, i) => `${((i / (points.length - 1)) * (W - 4) + 2).toFixed(1)},${(H - 3 - ((p.size - min) / span) * (H - 6)).toFixed(1)}`)
  const color = tone === 'is-up' ? 'var(--accent-strong)' : tone === 'is-down' ? 'var(--danger)' : 'var(--ink-faint)'
  return (
    <svg className="mb-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolução: de ${number(sizes[0])} para ${number(sizes[sizes.length - 1])} membros`}>
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function MembersPreview() {
  const rows = [['Ofertas Tech', 812, '+14'], ['Casa e Cozinha', 640, '-3'], ['Moda Feminina', 977, '+26']]
  return (
    <div className="mb-grid">
      {rows.map(([name, size, delta]) => (
        <div key={name} className="mb-card">
          <span className="mb-card-name">{name}</span>
          <span className="mb-card-num">{number(size)}</span>
          <span className="mb-delta">{delta} em 7 dias</span>
        </div>
      ))}
    </div>
  )
}

function MembersLive() {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [period, setPeriod] = useState(readStoredPeriod)
  const [sort, setSort] = useState('name')

  useEffect(() => {
    const controller = new AbortController()
    api.groupMembers({ signal: controller.signal })
      .then(data => setState({ loading: false, error: null, data }))
      .catch(err => { if (err?.name !== 'AbortError') setState({ loading: false, error: err?.message || 'Não foi possível carregar os membros.', data: null }) })
    return () => controller.abort()
  }, [])

  function choosePeriod(key) {
    setPeriod(key)
    try { window.localStorage.setItem(STORAGE_KEY, key) } catch { /* sem armazenamento: só não lembra a escolha */ }
  }

  const current = PERIODS.find(p => p.key === period) ?? PERIODS[1]
  const groups = state.data?.groups
  const sorted = useMemo(() => {
    const list = [...(groups ?? [])]
    const diffOf = g => g[current.delta]?.diff
    // Quem ainda não tem histórico vai para o fim em qualquer ordenação por variação.
    const byDiff = dir => (a, b) => {
      const da = diffOf(a); const db = diffOf(b)
      if (da == null && db == null) return a.name.localeCompare(b.name)
      if (da == null) return 1
      if (db == null) return -1
      return dir * (db - da) || a.name.localeCompare(b.name)
    }
    if (sort === 'growth') return list.sort(byDiff(1))
    if (sort === 'drop') return list.sort(byDiff(-1))
    if (sort === 'size') return list.sort((a, b) => (b.size ?? -1) - (a.size ?? -1) || a.name.localeCompare(b.name))
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [groups, sort, current.delta])

  if (state.loading) return <p className="pnl-hint">Carregando…</p>
  if (state.error) return <p className="pnl-hint" role="alert">{state.error}</p>

  const withHistory = sorted.filter(g => g[current.delta])
  const totalDiff = withHistory.reduce((sum, g) => sum + g[current.delta].diff, 0)
  const totalTone = totalDiff > 0 ? 'is-up' : totalDiff < 0 ? 'is-down' : 'is-flat'

  return (
    <div className="pnl-pro-page">
      <p className="pnl-hint" style={{ margin: 0 }}>
        🔔 Em breve este painel será exclusivo do plano <strong>Escala</strong>. Enquanto isso, está liberado para todos do PRO.
      </p>

      <section className="pnl-pro-card pnl-pro-stats" aria-label="Resumo">
        <div><div className="pnl-pro-stat-n is-green">{number(state.data.totalSize)}</div><div className="pnl-pro-stat-l">membros somados nos {sorted.length} grupos</div></div>
        <div>
          <div className={`pnl-pro-stat-n mb-delta ${totalTone}`}>{withHistory.length === 0 ? '—' : `${signOf(totalDiff)}${number(totalDiff)}`}</div>
          <div className="pnl-pro-stat-l">
            {withHistory.length === 0 ? 'ainda coletando histórico' : `${current.text}${withHistory.length < sorted.length ? ` (${withHistory.length} de ${sorted.length} grupos com histórico)` : ''}`}
          </div>
        </div>
      </section>

      <div className="mb-toolbar">
        <div className="pnl-seg" role="group" aria-label="Período da variação">
          {PERIODS.map(p => (
            <button key={p.key} type="button" className={p.key === period ? 'is-active' : ''} aria-pressed={p.key === period} onClick={() => choosePeriod(p.key)}>{p.label}</button>
          ))}
        </div>
        <label className="pnl-field-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="pnl-hint">Ordenar por</span>
          <select className="pnl-input" value={sort} onChange={e => setSort(e.target.value)}>
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {sorted.length === 0
        ? <p className="pnl-hint">Você ainda não tem grupos de destino. Adicione em Espelhamento; a contagem começa na próxima hora cheia.</p>
        : (
          <div className="mb-grid">
            {sorted.map(g => {
              const delta = g[current.delta]
              const tone = !delta ? 'is-flat' : delta.diff > 0 ? 'is-up' : delta.diff < 0 ? 'is-down' : 'is-flat'
              return (
                <article key={g.id} className="mb-card" aria-label={g.name}>
                  <span className="mb-card-name">{g.name}</span>
                  <div className="mb-card-row">
                    <span className="mb-card-num">{g.size == null ? '—' : number(g.size)}</span>
                    <Sparkline points={g.series?.[current.key]} tone={tone} />
                  </div>
                  <span><Delta delta={delta} /> <span className="mb-meta">{delta ? current.text : ''}</span></span>
                  <span className="mb-meta">{g.size == null ? 'Aguardando a primeira contagem (roda de hora em hora, com o robô conectado)' : g.stale ? `sem dado recente (última: ${when(g.sampledAt)})` : `atualizado em ${when(g.sampledAt)}`}</span>
                </article>
              )
            })}
          </div>
        )}
      <p className="pnl-hint">A contagem é atualizada 1 vez por hora e só funciona com o robô conectado. A variação é o saldo (quem entrou menos quem saiu). Guardamos apenas a quantidade de membros, nunca os números.</p>
    </div>
  )
}

export default function MembersDashboard() {
  usePainelHeader({ title: 'Membros', subtitle: 'Quantas pessoas há em cada grupo e como isso mudou' })
  const { isPro } = usePainel()
  if (!isPro) {
    return (
      <LockedPage
        feature="membros"
        featureLabel="o painel de membros dos grupos"
        steps={[
          { title: 'O robô conta os membros', desc: 'Uma vez por hora, em cada grupo de destino.' },
          { title: 'Você vê o crescimento', desc: 'Total atual e variação em 24 horas, 7 e 30 dias.' },
          { title: 'Decide com dados', desc: 'Veja quais grupos crescem, param ou perdem gente.' },
        ]}
      >
        <MembersPreview />
      </LockedPage>
    )
  }
  return <MembersLive />
}
