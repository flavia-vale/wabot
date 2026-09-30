'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader } from '../PainelShell'
import { LockedPage } from '@/components/pro/ProGate'

const number = value => new Intl.NumberFormat('pt-BR').format(value)
const when = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : '—'

function Delta({ delta }) {
  if (!delta) return <span className="pnl-hint">coletando…</span>
  const color = delta.diff > 0 ? 'var(--accent-strong)' : delta.diff < 0 ? 'var(--danger)' : 'var(--ink-soft)'
  const sign = delta.diff > 0 ? '+' : ''
  return (
    <span style={{ color, fontWeight: 700 }}>
      {sign}{number(delta.diff)}{delta.pct != null && <small style={{ marginLeft: 6, fontWeight: 500 }}>({sign}{String(delta.pct).replace('.', ',')}%)</small>}
    </span>
  )
}

function MembersPreview() {
  const rows = [['Ofertas Tech', 812, 14, 63, 190], ['Casa e Cozinha', 640, -3, 21, 88], ['Moda Feminina', 977, 26, 110, 301]]
  return (
    <div className="pnl-table-wrap">
      <table className="pnl-table">
        <thead><tr><th>Grupo</th><th>Membros</th><th>24 h</th><th>7 dias</th><th>30 dias</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r[0]}><td>{r[0]}</td><td>{number(r[1])}</td><td>{r[2] > 0 ? '+' : ''}{r[2]}</td><td>+{r[3]}</td><td>+{r[4]}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function MembersLive() {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  useEffect(() => {
    const controller = new AbortController()
    api.groupMembers({ signal: controller.signal })
      .then(data => setState({ loading: false, error: null, data }))
      .catch(err => { if (err?.name !== 'AbortError') setState({ loading: false, error: err?.message || 'Não foi possível carregar os membros.', data: null }) })
    return () => controller.abort()
  }, [])

  if (state.loading) return <p className="pnl-hint">Carregando…</p>
  if (state.error) return <p className="pnl-hint" role="alert">{state.error}</p>
  const { groups, totalSize } = state.data
  return (
    <div className="pnl-pro-page">
      <p className="pnl-hint" style={{ margin: 0 }}>
        🔔 Em breve este painel será exclusivo do plano <strong>Escala</strong>. Enquanto isso, está liberado para todos do PRO.
      </p>
      <section className="pnl-pro-card pnl-pro-stats" aria-label="Resumo">
        <div><div className="pnl-pro-stat-n is-green">{number(totalSize)}</div><div className="pnl-pro-stat-l">membros somados nos grupos de destino</div></div>
        <div><div className="pnl-pro-stat-n">{groups.length}</div><div className="pnl-pro-stat-l">grupos acompanhados</div></div>
      </section>
      {groups.length === 0
        ? <p className="pnl-hint">Você ainda não tem grupos de destino. Adicione em Espelhamento; a contagem começa na próxima hora cheia.</p>
        : (
          <div className="pnl-table-wrap">
            <table className="pnl-table">
              <thead><tr><th>Grupo</th><th>Membros</th><th>24 h</th><th>7 dias</th><th>30 dias</th><th>Atualizado</th></tr></thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td>{g.size == null ? <span className="pnl-hint">coletando…</span> : number(g.size)}</td>
                    <td><Delta delta={g.delta24h} /></td>
                    <td><Delta delta={g.delta7d} /></td>
                    <td><Delta delta={g.delta30d} /></td>
                    <td>{g.stale ? <span className="pnl-hint">sem dado recente{g.sampledAt ? ` (${when(g.sampledAt)})` : ''}</span> : when(g.sampledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <p className="pnl-hint">A contagem é atualizada 1 vez por hora e só funciona com o robô conectado. Guardamos apenas a quantidade de membros, nunca os números.</p>
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
