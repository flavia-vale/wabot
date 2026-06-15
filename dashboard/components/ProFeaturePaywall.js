'use client'

import Link from 'next/link'

/* Paywall in-app padrão para features Pro: mostra a feature com badge,
 * benefícios e CTA de upgrade em vez de esconder a página (decisão de
 * produto 2026-05-18 #4). O bloqueio de verdade é do backend
 * (403 FEATURE_REQUIRES_PRO) — isto é a camada de venda. */
export function ProFeaturePaywall({ title, bullets = [], children }) {
  return (
    <section className="pnl-card" aria-label={`${title} — disponível no plano Pro`}>
      <span className="pnl-tag">🔒 Disponível no Pro</span>
      <div className="pnl-card-title" style={{ marginTop: 10 }}>{title}</div>
      <ul style={{ margin: '12px 0 0', paddingLeft: 20, display: 'grid', gap: 6 }}>
        {bullets.map((bullet) => <li key={bullet} className="pnl-hint" style={{ listStyle: 'disc' }}>{bullet}</li>)}
      </ul>
      <p className="pnl-hint" style={{ marginTop: 14 }}>
        Incluído no Pro por R$69/30 dias — menos de R$2,30 por dia.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Link className="pnl-btn is-primary" href="/painel/plano">Liberar com o Pro</Link>
        <Link className="pnl-btn" href="/painel">Continuar sem</Link>
      </div>
      {children}
    </section>
  )
}
