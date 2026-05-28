export const mobi = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 18,
    padding: 18,
  },
  sectionLabel: {
    fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '24px 20px 10px',
  },
  pagePad: { padding: '14px 16px 0' },
  btn: (kind, full) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 18px',
    borderRadius: 999,
    fontSize: 14, fontWeight: 600,
    width: full ? '100%' : 'auto',
    border: '1px solid ' + (kind === 'ghost' ? 'var(--line-strong)' : 'transparent'),
    background: kind === 'primary' ? 'var(--ink)' : kind === 'accent' ? 'var(--accent-strong)' : 'transparent',
    color: kind === 'primary' || kind === 'accent' ? 'white' : 'var(--ink)',
    fontFamily: 'inherit', cursor: 'pointer',
  }),
}
