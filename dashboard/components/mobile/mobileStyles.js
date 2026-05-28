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
    minHeight: 44,
    borderRadius: 999,
    fontSize: 14, fontWeight: 600,
    width: full ? '100%' : 'auto',
    border: '1px solid ' + (kind === 'ghost' ? 'var(--line-strong)' : 'transparent'),
    background: kind === 'primary' ? 'var(--ink)' : kind === 'accent' ? 'var(--accent-strong)' : 'transparent',
    color: kind === 'primary' || kind === 'accent' ? 'white' : 'var(--ink)',
    fontFamily: 'inherit', cursor: 'pointer',
    textDecoration: 'none',
  }),
}

export const cfgStyles = {
  pageH: { padding: '18px 20px 0' },
  pageEyebrow: { fontSize: 12, color: 'var(--ink-soft)' },
  pageTitle: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--ink)', marginTop: 2 },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18 },
  cardP: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 18 },
  cardWrap: { padding: '14px 16px 0' },
  field: {
    width: '100%', padding: '12px 14px', minHeight: 44, fontSize: 14,
    background: 'var(--bg-soft)', border: '1px solid var(--line)', borderRadius: 12,
    fontFamily: 'inherit', color: 'var(--ink)',
  },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 },
  row: (last) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    minHeight: 44,
    padding: '14px 16px',
    borderBottom: last ? 'none' : '1px solid var(--line)',
  }),

  rowButton: (last, active = false) => ({
    ...cfgStyles.row(last),
    width: '100%',
    border: 'none',
    borderBottom: last ? 'none' : '1px solid var(--line)',
    background: active ? 'color-mix(in oklab, var(--accent) 12%, var(--surface))' : 'transparent',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
  }),
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' },
  rowSub: { fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 },
  toggle: (on) => ({
    width: 36, height: 20, borderRadius: 999,
    background: on ? 'var(--accent-strong)' : 'var(--bg-soft)',
    position: 'relative', flexShrink: 0, cursor: 'pointer',
  }),
  toggleKnob: (on) => ({
    width: 16, height: 16, borderRadius: '50%', background: 'white',
    position: 'absolute', top: 2, left: on ? 18 : 2,
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  }),
  pill: (tone) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 10.5, fontWeight: 600,
    padding: '3px 8px', borderRadius: 999,
    background: tone === 'success' ? 'color-mix(in oklab, var(--success) 18%, var(--surface))'
              : tone === 'danger' ? 'color-mix(in oklab, var(--danger) 18%, var(--surface))'
              : 'var(--bg-soft)',
    color: tone === 'success' ? 'var(--success)' : tone === 'danger' ? 'var(--danger)' : 'var(--ink)',
    border: '1px solid var(--line)',
  }),
  sectionLabel: { padding: '20px 20px 8px', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  storeBadge: (color) => ({
    width: 32, height: 32, borderRadius: 8,
    background: color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 10.5, flexShrink: 0,
  }),
}
