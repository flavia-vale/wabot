'use client'

/*
 * Peças extras para o mockup de "Landing Comparativo" (Claude Design,
 * 2026-08-27): comparador por critério com coluna própria por opção e grade
 * de diferenciais com cartão por item, em vez de chip. Vivem num arquivo
 * client à parte — e não em ComparisonSections.jsx — para não forçar as
 * outras seis páginas de /alternativas/* (que não usam nada interativo aqui)
 * a virar client component também.
 *
 * Ativados só na página que está sendo testada (`page.rows` em formato de
 * objeto liga o comparador; `page.richDifferentials` liga a grade) — as
 * outras páginas continuam com ComparisonTable/DifferentialChips como estão.
 */

import { useState } from 'react'
import { Icon } from '@/components/landing/Icon'

/**
 * Comparador com uma coluna por opção (Produto vs. concorrente) e um filtro
 * por critério: clicar num critério destaca a linha e troca a "leitura
 * honesta" abaixo da tabela pela daquele critério, em vez de espremer as
 * três informações (o que o produto faz, o que o concorrente faz, como ler)
 * na mesma célula.
 */
export function InteractiveComparisonTable({ rows, produtoNome, concorrenteNome }) {
  const [active, setActive] = useState('all')
  const activeRow = rows.find((row) => row.key === active)

  return (
    <div className="comparison-interactive">
      <div className="comparison-criteria-filter" role="tablist" aria-label="Filtrar comparativo por critério">
        <button
          type="button"
          className={`comparison-criteria-pill ${active === 'all' ? 'is-active' : ''}`}
          onClick={() => setActive('all')}
          aria-pressed={active === 'all'}
        >
          Todos
        </button>
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            className={`comparison-criteria-pill ${active === row.key ? 'is-active' : ''}`}
            onClick={() => setActive(row.key)}
            aria-pressed={active === row.key}
          >
            {row.label}
          </button>
        ))}
      </div>

      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th scope="col">Critério</th>
              <th scope="col">{produtoNome}</th>
              <th scope="col">{concorrenteNome}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={active === row.key ? 'is-focused' : ''}>
                <th scope="row" data-label="Critério">{row.label}</th>
                <td data-label={produtoNome}>{row.produto}</td>
                <td data-label={concorrenteNome}>{row.concorrente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeRow && (
        <p className="comparison-insight">
          <strong>Leitura honesta — {activeRow.label}:</strong> {activeRow.reading}
        </p>
      )}
    </div>
  )
}

/** Grade de diferenciais com um cartão por item, em vez de chip — pedido pontual do mockup para dar mais peso visual a esta seção nesta página. */
export function DifferentialGrid({ items }) {
  return (
    <ul className="comparison-differential-grid">
      {items.map((item) => (
        <li key={item} className="comparison-differential-card">
          <span className="comparison-icon comparison-icon-check" aria-hidden><Icon name="check" size={13} /></span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Selos de confiança logo abaixo do hero — nenhum número inventado, só o que já é verdade sobre o produto. */
export function TrustStrip() {
  const items = [
    { icon: 'shield', label: 'Dados protegidos (LGPD)' },
    { icon: 'check', label: 'Cancela quando quiser' },
    { icon: 'users', label: 'Revisão humana em cada envio' },
    { icon: 'bolt', label: 'Configura em poucos minutos' },
  ]
  return (
    <div className="wrap">
      <ul className="comparison-trust-strip">
        {items.map((item) => (
          <li key={item.label}>
            <Icon name={item.icon} size={15} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
