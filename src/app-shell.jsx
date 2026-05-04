// Shared chrome — sidebar, topbar, card primitives — for product screens
const shellStyles = {
  app: {
    display:'grid',
    gridTemplateColumns:'240px 1fr',
    width: '100%',
    height: '100%',
    background: 'var(--bg)',
    color: 'var(--ink)',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  sidebar: {
    background: 'var(--surface)',
    borderRight: '1px solid var(--line)',
    padding: '24px 16px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  brand: {
    display:'flex', alignItems:'center', gap: 10,
    padding: '4px 8px 24px',
    fontWeight: 600, fontSize: 16,
  },
  brandMark: {
    width: 32, height: 32, borderRadius: 10,
    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', fontWeight: 700, fontSize: 14,
  },
  sectionLabel: { fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform:'uppercase', letterSpacing: '0.08em', padding:'16px 12px 8px' },
  navItem: (active) => ({
    display:'flex', alignItems:'center', gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    color: active ? 'var(--ink)' : 'var(--ink-soft)',
    background: active ? 'color-mix(in oklab, var(--accent) 22%, var(--surface))' : 'transparent',
    cursor: 'pointer',
    border:'1px solid ' + (active ? 'var(--line)' : 'transparent'),
  }),
  navBadge: {
    marginLeft:'auto', fontSize: 11, fontWeight: 600,
    padding:'2px 8px', borderRadius: 999,
    background:'var(--accent-strong)', color:'white',
  },
  user: {
    marginTop: 'auto',
    display:'flex', alignItems:'center', gap: 10,
    padding: '10px 12px',
    borderTop:'1px solid var(--line)',
    paddingTop: 16,
  },
  userAvatar: {
    width: 32, height: 32, borderRadius:'50%',
    background:'linear-gradient(135deg, var(--accent-2), var(--accent))',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', fontWeight:600, fontSize: 12,
  },
  main: {
    display:'flex', flexDirection:'column',
    overflow:'hidden',
  },
  topbar: {
    height: 64,
    borderBottom: '1px solid var(--line)',
    padding: '0 32px',
    display:'flex', alignItems:'center', justifyContent:'space-between',
    background: 'var(--surface)',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    padding: '32px',
    overflow:'auto',
  },
  pageTitle: { fontSize: 26, fontWeight: 600, letterSpacing:'-0.02em', marginBottom: 4 },
  pageSub: { fontSize: 14, color:'var(--ink-soft)' },

  card: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 18,
    padding: 24,
  },
  btn: (kind) => ({
    display:'inline-flex', alignItems:'center', gap: 8,
    padding:'9px 16px',
    borderRadius: 999,
    fontSize: 13.5, fontWeight: 600,
    border:'1px solid ' + (kind==='ghost' ? 'var(--line-strong)' : 'transparent'),
    background: kind==='primary' ? 'var(--ink)' : kind==='accent' ? 'var(--accent-strong)' : 'transparent',
    color: kind==='primary' || kind==='accent' ? 'white' : 'var(--ink)',
    cursor:'pointer',
  }),
  pill: (tone) => ({
    display:'inline-flex', alignItems:'center', gap: 6,
    fontSize: 11.5, fontWeight: 600,
    padding:'3px 9px', borderRadius: 999,
    background: tone === 'success' ? 'color-mix(in oklab, var(--success) 18%, var(--surface))'
              : tone === 'warn'    ? 'color-mix(in oklab, var(--accent-3) 60%, var(--surface))'
              : 'var(--bg-soft)',
    color: tone === 'success' ? 'var(--success)' : 'var(--ink)',
    border:'1px solid var(--line)',
  }),
};

const Sidebar = ({ active = 'dashboard', notif = {} }) => {
  const main = [
    {key:'dashboard', label:'Painel', icon:'chart'},
    {key:'groups', label:'Grupos', icon:'users'},
    {key:'rules', label:'Regras', icon:'sparkles'},
    {key:'templates', label:'Mensagens', icon:'chat'},
    {key:'logs', label:'Logs de envio', icon:'bolt'},
  ];
  const settings = [
    {key:'afiliada', label:'IDs de afiliada', icon:'link'},
    {key:'conta', label:'Conta', icon:'users'},
    {key:'whatsapp', label:'Conexão WhatsApp', icon:'chat'},
    {key:'notif', label:'Notificações', icon:'bolt'},
    {key:'plano', label:'Plano e cobrança', icon:'sparkles'},
    {key:'seguranca', label:'Segurança', icon:'shield'},
  ];
  return (
    <aside style={shellStyles.sidebar}>
      <div style={shellStyles.brand}>
        <div style={shellStyles.brandMark}>b</div>
        <span>conversor<span className="serif" style={{fontStyle:'italic', marginLeft:4, color:'var(--accent-strong)'}}>.app</span></span>
      </div>
      <div style={shellStyles.sectionLabel}>Operação</div>
      {main.map(it => (
        <div key={it.key} style={shellStyles.navItem(active === it.key)}>
          <Icon name={it.icon} size={16}/>
          <span>{it.label}</span>
          {notif[it.key] && <span style={shellStyles.navBadge}>{notif[it.key]}</span>}
        </div>
      ))}
      <div style={shellStyles.sectionLabel}>Ajustes</div>
      {settings.map(it => (
        <div key={it.key} style={shellStyles.navItem(active === it.key)}>
          <Icon name={it.icon} size={16}/>
          <span>{it.label}</span>
        </div>
      ))}
      <div style={shellStyles.user}>
        <div style={shellStyles.userAvatar}>SO</div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize: 13, fontWeight: 600, lineHeight: 1.2}}>Sol Almeida</div>
          <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>Plano Pro</div>
        </div>
      </div>
    </aside>
  );
};

const Topbar = ({ title, sub, action }) => (
  <header style={shellStyles.topbar}>
    <div>
      <div style={{fontSize:18, fontWeight: 600, letterSpacing:'-0.01em'}}>{title}</div>
      {sub && <div style={{fontSize: 12.5, color:'var(--ink-soft)', marginTop: 2}}>{sub}</div>}
    </div>
    <div style={{display:'flex', alignItems:'center', gap: 12}}>
      <span style={shellStyles.pill('success')}>
        <span style={{width:6, height:6, borderRadius:'50%', background:'var(--success)'}}/>
        bot online · 3 grupos
      </span>
      {action}
    </div>
  </header>
);

const AppShell = ({ active, title, sub, action, notif, children }) => (
  <div style={shellStyles.app}>
    <Sidebar active={active} notif={notif}/>
    <main style={shellStyles.main}>
      <Topbar title={title} sub={sub} action={action}/>
      <div style={shellStyles.body}>{children}</div>
    </main>
  </div>
);

window.shellStyles = shellStyles;
window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.AppShell = AppShell;
