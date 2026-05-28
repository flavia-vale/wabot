// Shared mobile chrome — header, bottom nav, primitives. Tudo dentro do iOS frame.

const mobi = {
  // Top bar (sticky)
  topbar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px 10px',
    background:'var(--surface)',
    borderBottom:'1px solid var(--line)',
    position:'sticky', top: 0, zIndex: 10,
  },
  topbarBrand: { display:'flex', alignItems:'center', gap: 10 },
  brandMark: {
    width: 32, height: 32, borderRadius: 9,
    background:'linear-gradient(135deg, var(--accent), var(--accent-2))',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', fontWeight: 700, fontSize: 14,
  },
  brandTxt: { fontSize: 15, fontWeight: 600, letterSpacing:'-0.01em', color:'var(--ink)' },
  topbarRight: { display:'flex', alignItems:'center', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    background:'var(--bg-soft)', border:'1px solid var(--line)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'var(--ink)', cursor:'pointer',
    position:'relative',
  },
  notifDot: { position:'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius:'50%', background:'var(--danger)', border:'2px solid var(--surface)' },

  // Status pill in topbar
  statusPill: {
    display:'inline-flex', alignItems:'center', gap: 6,
    padding:'4px 10px', borderRadius: 999,
    background:'color-mix(in oklab, var(--success) 18%, var(--surface))',
    color:'var(--success)',
    fontSize: 11.5, fontWeight: 600,
    border:'1px solid var(--line)',
  },
  statusDot: { width: 6, height: 6, borderRadius:'50%', background:'var(--success)' },

  // Bottom nav (5 tabs)
  bottomNav: {
    position:'absolute', bottom: 0, left: 0, right: 0,
    background:'color-mix(in oklab, var(--surface) 95%, transparent)',
    backdropFilter:'blur(12px)',
    borderTop:'1px solid var(--line)',
    paddingBottom: 24, // home indicator safe area
    paddingTop: 6,
    display:'grid', gridTemplateColumns:'repeat(5,1fr)',
    zIndex: 9,
  },
  navItem: (active) => ({
    display:'flex', flexDirection:'column', alignItems:'center', gap: 4,
    padding:'8px 4px',
    color: active ? 'var(--accent-strong)' : 'var(--ink-soft)',
    fontSize: 10.5, fontWeight: 500,
    cursor:'pointer',
  }),
  navIconWrap: (active) => ({
    width: 44, height: 28, borderRadius: 12,
    display:'flex', alignItems:'center', justifyContent:'center',
    background: active ? 'color-mix(in oklab, var(--accent) 28%, var(--surface))' : 'transparent',
    transition: 'background .15s',
  }),

  // Content wrapper
  content: {
    background:'var(--bg)',
    minHeight:'100%',
    paddingBottom: 92, // space for bottom nav
  },

  // Card primitives
  card: {
    background:'var(--surface)',
    border:'1px solid var(--line)',
    borderRadius: 18,
    padding: 18,
  },
  sectionLabel: {
    fontSize: 11.5, fontWeight: 600, color:'var(--ink-soft)',
    textTransform:'uppercase', letterSpacing:'0.06em',
    padding: '24px 20px 10px',
  },
  // Page padding (gap from topbar to first card)
  pagePad: { padding: '14px 16px 0' },

  // Button
  btn: (kind, full) => ({
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap: 8,
    padding:'12px 18px',
    borderRadius: 999,
    fontSize: 14, fontWeight: 600,
    width: full ? '100%' : 'auto',
    border:'1px solid ' + (kind === 'ghost' ? 'var(--line-strong)' : 'transparent'),
    background: kind === 'primary' ? 'var(--ink)' : kind === 'accent' ? 'var(--accent-strong)' : 'transparent',
    color: kind === 'primary' || kind === 'accent' ? 'white' : 'var(--ink)',
    fontFamily:'inherit', cursor:'pointer',
  }),
};

// Topbar enxuto: identidade à esquerda, sino à direita.
// O status "tudo rodando" mora dentro da página (Home/Espelhar), não no chrome
// — assim o chrome fica leve e o status fica perto do que ele descreve.
const MobileTopbar = ({ title, hasAlert = true }) => (
  <header style={mobi.topbar}>
    <div style={mobi.topbarBrand}>
      <div style={mobi.brandMark}>b</div>
      <div style={mobi.brandTxt}>{title || 'Conversor'}</div>
    </div>
    <div style={mobi.topbarRight}>
      <div style={mobi.iconBtn}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        {hasAlert && <div style={mobi.notifDot}/>}
      </div>
    </div>
  </header>
);

const MobileBottomNav = ({ active = 'inicio' }) => {
  const tabs = [
    {key:'inicio', label:'Início', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )},
    {key:'espelhar', label:'Espelhar', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* duplo arco = espelhamento */}
        <path d="M3 7a5 5 0 0 1 5-5h4"/><path d="M7 12l-4-5 5-2"/>
        <path d="M21 17a5 5 0 0 1-5 5h-4"/><path d="M17 12l4 5-5 2"/>
      </svg>
    )},
    {key:'criar', label:'Criar', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    ), accent: true},
    {key:'envios', label:'Envios', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
      </svg>
    )},
    {key:'conta', label:'Conta', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
      </svg>
    )},
  ];
  return (
    <nav style={mobi.bottomNav}>
      {tabs.map(t => (
        <div key={t.key} style={mobi.navItem(active === t.key)}>
          {t.accent ? (
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background:'var(--ink)', color:'white',
              display:'flex', alignItems:'center', justifyContent:'center',
              marginTop: -10, boxShadow:'0 6px 14px -4px rgba(0,0,0,0.25)',
            }}>{t.icon}</div>
          ) : (
            <div style={mobi.navIconWrap(active === t.key)}>{t.icon}</div>
          )}
          <span>{t.label}</span>
        </div>
      ))}
    </nav>
  );
};

const MobileFrame = ({ children, title, active }) => (
  <IOSDevice title={undefined} width={402} height={874}>
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:'var(--bg)'}}>
      <MobileTopbar title={title}/>
      <div style={{flex:1, overflow:'auto', background:'var(--bg)', paddingBottom: 92}}>
        {children}
      </div>
      <MobileBottomNav active={active}/>
    </div>
  </IOSDevice>
);

Object.assign(window, { mobi, MobileTopbar, MobileBottomNav, MobileFrame });
