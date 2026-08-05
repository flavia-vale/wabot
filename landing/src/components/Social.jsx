import { Icon } from './Icon';

const s = {
  head: { textAlign: 'center', marginBottom: 56 },
  h2: { fontSize: 'clamp(32px, 3.5vw, 48px)', lineHeight: 1.1 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 },
  card: {
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 24, padding: 28,
    display: 'flex', flexDirection: 'column', minHeight: 240,
  },
  stars: { display: 'flex', gap: 2, color: 'var(--accent-strong)', marginBottom: 14 },
  quote: { fontSize: 16, lineHeight: 1.55, color: 'var(--ink)', marginBottom: 24, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' },
  who: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' },
  ava: (gradient) => ({ width: 40, height: 40, borderRadius: '50%', background: gradient, flexShrink: 0 }),
  name: { fontSize: 14, fontWeight: 600, color: 'var(--ink)' },
  role: { fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 },
  numbers: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    background: 'color-mix(in oklab, var(--accent) 18%, var(--surface))',
    borderRadius: 24, padding: '32px 16px', marginTop: 32,
    border: '1px solid var(--line)',
  },
  numItem: { textAlign: 'center', borderRight: '1px solid var(--line)', padding: '8px 16px' },
  numBig: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 48, lineHeight: 1, color: 'var(--ink)' },
  numLabel: { fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 8 },
};

/* PROVA SOCIAL INVENTADA — REMOVIDA (auditoria de funil 2026-08-05, §1.1).
 * Estes depoimentos e números ("1.200+ afiliadas", "R$ 4,2M em comissões")
 * nunca tiveram lastro e prometiam resultado financeiro, contradizendo a
 * política de uso responsável do produto. Este diretório é o protótipo Vite
 * (não vai para o deploy), mas os dados ficam zerados aqui também para que os
 * números não voltem por copiar-e-colar. A versão viva do bloco está em
 * dashboard/components/landing/Social.jsx.
 * NÃO REINTRODUZIR sem fonte rastreável e autorização por escrito. */
const testimonials = [];

const stats = [];

export function Social() {
  return (
    <section>
      <div className="wrap">
        <div style={s.head}>
          <span className="pill"><span className="dot" />Veja funcionando</span>
          <h2 style={{ ...s.h2, marginTop: 16 }}>
            Não pedimos que você <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>acredite</span>. Veja.
          </h2>
        </div>
        <div style={s.grid}>
          {testimonials.map((t, i) => (
            <div key={i} style={s.card}>
              <div style={s.stars}>
                {[...Array(5)].map((_, j) => <Icon key={j} name="star" size={16} />)}
              </div>
              <p style={s.quote}>"{t.q}"</p>
              <div style={s.who}>
                <div style={s.ava(t.g)} />
                <div>
                  <div style={s.name}>{t.name}</div>
                  <div style={s.role}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={s.numbers}>
          {stats.map(([n, l], i, a) => (
            <div key={n} style={{ ...s.numItem, borderRight: i === a.length - 1 ? 'none' : s.numItem.borderRight }}>
              <div style={s.numBig}>{n}</div>
              <div style={s.numLabel}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
