import { RESPONSIBLE_OPERATION_POINTS } from '@/lib/marketing-content';
import { Icon } from './Icon';

const s = {
  head: { textAlign: 'center', marginBottom: 56 },
  h2: { fontSize: 'clamp(32px, 3.5vw, 48px)', lineHeight: 1.1 },
  sub: { fontSize: 16, color: 'var(--ink-soft)', maxWidth: 680, margin: '16px auto 0', lineHeight: 1.6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 },
  card: {
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 24, padding: 28,
    display: 'flex', flexDirection: 'column', minHeight: 220,
  },
  iconBox: {
    width: 42, height: 42, borderRadius: 14,
    background: 'color-mix(in oklab, var(--accent) 18%, var(--surface))',
    color: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  cardTitle: { fontSize: 20, lineHeight: 1.2, color: 'var(--ink)', fontWeight: 650, marginBottom: 12 },
  cardBody: { fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)', margin: 0 },
  proof: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    background: 'color-mix(in oklab, var(--accent) 18%, var(--surface))',
    borderRadius: 24, padding: '28px 16px', marginTop: 32,
    border: '1px solid var(--line)',
  },
  proofItem: { textAlign: 'center', borderRight: '1px solid var(--line)', padding: '8px 16px' },
  proofBig: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 36, lineHeight: 1, color: 'var(--ink)' },
  proofLabel: { fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 8 },
};

const proofPoints = [
  ['QR Code', 'conexão guiada'],
  ['Logs', 'histórico de envios'],
  ['Filtros', 'palavras e plataformas'],
  ['Cadência', 'intervalos configuráveis'],
];

export function Social() {
  return (
    <section>
      <div className="wrap">
        <div style={s.head}>
          <span className="pill"><span className="dot" />Operação responsável</span>
          <h2 style={{ ...s.h2, marginTop: 16 }}>
            Automação para <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>organizar rotina</span>, não para prometer resultado.
          </h2>
          <p style={s.sub}>
            Substituímos números e depoimentos sem lastro por critérios verificáveis de uso: revisão humana, cadência configurável e logs para acompanhar a rotina de divulgação.
          </p>
        </div>
        <div style={s.grid} className="landing-social-grid">
          {RESPONSIBLE_OPERATION_POINTS.map((item) => (
            <div key={item.title} style={s.card}>
              <div style={s.iconBox}><Icon name="check" size={18} /></div>
              <h3 style={s.cardTitle}>{item.title}</h3>
              <p style={s.cardBody}>{item.body}</p>
            </div>
          ))}
        </div>

        <div style={s.proof} className="landing-social-numbers" aria-label="Sinais verificáveis do produto">
          {proofPoints.map(([title, label], i, a) => (
            <div key={title} style={{ ...s.proofItem, borderRight: i === a.length - 1 ? 'none' : s.proofItem.borderRight }}>
              <div style={s.proofBig}>{title}</div>
              <div style={s.proofLabel}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
