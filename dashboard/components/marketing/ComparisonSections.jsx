import Link from 'next/link'
import { Icon } from '@/components/landing/Icon'
import { buildRegisterHref } from '@/lib/marketing-attribution'

/* Peças visuais das páginas de comparativo (/alternativas/*).
 *
 * Por que este arquivo existe: as páginas eram uma pilha de ~12 cartões
 * idênticos (mesmo fundo, mesma borda, mesmo raio, todos com listinha de
 * bullets), na ordem errada — "Veja também" antes do próprio comparativo — e
 * com a seção de migração renderizada DUAS vezes. Tudo com o mesmo peso
 * visual = nada com peso nenhum: a leitura vira rolagem.
 *
 * Aqui a hierarquia é explícita: resposta rápida > tabela > decisão > perfis >
 * migração > FAQ > links. E cada bloco tem forma própria (chips, passos
 * numerados, colunas com ícone) em vez de mais uma lista de bullets.
 *
 * Todos os botões carregam `data-comparison-cta` porque o
 * ComparisonPageTracker escuta esse atributo — CTA sem ele é clique que
 * ninguém consegue medir depois.
 */

export const TRIAL_LABEL = 'Testar 7 dias grátis'
const TRIAL_REASSURANCE = 'Sem cartão de crédito · Configura em 4 minutos · Cancela quando quiser'

export function comparisonRegisterHref({ slug, content }) {
  return buildRegisterHref({
    source: 'comparativo',
    medium: 'organic',
    campaign: String(slug || '').replace(/^\//, '').replace(/\//g, '-') || 'comparativo',
    content,
  })
}

/** Cartão-base de seção. `tone` muda o fundo para quebrar a monotonia. */
export function SectionCard({ eyebrow, title, lead, tone = 'plain', children, id }) {
  const background = tone === 'accent'
    ? 'color-mix(in oklab, var(--accent) 12%, var(--surface))'
    : tone === 'soft'
    ? 'color-mix(in oklab, var(--accent-2) 20%, var(--surface))'
    : 'var(--surface)'

  return (
    <div id={id} className="comparison-card" style={{ background }}>
      {eyebrow && <span className="pill"><span className="dot" />{eyebrow}</span>}
      {title && <h2 className="comparison-card-title">{title}</h2>}
      {lead && <p className="comparison-card-lead">{lead}</p>}
      {children}
    </div>
  )
}

/**
 * Bloco de chamada para o teste grátis, repetido ao longo da página.
 *
 * A página tinha só dois pontos de clique (topo e rodapé) numa leitura de
 * vários minutos: quem decidia no meio da tabela não tinha para onde ir.
 */
export function TrialCta({ slug, content, label = TRIAL_LABEL, note = TRIAL_REASSURANCE, align = 'left', variant = 'block' }) {
  const href = comparisonRegisterHref({ slug, content })
  const inline = variant === 'inline'

  return (
    <div className={`comparison-cta ${inline ? 'comparison-cta-inline' : ''}`} style={{ textAlign: align === 'center' ? 'center' : 'left' }}>
      <div className="comparison-cta-actions" style={{ justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
        <Link className="btn btn-accent" href={href} data-comparison-cta={content}>
          {label} <Icon name="arrow" size={16} />
        </Link>
        <Link className="btn btn-ghost" href="/precos" data-comparison-cta={`${content}-precos`}>
          Ver preços
        </Link>
      </div>
      {note && <p className="comparison-cta-note">{note}</p>}
    </div>
  )
}

/** Barra fixa no celular — de onde vêm 62% das impressões do site. */
export function StickyTrialCta({ slug }) {
  return (
    <div className="comparison-sticky-cta">
      <div className="comparison-sticky-cta-text">
        <strong>7 dias grátis</strong>
        <span>Sem cartão</span>
      </div>
      <Link
        className="btn btn-accent"
        href={comparisonRegisterHref({ slug, content: 'sticky-mobile' })}
        data-comparison-cta="sticky-mobile"
      >
        Testar agora
      </Link>
    </div>
  )
}

/** Índice clicável: dá forma à página e mostra que ela tem fim. */
export function SectionNav({ items }) {
  return (
    <nav className="comparison-nav" aria-label="Seções deste comparativo">
      {items.map((item) => (
        <a key={item.href} href={item.href} className="comparison-nav-chip" data-comparison-cta="section-nav">
          {item.label}
        </a>
      ))}
    </nav>
  )
}

/**
 * Tabela do comparativo. No desktop é tabela; no celular cada linha vira um
 * cartão com rótulo próprio (`data-label`), porque tabela de 3 colunas em tela
 * de 375px é justamente o "confuso e poluído" que motivou esta rodada.
 */
export function ComparisonTable({ rows, headers }) {
  return (
    <div className="comparison-table-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            {headers.map((header) => <th key={header} scope="col">{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([criterion, alternative, reading]) => (
            <tr key={criterion}>
              <th scope="row" data-label={headers[0]}>{criterion}</th>
              <td data-label={headers[1]}>{alternative}</td>
              <td data-label={headers[2]}>{reading}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Lista com ícone à esquerda — substitui os `<ul>` de bullets repetidos. */
export function IconList({ items, tone = 'check' }) {
  return (
    <ul className="comparison-icon-list">
      {items.map((item) => (
        <li key={item}>
          <span className={`comparison-icon comparison-icon-${tone}`} aria-hidden>
            <Icon name={tone === 'check' ? 'check' : 'plus'} size={12} />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Diferenciais como chips: leitura de relance, não parágrafo em pé. */
export function DifferentialChips({ items }) {
  return (
    <ul className="comparison-chips">
      {items.map((item) => (
        <li key={item} className="comparison-chip">
          <span className="comparison-icon comparison-icon-check" aria-hidden><Icon name="check" size={12} /></span>
          {item}
        </li>
      ))}
    </ul>
  )
}

/** Passos numerados de migração. */
export function StepList({ steps }) {
  return (
    <ol className="comparison-steps">
      {steps.map((step, index) => (
        <li key={step}>
          <span className="comparison-step-number" aria-hidden>{index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Perfil de uma alternativa. Antes eram seis parágrafos seguidos, incluindo
 * "Fonte" e "Verificado em" com o mesmo peso do resto. Agora a informação de
 * decisão fica visível e a procedência vai para um `<details>` — continua
 * publicada (é o que sustenta o comparativo), só deixa de disputar atenção.
 */
export function CompetitorCard({ competitor }) {
  return (
    <article className="comparison-competitor">
      <header className="comparison-competitor-head">
        <h3>{competitor.name}</h3>
        <p>{competitor.positioning}</p>
      </header>

      {Array.isArray(competitor.pricingTiers) && competitor.pricingTiers.length > 0 && (
        <ul className="comparison-price-row">
          {competitor.pricingTiers.map((tier) => (
            <li key={tier.name} className="comparison-price-chip">
              <span className="comparison-price-name">{tier.name}</span>
              <strong>{tier.price}</strong>
            </li>
          ))}
        </ul>
      )}

      <div className="comparison-competitor-fit">
        <div>
          <span className="comparison-fit-label comparison-fit-label-yes">
            <span className="comparison-icon comparison-icon-check" aria-hidden><Icon name="check" size={12} /></span>
            Melhor para
          </span>
          <p>{competitor.bestFor}</p>
        </div>
        <div>
          <span className="comparison-fit-label comparison-fit-label-no">
            <span className="comparison-icon comparison-icon-no" aria-hidden><Icon name="plus" size={12} /></span>
            Não ideal para
          </span>
          <p>{competitor.notIdealFor}</p>
        </div>
      </div>

      <details className="comparison-competitor-source">
        <summary>Fonte, verificação e nota de migração</summary>
        <p><strong>Nota de migração:</strong> {competitor.migrationNotes}</p>
        <p><strong>Fonte:</strong> {competitor.source}</p>
        <p><strong>Verificado em:</strong> {competitor.verifiedAt}</p>
      </details>
    </article>
  )
}
