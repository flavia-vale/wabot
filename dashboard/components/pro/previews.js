'use client'

/* Prévias das telas do PRO para quem está no Basic (LockedPage). São EXEMPLOS
 * fixos — nunca dados de outra conta, nunca chamada à API.
 *
 * Fiéis ao que o produto de fato faz: ofertas automáticas buscam só na Shopee
 * (AGENTS.md — "Ofertas automáticas são 100% Shopee") e não oferecem ligar a
 * "comissão extra do vendedor", que saiu da tela em 2026-09-17. */

const FILAS = [
  { name: 'Achadinhos da manhã', dest: 'Achados da Sol', ritmo: '1 a cada 20 min · 8h–12h', pending: 12, on: true, itens: [['Sandália Verão', 'R$ 39,90'], ['Kit Maquiagem', 'R$ 54,90'], ['Garrafa Térmica 1L', 'R$ 42,00']] },
  { name: 'Tech da noite', dest: 'Sol · Tech & Casa', ritmo: '1 a cada 30 min · 19h–22h', pending: 6, on: true },
  { name: 'Relâmpago fim de semana', dest: 'Achados da Sol', ritmo: '1 a cada 15 min', pending: 0, on: false },
]

export function FilasPreview() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {FILAS.map(fila => (
        <section key={fila.name} className="pnl-pro-card" style={{ opacity: fila.on ? 1 : 0.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="pnl-pro-iconbox" aria-hidden="true">⏱</span>
              <div><strong>{fila.name}</strong><div className="pnl-pro-muted" style={{ margin: 0 }}>publica em {fila.dest} · {fila.ritmo}</div></div>
            </div>
            <span className="pnl-tag">{fila.pending} na fila</span>
          </div>
          {fila.itens && (
            <ol style={{ margin: '12px 0 0', paddingLeft: 22, display: 'grid', gap: 6, fontSize: 13.5 }}>
              {fila.itens.map(([name, price]) => <li key={name}><strong>{name}</strong> <span className="pnl-pro-muted">{price}</span></li>)}
            </ol>
          )}
        </section>
      ))}
    </div>
  )
}

const TEMAS = [
  { name: 'air fryer', dest: 'Sol · Tech & Casa', desc: 30, hoje: 18, on: true },
  { name: 'tênis feminino', dest: 'Achados da Sol', desc: 40, hoje: 21, on: true },
  { name: 'perfume importado', dest: 'Achados da Sol', desc: 25, hoje: 8, on: true },
  { name: 'fone bluetooth', dest: 'Sol · Tech & Casa', desc: 35, hoje: 0, on: false },
]

export function OfertasAutomaticasPreview() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="pnl-pro-card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span className="pnl-pro-iconbox" aria-hidden="true">✓</span>
        <div><strong>Busca automática ligada</strong><div className="pnl-pro-muted" style={{ margin: 0 }}>Procura na Shopee a cada 10 min · 47 publicadas hoje</div></div>
      </section>
      <section className="pnl-pro-card">
        <strong>Temas que o robô procura</strong>
        <div className="sales-table-wrap" style={{ marginTop: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: 8 }}>Tema</th><th style={{ textAlign: 'left', padding: 8 }}>Desconto mínimo</th><th style={{ textAlign: 'left', padding: 8 }}>Hoje</th></tr></thead>
            <tbody>
              {TEMAS.map(tema => (
                <tr key={tema.name} style={{ opacity: tema.on ? 1 : 0.55, borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: 8 }}><strong>{tema.name}</strong><div className="pnl-pro-muted" style={{ margin: 0 }}>publica em {tema.dest}</div></td>
                  <td style={{ padding: 8 }}><span className="pnl-tag">{tema.desc}% ou mais</span></td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{tema.hoje}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
