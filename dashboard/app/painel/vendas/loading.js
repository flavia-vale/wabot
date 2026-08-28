export default function Loading() {
  return <section className="sales-page" aria-label="Carregando vendas" aria-busy="true"><div className="sales-skeleton sales-skeleton-filter" /><div className="sales-kpis">{[1,2,3,4].map(n => <div className="sales-skeleton sales-skeleton-card" key={n} />)}</div><div className="sales-skeleton sales-skeleton-table" aria-label="Carregando pedidos" /><div className="sales-skeleton sales-skeleton-table" aria-label="Carregando produtos" /></section>
}
