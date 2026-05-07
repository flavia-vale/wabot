'use client';
import { Icon } from './Icon';

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

const plans = [
  {
    name: 'Teste grátis',
    price: 'R$0',
    desc: 'Experimente o fluxo principal antes de escolher um plano pago.',
    cta: 'Começar teste grátis',
    features: ['Conversão de links suportados', 'Monitoramento de grupos', 'Envio para grupos de destino', 'Histórico de logs', 'Com anúncios'],
  },
  {
    name: 'Basic',
    price: 'R$50',
    desc: 'Para operar com os mesmos recursos essenciais do Pro mantendo anúncios no uso.',
    cta: 'Assinar Basic',
    features: ['Conversão de links suportados', 'Monitoramento de grupos', 'Envio para grupos de destino', 'Histórico de logs', 'Com anúncios'],
  },
  {
    name: 'Pro',
    price: 'R$100',
    desc: 'Para operar com os mesmos recursos do Basic, sem anúncios na experiência.',
    cta: 'Assinar Pro',
    highlight: true,
    features: ['Conversão de links suportados', 'Monitoramento de grupos', 'Envio para grupos de destino', 'Histórico de logs', 'Sem anúncios'],
  },
];

export function Pricing() {
  return (
    <section id="planos">
      <div className="wrap">
        <div style={s.head}>
          <span className="pill"><span className="dot" />Planos</span>
          <h2 style={{ ...s.h2, marginTop: 16 }}>
            Escolha o plano para <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>começar e escalar</span> sua operação.
          </h2>
          <p style={s.sub}>Basic e Pro têm os mesmos recursos técnicos. A diferença visível entre eles é a presença ou ausência de anúncios.</p>
        </div>

        <div style={s.grid}>
          {plans.map(p => (
            <div key={p.name} style={s.card(p.highlight)}>
              {p.highlight && <div style={s.badge}>Sem anúncios</div>}
              <div style={s.planName}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8, color: p.highlight ? 'var(--surface)' : 'var(--ink)' }}>
                <span style={s.priceBig}>{p.price}</span>
                {p.name !== 'Teste grátis' && <span style={s.priceUnit}>/mês</span>}
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
              <a
                href="/login"
                style={{
                  display: 'block', textAlign: 'center', padding: '14px 22px', borderRadius: 999,
                  fontWeight: 600, fontSize: 15, textDecoration: 'none',
                  background: p.highlight ? 'var(--accent-2)' : 'var(--ink)',
                  color: p.highlight ? 'var(--ink)' : 'var(--surface)',
                  border: '1px solid transparent', cursor: 'pointer',
                }}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
