import Link from 'next/link'
import { getCompetitorBySlug } from '@/lib/competitors-data'

// A1 (28-29/09/2026): "quanto custa por grupo" ao lado do Afilira, só com a
// ficha datada de `competitors-data.js` (fonte única: o preço e a data saem
// dela, nunca ficam escritos aqui). Sem ficha verificada, o bloco não aparece.
// Fatos do Espelha Grupos: os que o site já publica (grupos sem limite,
// R$ 39 e R$ 69 por 30 dias). Onde o Afilira é melhor, a tabela diz.

function formatDay(iso) {
  const [y, m, d] = String(iso).split('-')
  return y && m && d ? `${d}/${m}/${y}` : String(iso)
}

export function PrecoPorGrupoAfilira({ plans = [] }) {
  const afilira = getCompetitorBySlug('afilira')
  if (!afilira?.verifiedAt || !afilira?.source) return null

  const price = (id) => plans.find((p) => p.id === id)?.price
  const tier = (name) => afilira.pricingTiers?.find((t) => t.name === name)?.price
  const basic = price('basic')
  const pro = price('pro')
  const starter = tier('Starter')
  const professional = tier('Professional')
  if (!basic || !pro || !starter || !professional) return null

  const rows = [
    { plano: `Espelha Grupos Basic · ${basic}/30 dias`, grupos: 'Sem limite de grupos de origem e destino', extra: 'Espelhamento e 6 lojas' },
    { plano: `Espelha Grupos Pro · ${pro}/30 dias`, grupos: 'Sem limite de grupos; canais e garimpo automático da Shopee', extra: 'Tudo do Basic' },
    { plano: `Afilira Starter · ${starter}`, grupos: '1 grupo de origem e 1 de destino', extra: 'Busca ofertas sozinho; 4 lojas' },
    { plano: `Afilira Professional · ${professional}`, grupos: 'Busca em até 50 grupos; envio para quantos precisar', extra: 'Espelhamento entre grupos, Telegram, Awin, Terabyte e SHEIN' },
  ]

  return (
    <section style={{ paddingTop: 64 }} aria-labelledby="preco-por-grupo">
      <div className="wrap" style={{ maxWidth: 960 }}>
        <h2 id="preco-por-grupo" style={{ fontSize: 'clamp(26px, 3vw, 38px)', lineHeight: 1.1, marginBottom: 12 }}>
          Quanto custa por grupo: Espelha Grupos e Afilira
        </h2>
        <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 20 }}>
          O preço mais baixo do mercado não diz quantos grupos ele cobre. Esta tabela compara o que cada plano entrega em grupos.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid var(--bg-soft)' }}>Plano</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid var(--bg-soft)' }}>Grupos</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid var(--bg-soft)' }}>Também inclui</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.plano}>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--bg-soft)', fontWeight: 600 }}>{row.plano}</td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--bg-soft)' }}>{row.grupos}</td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--bg-soft)' }}>{row.extra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6, marginTop: 14 }}>
          Onde o Afilira é melhor: ele busca as ofertas sozinho, em grupos e nas lojas, e publica também no Telegram. Dados do Afilira conferidos na página de planos dele em {formatDay(afilira.verifiedAt)}; preços de terceiros mudam, confira na página deles.{' '}
          <Link href="/alternativas/afilira" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Comparativo completo</Link>
        </p>
      </div>
    </section>
  )
}
