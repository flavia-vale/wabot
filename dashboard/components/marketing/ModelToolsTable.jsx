import Link from 'next/link'
import { BASIC_PRICE_LABEL, PRO_PRICE_LABEL, OUR_MODEL_COVERAGE, buildCompetitorModelRows } from '@/lib/automation-models'

// Tabela "Espelha Grupos + 8 ferramentas, por modelo". Nasceu no hub
// /automacao-whatsapp-afiliados (27/09/2026) e passou a sair também em
// /melhores-bots-para-afiliados-whatsapp (Frente 1, item 3 da análise SEO+GEO
// de 02/10/2026): a IA do Google cita quem tem página de lista com nomes.
// Linhas lidas da ficha em tempo de render — preço e data nunca digitados aqui.

const hubTable = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14.5, minWidth: 880 },
  th: { textAlign: 'left', padding: '12px 10px', borderBottom: '2px solid var(--line)', fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)' },
  td: { padding: '12px 10px', borderTop: '1px solid var(--line)', verticalAlign: 'top', lineHeight: 1.55, color: 'var(--ink)' },
}

export function ModelToolsTable({ rows = buildCompetitorModelRows(), ctaId = 'hub-tool-comparison' }) {
  return (
    <>
      <div style={{ overflowX: 'auto', marginTop: 20 }}>
        <table style={hubTable.table}>
          <thead>
            <tr>
              <th style={hubTable.th}>Ferramenta</th>
              <th style={hubTable.th}>Espelhador</th>
              <th style={hubTable.th}>Garimpo automático</th>
              <th style={hubTable.th}>Formatador (oferta do link)</th>
              <th style={hubTable.th}>Lojas</th>
              <th style={hubTable.th}>Preço de entrada (data da ficha)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={hubTable.td}><strong>{OUR_MODEL_COVERAGE.name}</strong></td>
              <td style={hubTable.td}>{OUR_MODEL_COVERAGE.espelhador}</td>
              <td style={hubTable.td}>{OUR_MODEL_COVERAGE.garimpo}</td>
              <td style={hubTable.td}>{OUR_MODEL_COVERAGE.formatador}</td>
              <td style={hubTable.td}>{OUR_MODEL_COVERAGE.stores}</td>
              <td style={hubTable.td}>{OUR_MODEL_COVERAGE.entryPrice}</td>
            </tr>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td style={hubTable.td}><Link href={row.href} data-seo-cta={ctaId} style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>{row.name}</Link></td>
                <td style={hubTable.td}>{row.espelhador}</td>
                <td style={hubTable.td}>{row.garimpo}</td>
                <td style={hubTable.td}>{row.formatador}</td>
                <td style={hubTable.td}>{row.stores}</td>
                <td style={hubTable.td}>{row.entryPrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
        &quot;—&quot; = a ficha da ferramenta não informa. Preço de entrada é o primeiro plano com preço publicado, no valor recorrente, conferido na data entre parênteses; o Shozap não tem preço citado aqui. O Espelha Grupos cobra {BASIC_PRICE_LABEL} no Basic e {PRO_PRICE_LABEL} no Pro, sem cobrar por grupo.
      </p>
    </>
  )
}
