import { useState } from 'react';
import { Icon } from './Icon';

const s = {
  head: { textAlign: 'center', marginBottom: 56 },
  h2: { fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.05 },
  sub: { fontSize: 17, color: 'var(--ink-soft)', maxWidth: 520, margin: '16px auto 0', lineHeight: 1.55 },
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
  toggle: {
    display: 'inline-flex', padding: 4,
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 999, marginTop: 24,
  },
  toggleBtn: (active) => ({
    padding: '8px 18px', borderRadius: 999,
    border: 'none', cursor: 'pointer',
    fontSize: 13.5, fontWeight: 500,
    background: active ? 'var(--accent-strong)' : 'transparent',
    color: active ? 'white' : 'var(--ink-soft)',
    fontFamily: 'inherit',
  }),
};

const plans = [
  {
    name: 'Início', mo: 29, yr: 19,
    desc: 'Para quem está testando o jogo de afiliada.',
    cta: 'Começar grátis',
    features: ['Até 2 grupos do WhatsApp', 'Lojas: Shopee + Mercado Livre', 'Painel básico de comissões', 'Texto promocional padrão', 'Suporte por e-mail'],
  },
  {
    name: 'Pro', mo: 59, yr: 39,
    desc: 'Para quem já tem grupos rodando e quer escala.',
    cta: 'Assinar Pro', highlight: true,
    features: ['Grupos ilimitados', 'Todas as lojas suportadas', 'Painel completo + relatórios', 'Texto promocional editável (com IA)', 'Modo "achadinho do dia"', 'Regras por grupo', 'Suporte por WhatsApp'],
  },
  {
    name: 'Agência', mo: 149, yr: 99,
    desc: 'Para quem gerencia afiliadas ou várias contas.',
    cta: 'Falar com a gente',
    features: ['Tudo do Pro', 'Até 5 contas WhatsApp', 'Painel multi-conta', 'API para integração', 'Onboarding 1:1', 'Gerente de conta dedicado'],
  },
];

export function Pricing() {
  const [yr, setYr] = useState(false);

  return (
    <section id="planos">
      <div className="wrap">
        <div style={s.head}>
          <span className="pill"><span className="dot" />Planos</span>
          <h2 style={{ ...s.h2, marginTop: 16 }}>
            Preço <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>menor que uma comissão</span> por mês.
          </h2>
          <p style={s.sub}>Cancele a qualquer momento. Os primeiros 30 dias são por nossa conta para você testar com seus grupos reais.</p>
          <div style={s.toggle}>
            <button style={s.toggleBtn(!yr)} onClick={() => setYr(false)}>Mensal</button>
            <button style={s.toggleBtn(yr)} onClick={() => setYr(true)}>Anual · -34%</button>
          </div>
        </div>

        <div style={s.grid}>
          {plans.map(p => (
            <div key={p.name} style={s.card(p.highlight)}>
              {p.highlight && <div style={s.badge}>Mais escolhido</div>}
              <div style={s.planName}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8, color: p.highlight ? 'var(--surface)' : 'var(--ink)' }}>
                <span style={{ fontSize: 18 }}>R$</span>
                <span style={s.priceBig}>{yr ? p.yr : p.mo}</span>
                <span style={s.priceUnit}>/mês</span>
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: p.highlight ? 'rgba(255,255,255,0.7)' : 'var(--ink-soft)', marginBottom: 24, minHeight: 50 }}>
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
                href="#"
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
