'use client'
import { useEffect, useReducer, useRef } from 'react'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'
import { createSalesState, errorGuidance, salesReducer, validateCustomPeriod } from './salesLifecycle'

const TZ = 'America/Sao_Paulo'
const STATUS = { pending: 'Aguardando confirmação', unpaid: 'Ainda não pago', confirmed: 'Confirmada', cancelled: 'Cancelada', refunded: 'Devolvida', unclassified: 'Não classificada' }
const money = value => value == null ? 'Não disponível' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const date = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ }).format(new Date(value)) : '—'
function todayParts() { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); return Object.fromEntries(parts.map(p => [p.type,p.value])) }
function isoDaysAgo(days) { const p = todayParts(); const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - days)); return d.toISOString().slice(0,10) }
const presets = { today: () => ({ from: isoDaysAgo(0), to: isoDaysAgo(0) }), seven: () => ({ from: isoDaysAgo(6), to: isoDaysAgo(0) }), thirty: () => ({ from: isoDaysAgo(29), to: isoDaysAgo(0) }) }

function Pager({ data, onPage }) { if (!data || data.total <= data.limit) return null; return <nav className="sales-pager" aria-label="Paginação"><button disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Anterior</button><span>Página {data.page}</span><button disabled={!data.hasNextPage} onClick={() => onPage(data.page + 1)}>Próxima</button></nav> }
function Badge({ value }) { return <span className={`sales-status is-${value}`}>{STATUS[value] || STATUS.unclassified}</span> }

export default function SalesDashboard() {
  usePainelHeader({ title: 'Vendas', subtitle: 'Resultados da Shopee gerados pelos links do robô' })
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
    <header className="sales-heading"><div><h2>Vendas atribuídas ao robô</h2><p>Período de {period.from.split('-').reverse().join('/')} a {period.to.split('-').reverse().join('/')} · horário de São Paulo</p></div>{snapshot && <small>Atualizado em {date(snapshot.sourceUpdatedAt)}</small>}</header>
    <div className="sales-scope-banner" role="status">Por enquanto, esta tela mostra vendas apenas da <strong>Shopee</strong>. Amazon, Mercado Livre e outras lojas chegam em breve.</div>
    <form className="sales-filters" onSubmit={applyCustom}><div className="sales-presets"><button type="button" aria-pressed={activePreset === 'today'} onClick={() => choose('today')}>Hoje</button><button type="button" aria-pressed={activePreset === 'seven'} onClick={() => choose('seven')}>7 dias</button><button type="button" aria-pressed={activePreset === 'thirty'} onClick={() => choose('thirty')}>30 dias</button></div><label>De<input type="date" value={draft.from} onChange={e => dispatch({ type: 'draft', field: 'from', value: e.target.value })} /></label><label>Até<input type="date" value={draft.to} onChange={e => dispatch({ type: 'draft', field: 'to', value: e.target.value })} /></label><button type="submit" disabled={loading}>Aplicar</button></form>
    {loading && !snapshot && <div className="sales-info" role="status">Carregando vendas da Shopee…</div>}
    {loading && snapshot && <div className="sales-info" role="status">Atualizando vendas da Shopee… Os dados anteriores continuam visíveis.</div>}
    {error && <div className={`sales-alert ${snapshot ? 'is-stale' : 'is-error'}`} role="alert"><strong>{snapshot ? 'Dados anteriores exibidos.' : 'Não foi possível carregar.'}</strong> {guidance} <button onClick={() => dispatch({ type: 'retry' })}>Tentar novamente</button></div>}
    {snapshot && <><div className="sales-kpis"><article><span>Compras pelo robô</span><strong>{snapshot.summary.attributedPurchases}</strong></article><article><span>Valor vendido</span><strong>{money(snapshot.summary.salesAmount)}</strong><small>BRL</small></article><article><span>Comissão estimada</span><strong>{money(snapshot.summary.estimatedCommission)}</strong><small>BRL</small></article><article><span>Comissão confirmada</span><strong>{money(snapshot.summary.confirmedCommission)}</strong><small>BRL</small></article></div>
      {snapshot.summary.attributedPurchases === 0 && <div className="sales-info">Nenhuma compra atribuída ao robô neste período. Tente ampliar as datas.</div>}
      <section className="sales-card"><h3>Situação das compras</h3><div className="sales-status-list">{Object.entries(snapshot.summary.statusCounts).map(([key,value]) => <div key={key}><Badge value={key} /><strong>{value}</strong></div>)}</div></section>
      <section className="sales-card"><h3>Pedidos</h3><p>Comissões aparecem por pedido somente quando a compra possui um único pedido; assim o total da compra nunca é repetido.</p><div className="sales-table-wrap"><table><thead><tr><th>Compra</th><th>Situação</th><th>Valor (BRL)</th><th>Comissão estimada (BRL)</th><th>Comissão confirmada (BRL)</th><th>Itens</th><th>clique que resultou nesta compra</th></tr></thead><tbody>{snapshot.orders.rows.map(row => <tr key={row.id}><td>{date(row.purchasedAt)}</td><td><Badge value={row.status} /></td><td>{money(row.amount)}</td><td>{money(row.estimatedCommission)}</td><td>{money(row.confirmedCommission)}</td><td>{row.itemCount}</td><td>{date(row.convertedClickAt)}</td></tr>)}</tbody></table></div><Pager data={snapshot.orders} onPage={value => dispatch({ type: 'page', name: 'orderPage', value })} /></section>
      <section className="sales-card"><h3>Produtos</h3><div className="sales-table-wrap"><table><thead><tr><th>Produto</th><th>Loja</th><th>Quantidade</th><th>Valor (BRL)</th><th>Comissão estimada (BRL)</th><th>Situação</th></tr></thead><tbody>{snapshot.products.rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.shopName || '—'}</td><td>{row.quantity}</td><td>{money(row.amount)}</td><td>{money(row.estimatedCommission)}</td><td><Badge value={row.status} /></td></tr>)}</tbody></table></div><Pager data={snapshot.products} onPage={value => dispatch({ type: 'page', name: 'productPage', value })} /></section>
      <p className="sales-disclosure">Os horários de clique exibidos existem apenas para compras retornadas pela Shopee. Eles não representam o total de cliques nem uma taxa de conversão.</p></>}
  </section>
}
