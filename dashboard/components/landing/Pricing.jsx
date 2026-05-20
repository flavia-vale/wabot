'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import { DEFAULT_LANDING_PLANS } from '@/lib/marketing-content';
import { buildRegisterHref } from '@/lib/marketing-attribution';

const s = {
  head: { textAlign: 'center', marginBottom: 56 },
  h2: { fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.05 },
  sub: { fontSize: 17, color: 'var(--ink-soft)', maxWidth: 560, margin: '16px auto 0', lineHeight: 1.55 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'stretch' },
  card: (highlight) => ({
    background: highlight ? 'var(--ink)' : 'var(--surface)',
    color: highlight ? 'var(--surface)' : 'var(--ink)',
    border: '1px solid ' + (highlight ? 'var(--ink)' : 'var(--line)'),
    borderRadius: 28, padding: 36,
    display: 'flex', flexDirection: 'column', position: 'relative',
    boxShadow: highlight ? 'var(--shadow)' : 'none',
  }),
  badge: {
    position: 'absolute', top: -12, left: 36,
    background: 'var(--accent-2)', color: 'var(--ink)',
    padding: '6px 14px', borderRadius: 999,
    fontSize: 12, fontWeight: 600,
    border: '1px solid var(--line)',
    whiteSpace: 'nowrap',
  },
  planName: { fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-strong)', marginBottom: 16 },
  priceBig: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 64, lineHeight: 1, letterSpacing: '-0.03em' },
  priceUnit: { fontSize: 14, opacity: 0.7 },
  list: { listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 },
};

const defaultPlans = DEFAULT_LANDING_PLANS;

function mergePlanContent(plans) {
  const byId = new Map((plans ?? []).map(plan => [plan.id, plan]));
  return defaultPlans.map(defaultPlan => {
    const dynamicPlan = byId.get(defaultPlan.id);
    return {
      ...defaultPlan,
      name: dynamicPlan?.title || defaultPlan.name,
      price: dynamicPlan?.price || defaultPlan.price,
      priceValue: defaultPlan.priceValue,
      period: dynamicPlan?.period || defaultPlan.period,
      desc: dynamicPlan?.description || defaultPlan.desc,
      features: Array.isArray(dynamicPlan?.features) && dynamicPlan.features.length ? dynamicPlan.features : defaultPlan.features,
      position: dynamicPlan?.position ?? defaultPlan.position,
    };
  });
}

export function Pricing() {
  const [dynamicPlans, setDynamicPlans] = useState(null);

  useEffect(() => {
    let active = true;
    fetch('/api/public/plans', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar planos');
        return res.json();
      })
      .then((data) => {
        if (active) setDynamicPlans(Array.isArray(data.plans) ? data.plans : []);
      })
      .catch(() => {
        if (active) setDynamicPlans([]);
      });
    return () => { active = false; };
  }, []);

  const plans = useMemo(() => mergePlanContent(dynamicPlans), [dynamicPlans]);

  return (
    <section id="planos">
      <div className="wrap">
        <div style={s.head}>
          <span className="pill"><span className="dot" />Planos</span>
          <h2 style={{ ...s.h2, marginTop: 16 }}>
            Escolha o plano para <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>começar e escalar</span> sua operação.
          </h2>
          <p style={s.sub}>Planos públicos e parseáveis por agentes: teste gratuito, Basic com anúncios e Pro sem anúncios. Valores podem ser atualizados pelo painel administrativo após validação em staging.</p>
        </div>

        <div style={s.grid} className="landing-pricing-grid">
          {plans.map(p => (
            <div key={p.id} style={s.card(p.highlight)} className="landing-pricing-card">
              {p.highlight && <div style={s.badge}>Sem anúncios</div>}
              <div style={s.planName}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8, color: p.highlight ? 'var(--surface)' : 'var(--ink)' }}>
                <span style={s.priceBig}>{p.price}</span>
                {String(p.price).startsWith('R$') && <span style={s.priceUnit}>/ {p.period}</span>}
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: p.highlight ? 'rgba(255,255,255,0.7)' : 'var(--ink-soft)', marginBottom: 24, minHeight: 68 }}>
                {p.desc}
              </p>
              <ul style={s.list}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, color: p.highlight ? 'rgba(255,255,255,0.85)' : 'var(--ink)' }}>
                    <span style={{ flexShrink: 0, marginTop: 2, color: p.highlight ? 'var(--accent-2)' : 'var(--accent-strong)' }}><Icon name="check" size={16} /></span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={buildRegisterHref({ source: 'landing', campaign: 'home-pricing', content: `plan-${p.id}` })}
                className="landing-pricing-cta"
                style={{
                  display: 'block', textAlign: 'center', padding: '14px 22px', borderRadius: 999,
                  fontWeight: 600, fontSize: 15, textDecoration: 'none',
                  background: p.highlight ? 'var(--accent-2)' : 'var(--ink)',
                  color: p.highlight ? 'var(--ink)' : 'var(--surface)',
                  border: '1px solid transparent', cursor: 'pointer',
                }}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
