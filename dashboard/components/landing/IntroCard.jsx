import { Icon } from './Icon'
import { formatDatePtBr } from '@/lib/editorial-content'

const styles = {
  wrap: { display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 32, alignItems: 'stretch' },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 28,
    padding: 40,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  cardAccent: {
    background: 'color-mix(in oklab, var(--accent-3) 40%, var(--surface))',
    border: '1px solid var(--line)',
    borderRadius: 28,
    padding: 40,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  brandMark: {
    width: 48, height: 48, borderRadius: 14,
    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 20,
    boxShadow: '0 6px 16px -4px color-mix(in oklab, var(--accent-strong) 50%, transparent)',
    flexShrink: 0,
  },
  eyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)' },
  title: { fontSize: 'clamp(24px, 2.6vw, 32px)', fontWeight: 600, letterSpacing: '-0.01em', marginTop: 2, lineHeight: 1.15 },
  body: { fontSize: 16, lineHeight: 1.6, color: 'var(--ink)', maxWidth: 620, margin: 0 },
  updated: { fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 16 },
  pillsRow: { marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8 },
  rulesLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 18 },
  rulesRow: { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0' },
  iconNo: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'color-mix(in oklab, #D97757 18%, var(--surface))',
    color: '#C77758',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
    transform: 'rotate(45deg)',
  },
  iconCheck: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'color-mix(in oklab, var(--accent) 26%, var(--surface))',
    color: 'var(--accent-strong)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  ruleText: { fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' },
}

/**
 * Card padrão de introdução logo após o Hero (visual do "About" no Landing.html).
 * Aceita como children um RulesCard ou outro card para layout 2 colunas; sem
 * children, ocupa a wrap inteira em coluna única.
 */
export function IntroCard({ eyebrow, brandMark = 'b', title, body, pills, accent = false, id, updatedAt, children }) {
  const cardStyle = accent ? styles.cardAccent : styles.card
  const decorColor = accent ? 'var(--accent)' : 'var(--accent-2)'

  const leftCard = (
    <div style={cardStyle}>
      <div aria-hidden style={{
        position: 'absolute', top: -80, right: -80,
        width: 260, height: 260, borderRadius: '50%',
        background: `radial-gradient(circle, color-mix(in oklab, ${decorColor} 70%, transparent), transparent 65%)`,
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={styles.brand}>
          <div style={styles.brandMark}>{brandMark}</div>
          <div>
            {eyebrow && <div style={styles.eyebrow}>{eyebrow}</div>}
            {title && <h2 id={id} style={styles.title}>{title}</h2>}
          </div>
        </div>
        {body && <p style={styles.body}>{body}</p>}
        {/* Frescor visível, a mesma data do dateModified/lastmod (EDITORIAL_DATES). */}
        {updatedAt && (
          <p style={styles.updated}>Atualizado em <time dateTime={updatedAt}>{formatDatePtBr(updatedAt)}</time></p>
        )}
        {pills && pills.length > 0 && (
          <div style={styles.pillsRow}>
            {pills.map((tag) => <span key={tag} className="pill">{tag}</span>)}
          </div>
        )}
      </div>
    </div>
  )

  if (!children) return leftCard

  return (
    <div style={styles.wrap} className="landing-about-wrap">
      {leftCard}
      {children}
    </div>
  )
}

/**
 * Card complementar de "uso responsável / o que não faz", para o slot direito
 * do IntroCard. Lista negatives com ícone x e a positive com check.
 */
export function RulesCard({ label, negatives = [], positive }) {
  return (
    <div style={styles.cardAccent}>
      <div style={styles.rulesLabel}>{label}</div>
      {negatives.map((item, idx) => (
        <div
          key={item}
          style={{
            ...styles.rulesRow,
            borderBottom: idx === negatives.length - 1 && !positive ? 'none' : '1px solid var(--line)',
          }}
        >
          <div style={styles.iconNo}><Icon name="plus" size={12} /></div>
          <div style={styles.ruleText}>{item}</div>
        </div>
      ))}
      {positive && (
        <div style={{ ...styles.rulesRow, paddingTop: 12, paddingBottom: 0 }}>
          <div style={styles.iconCheck}><Icon name="check" size={12} /></div>
          <div style={styles.ruleText}>{positive}</div>
        </div>
      )}
    </div>
  )
}
