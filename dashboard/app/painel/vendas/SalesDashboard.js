'use client'
import { useEffect, useReducer, useRef } from 'react'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader } from '../PainelShell'
import { LockedPage } from '@/components/pro/ProGate'
import { createSalesState, errorGuidance, salesReducer, validateCustomPeriod } from './salesLifecycle'

const TZ = 'America/Sao_Paulo'
const STATUS = { pending: 'Aguardando confirmação', unpaid: 'Ainda não pago', confirmed: 'Confirmada', cancelled: 'Cancelada', refunded: 'Devolvida', unclassified: 'Não classificada' }
const money = value => value == null ? 'Não disponível' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const shortMoney = value => value == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
const date = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ }).format(new Date(value)) : '—'
function todayParts() { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); return Object.fromEntries(parts.map(p => [p.type,p.value])) }
function isoDaysAgo(days) { const p = todayParts(); const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - days)); return d.toISOString().slice(0,10) }
const presets = { today: () => ({ from: isoDaysAgo(0), to: isoDaysAgo(0) }), seven: () => ({ from: isoDaysAgo(6), to: isoDaysAgo(0) }), thirty: () => ({ from: isoDaysAgo(29), to: isoDaysAgo(0) }) }
const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
const dayLabel = iso => { const [y, m, d] = iso.split('-').map(Number); return WEEKDAY.format(new Date(Date.UTC(y, m - 1, d))).replace('.', '') }

function Pager({ data, onPage }) { if (!data || data.total <= data.limit) return null; return <nav className="sales-pager" aria-label="Paginação"><button disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Anterior</button><span>Página {data.page}</span><button disabled={!data.hasNextPage} onClick={() => onPage(data.page + 1)}>Próxima</button></nav> }
function Badge({ value }) { return <span className={`sales-status is-${value}`}>{STATUS[value] || STATUS.unclassified}</span> }

/* Os quatro números do topo. A Shopee não informa o total de CLIQUES — só o
 * horário do clique das compras que aconteceram —, então a tela não mostra
 * cliques nem taxa de conversão (seria número inventado). */
function Stats({ summary }) {
  return (
    <section className="pnl-pro-card pnl-pro-stats" aria-label="Resumo do período">
      <div><div className="pnl-pro-stat-n is-green">{money(summary.estimatedCommission)}</div><div className="pnl-pro-stat-l">comissão estimada</div></div>
      <div><div className="pnl-pro-stat-n">{summary.attributedPurchases}</div><div className="pnl-pro-stat-l">vendas pelo robô</div></div>
      <div><div className="pnl-pro-stat-n">{money(summary.salesAmount)}</div><div className="pnl-pro-stat-l">valor vendido</div></div>
      <div><div className="pnl-pro-stat-n">{money(summary.confirmedCommission)}</div><div className="pnl-pro-stat-l">comissão confirmada</div></div>
    </section>
  )
}

function DailyChart({ daily, summary }) {
  const rows = Array.isArray(daily) ? daily : []
  const max = Math.max(0, ...rows.map(r => r.estimatedCommission ?? 0))
  return (
    <section className="pnl-pro-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Comissão por dia</h3>
        <span className="pnl-pro-muted" style={{ margin: 0 }}>{money(summary.estimatedCommission)} estimada · {money(summary.confirmedCommission)} confirmada</span>
      </div>
      {rows.length === 0
        ? <p className="pnl-pro-muted">Nenhuma venda no período para desenhar.</p>
        : (
          <div className="pnl-pro-bars" role="img" aria-label={`Comissão por dia: ${rows.map(r => `${r.date} ${shortMoney(r.estimatedCommission)}`).join(', ')}`}>
            {rows.map(r => (
              <div key={r.date} className="pnl-pro-bar-col">
                <span className="pnl-pro-bar-v">{shortMoney(r.estimatedCommission)}</span>
                <div className={`pnl-pro-bar${max > 0 && r.estimatedCommission === max ? ' is-max' : ''}`} style={{ height: `${max > 0 ? Math.max(2, ((r.estimatedCommission ?? 0) / max) * 100) : 2}%` }} />
                <span className="pnl-pro-bar-d">{rows.length <= 10 ? dayLabel(r.date) : r.date.slice(8)}</span>
              </div>
            ))}
          </div>
        )}
    </section>
  )
}

function TopProducts({ rows }) {
  return (
    <section className="sales-card">
      <h3>Produtos que mais venderam</h3>
      {!rows?.length
        ? <p className="pnl-pro-muted">Nenhum produto vendido no período.</p>
        : <div className="sales-table-wrap"><table><thead><tr><th>Produto</th><th>Loja</th><th>Vendas</th><th style={{ textAlign: 'right' }}>Comissão</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td style={{ fontWeight: 600 }}>{row.name}</td><td>{row.shopName || '—'}</td><td>{row.quantity}</td><td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-strong)' }}>{money(row.estimatedCommission)}</td></tr>)}</tbody></table></div>}
    </section>
  )
}

/* Prévia para quem não tem o PRO. Números de EXEMPLO — nunca dado de conta. */
const EXAMPLE = {
  summary: { estimatedCommission: 684, attributedPurchases: 58, salesAmount: 4210, confirmedCommission: 272 },
  daily: [['2026-09-17', 62], ['2026-09-18', 84], ['2026-09-19', 121], ['2026-09-20', 148], ['2026-09-21', 97], ['2026-09-22', 73], ['2026-09-23', 99]].map(([date, estimatedCommission]) => ({ date, purchases: 1, estimatedCommission })),
  topProducts: [['Air Fryer 4L', 9, 111.6], ['Sandália Verão', 14, 67.06], ['Vestido Midi', 7, 48.93], ['Fone Bluetooth', 6, 29.4]].map(([name, quantity, estimatedCommission], i) => ({ id: String(i), name, shopName: 'Loja exemplo', quantity, estimatedCommission })),
}

function SalesPreview() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Stats summary={EXAMPLE.summary} />
      <DailyChart daily={EXAMPLE.daily} summary={EXAMPLE.summary} />
      <TopProducts rows={EXAMPLE.topProducts} />
    </div>
  )
}

function SalesLive() {
  const [state, dispatch] = useReducer(salesReducer, null, () => createSalesState(presets.seven()))
  const { period, draft, pages, snapshot, loading, error, retry } = state; const seq = useRef(0)
  useEffect(() => {
    const request = ++seq.current; const controller = new AbortController()
    // A mudança de filtros inicia deliberadamente um novo estado de carregamento.
    dispatch({ type: 'request-start', request })
    api.shopeeSales({ ...period, ...pages }, { signal: controller.signal })
      .then(data => dispatch({ type: 'request-success', request, snapshot: data }))
      .catch(e => dispatch({ type: 'request-error', request, aborted: e.name === 'AbortError', error: { code: e.code, message: e.message, retryable: e.retryable } }))
      .finally(() => dispatch({ type: 'request-finish', request }))
    return () => controller.abort()
  }, [period, pages, retry])
  const choose = key => dispatch({ type: 'period', period: presets[key]() })
  const applyCustom = e => { e.preventDefault(); if (!validateCustomPeriod(draft, isoDaysAgo(0))) return dispatch({ type: 'validation-error', message: 'Escolha datas existentes, sem dias futuros, em um período de até 30 dias.' }); dispatch({ type: 'period', period: draft }) }
  const guidance = errorGuidance(error?.code)
  const activePreset = Object.entries(presets).find(([, make]) => { const value = make(); return value.from === period.from && value.to === period.to })?.[0]
  return <section className="sales-page">
    <header className="pnl-pro-head"><div><h2>Vendas Shopee</h2><p>Suas vendas e comissões da Shopee, direto no painel. Período de {period.from.split('-').reverse().join('/')} a {period.to.split('-').reverse().join('/')} · horário de São Paulo</p></div>{snapshot && <small className="pnl-pro-muted">Atualizado em {date(snapshot.sourceUpdatedAt)}</small>}</header>
    <div className="sales-scope-banner" role="status">Por enquanto, esta tela mostra vendas apenas da <strong>Shopee</strong>, a partir de 27/08/2026. Amazon, Mercado Livre e outras lojas chegam em breve.</div>
    <form className="sales-filters" onSubmit={applyCustom}><div className="sales-presets"><button type="button" aria-pressed={activePreset === 'today'} onClick={() => choose('today')}>Hoje</button><button type="button" aria-pressed={activePreset === 'seven'} onClick={() => choose('seven')}>7 dias</button><button type="button" aria-pressed={activePreset === 'thirty'} onClick={() => choose('thirty')}>30 dias</button></div><label>De<input type="date" value={draft.from} onChange={e => dispatch({ type: 'draft', field: 'from', value: e.target.value })} /></label><label>Até<input type="date" value={draft.to} onChange={e => dispatch({ type: 'draft', field: 'to', value: e.target.value })} /></label><button type="submit" disabled={loading}>Aplicar</button></form>
    {loading && !snapshot && <div className="sales-info" role="status">Carregando vendas da Shopee…</div>}
    {loading && snapshot && <div className="sales-info" role="status">Atualizando vendas da Shopee… Os dados anteriores continuam visíveis.</div>}
    {error && <div className={`sales-alert ${snapshot ? 'is-stale' : 'is-error'}`} role="alert"><strong>{snapshot ? 'Dados anteriores exibidos.' : 'Não foi possível carregar.'}</strong> {guidance} <button onClick={() => dispatch({ type: 'retry' })}>Tentar novamente</button></div>}
    {snapshot && <>
      <Stats summary={snapshot.summary} />
      {snapshot.summary.attributedPurchases === 0 && <div className="sales-info">Nenhuma compra atribuída ao robô neste período. Tente ampliar as datas.</div>}
      <DailyChart daily={snapshot.daily} summary={snapshot.summary} />
      <TopProducts rows={snapshot.topProducts} />
      <section className="sales-card"><h3>Situação das compras</h3><div className="sales-status-list">{Object.entries(snapshot.summary.statusCounts).map(([key,value]) => <div key={key}><Badge value={key} /><strong>{value}</strong></div>)}</div></section>
      <section className="sales-card"><h3>Pedidos</h3><p>Comissões aparecem por pedido somente quando a compra possui um único pedido; assim o total da compra nunca é repetido.</p><div className="sales-table-wrap"><table><thead><tr><th>Compra</th><th>Situação</th><th>Valor (BRL)</th><th>Comissão estimada (BRL)</th><th>Comissão confirmada (BRL)</th><th>Itens</th><th>clique que resultou nesta compra</th></tr></thead><tbody>{snapshot.orders.rows.map(row => <tr key={row.id}><td>{date(row.purchasedAt)}</td><td><Badge value={row.status} /></td><td>{money(row.amount)}</td><td>{money(row.estimatedCommission)}</td><td>{money(row.confirmedCommission)}</td><td>{row.itemCount}</td><td>{date(row.convertedClickAt)}</td></tr>)}</tbody></table></div><Pager data={snapshot.orders} onPage={value => dispatch({ type: 'page', name: 'orderPage', value })} /></section>
      <section className="sales-card"><h3>Produtos</h3><div className="sales-table-wrap"><table><thead><tr><th>Produto</th><th>Loja</th><th>Quantidade</th><th>Valor (BRL)</th><th>Comissão estimada (BRL)</th><th>Situação</th></tr></thead><tbody>{snapshot.products.rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.shopName || '—'}</td><td>{row.quantity}</td><td>{money(row.amount)}</td><td>{money(row.estimatedCommission)}</td><td><Badge value={row.status} /></td></tr>)}</tbody></table></div><Pager data={snapshot.products} onPage={value => dispatch({ type: 'page', name: 'productPage', value })} /></section>
      <p className="sales-disclosure">Os horários de clique exibidos existem apenas para compras retornadas pela Shopee. Eles não representam o total de cliques nem uma taxa de conversão.</p></>}
  </section>
}

export default function SalesDashboard() {
  usePainelHeader({ title: 'Vendas Shopee', subtitle: 'Resultados da Shopee gerados pelos links do robô' })
  const { isPro } = usePainel()
  // Divisão Basic/PRO (2026-09-23): no Basic a tela explica o recurso e mostra
  // uma prévia de exemplo — e NÃO consulta a Shopee (a API devolveria 403).
  if (!isPro) {
    return (
      <LockedPage
        feature="vendas"
        featureLabel="o painel de vendas da Shopee"
        steps={[
          { title: 'Cadastre seu ID da Shopee', desc: 'Em IDs de afiliado, uma vez só.' },
          { title: 'O robô busca suas vendas', desc: 'Direto da Shopee, pelos links que ele publicou.' },
          { title: 'Acompanhe aqui', desc: 'Vendas, valor vendido e comissão por dia e por produto.' },
        ]}
      >
        <SalesPreview />
      </LockedPage>
    )
  }
  return <SalesLive />
}
