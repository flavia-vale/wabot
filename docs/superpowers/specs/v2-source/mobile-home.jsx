// HOME v2 — princípio: dizer 3 coisas, nessa ordem.
// 1. Está tudo ok? (alerta no topo se NÃO)
// 2. O que aconteceu hoje (resumo factual, sem vibe)
// 3. O que dá pra fazer agora (1 ação primária + 2 atalhos)
//
// Cortado da v1: "O espelhamento está fluindo." (vibe), mini stats triplicados,
// 4 quick-actions (uma era status disfarçado), upsell PRO (vai pra Conta).

const homeStyles = {
  // Alerta inline (só quando há falhas/desconexões)
  alert: {
    margin:'14px 16px 0',
    padding:'12px 14px',
    background:'color-mix(in oklab, var(--danger) 12%, var(--surface))',
    border:'1px solid color-mix(in oklab, var(--danger) 35%, var(--line))',
    borderRadius: 14,
    display:'flex', alignItems:'center', gap: 12,
    cursor:'pointer',
  },
  alertIcon: {
    width: 28, height: 28, borderRadius: 8,
    background:'var(--danger)', color:'white',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  },
  alertText: { flex: 1, minWidth: 0 },
  alertTitle: { fontSize: 13, fontWeight: 600, color:'var(--ink)' },
  alertSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },

  // Header da página (oi + factual)
  greet: { padding:'14px 20px 0' },
  greetHi: { fontSize: 13, color:'var(--ink-soft)' },
  greetHead: {
    fontSize: 22, lineHeight: 1.25, fontWeight: 500,
    color:'var(--ink)', letterSpacing:'-0.01em',
    marginTop: 4,
    textWrap:'pretty',
  },
  greetNum: { color:'var(--ink)', fontWeight: 700 },

  // Hero único — não 2 layers de stats
  hero: {
    margin:'16px 16px 0',
    background:'var(--ink)', color:'white',
    borderRadius: 22, padding:'18px 18px 14px',
    position:'relative', overflow:'hidden',
  },
  heroBlob: {
    position:'absolute', right:-50, top:-50, width: 200, height: 200,
    borderRadius:'50%', background:'var(--accent-strong)',
    filter:'blur(46px)', opacity:.5, pointerEvents:'none',
  },
  heroGrid: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 14, position:'relative' },
  heroStat: {},
  heroStatLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing:'0.08em',
    textTransform:'uppercase', color:'rgba(255,255,255,0.55)',
    marginBottom: 4,
  },
  heroStatNum: {
    fontSize: 26, lineHeight: 1, fontWeight: 600,
    letterSpacing:'-0.02em',
  },
  heroStatTrend: (good) => ({
    fontSize: 11, marginTop: 4,
    color: good ? 'var(--accent-2)' : 'rgba(255,255,255,0.55)',
  }),
  heroDivider: {
    background:'rgba(255,255,255,0.12)', width: 1, alignSelf:'stretch', margin:'2px 0',
  },
  heroFoot: {
    position:'relative', marginTop: 14, paddingTop: 12,
    borderTop:'1px solid rgba(255,255,255,0.12)',
    display:'flex', alignItems:'center', gap: 8,
    fontSize: 11, color:'rgba(255,255,255,0.6)',
  },
  heroLive: { width: 6, height: 6, borderRadius:'50%', background:'var(--success)', boxShadow:'0 0 0 3px rgba(46,160,67,0.25)' },

  // Ação primária dominante
  primaryWrap: { padding:'18px 16px 0' },
  primaryBtn: {
    width:'100%', padding:'16px 18px',
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 18,
    display:'flex', alignItems:'center', gap: 14,
    cursor:'pointer', fontFamily:'inherit',
  },
  primaryIcon: {
    width: 44, height: 44, borderRadius: 12,
    background:'linear-gradient(135deg, var(--accent-strong), var(--accent))',
    color:'white',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  },
  primaryText: { flex: 1, minWidth: 0, textAlign:'left' },
  primaryTitle: { fontSize: 15, fontWeight: 600, color:'var(--ink)' },
  primarySub: { fontSize: 12, color:'var(--ink-soft)', marginTop: 2 },

  // Atalhos secundários
  shortcutsRow: { display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10, padding:'10px 16px 0' },
  shortcut: {
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 14, padding:'12px 14px',
    display:'flex', alignItems:'center', gap: 10,
    cursor:'pointer',
  },
  shortcutIcon: (bg, fg) => ({
    width: 30, height: 30, borderRadius: 9,
    background: bg, color: fg,
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  }),
  shortcutLabel: { fontSize: 12.5, fontWeight: 500, color:'var(--ink)' },

  // Seção
  sectionH: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'24px 20px 10px',
  },
  sectionTitle: { fontSize: 14, fontWeight: 600, color:'var(--ink)' },
  sectionLink: { fontSize: 12, color:'var(--accent-strong)', fontWeight: 600, cursor:'pointer' },
  sectionHint: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: -2, padding:'0 20px', lineHeight: 1.4 },

  // Atividade — espelhamentos recentes
  activityCard: {
    margin:'0 16px',
    background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 18,
    overflow:'hidden',
  },
  actRow: (last) => ({
    display:'flex', alignItems:'flex-start', gap: 12,
    padding:'13px 14px',
    borderBottom: last ? 'none' : '1px solid var(--line)',
  }),
  actDot: (tone) => ({
    width: 8, height: 8, borderRadius:'50%',
    background: tone === 'ok' ? 'var(--success)' : tone === 'fail' ? 'var(--danger)' : 'var(--warn)',
    marginTop: 6, flexShrink: 0,
  }),
  actMain: { flex: 1, minWidth: 0 },
  actTitle: { fontSize: 13.5, fontWeight: 500, color:'var(--ink)', lineHeight: 1.35 },
  actMeta: {
    fontSize: 11.5, color:'var(--ink-soft)', marginTop: 3,
    display:'flex', alignItems:'center', gap: 5, flexWrap:'wrap',
  },
  actTime: { fontSize: 11, color:'var(--ink-faint)', fontFamily:"'JetBrains Mono', monospace", flexShrink: 0 },

  // Checklist do empty-state / setup
  setup: {
    margin:'16px 16px 0',
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 18, padding: 18,
  },
  setupHead: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    marginBottom: 14,
  },
  setupTitle: { fontSize: 15, fontWeight: 600, color:'var(--ink)' },
  setupProgress: {
    fontSize: 11, fontWeight: 600, color:'var(--ink-soft)',
    fontFamily:"'JetBrains Mono', monospace",
  },
  setupBar: {
    height: 4, background:'var(--bg-soft)', borderRadius: 999, overflow:'hidden',
    marginBottom: 14,
  },
  setupBarFill: { height:'100%', background:'var(--accent-strong)', borderRadius: 999 },
  setupItem: (done, current) => ({
    display:'flex', alignItems:'center', gap: 12,
    padding:'10px 0',
    borderBottom: '1px solid var(--line)',
  }),
  setupCheck: (done) => ({
    width: 22, height: 22, borderRadius:'50%',
    background: done ? 'var(--success)' : 'var(--surface)',
    border:'1.5px solid ' + (done ? 'var(--success)' : 'var(--line-strong)'),
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', flexShrink: 0,
  }),
  setupItemLabel: (done) => ({
    flex: 1, fontSize: 13.5,
    color: done ? 'var(--ink-soft)' : 'var(--ink)',
    fontWeight: done ? 400 : 500,
    textDecoration: done ? 'line-through' : 'none',
  }),
  setupItemAction: {
    fontSize: 12, fontWeight: 600,
    color:'var(--accent-strong)',
    padding:'4px 10px',
    border:'1px solid var(--line)', borderRadius: 999,
    background:'var(--surface)',
    cursor:'pointer', fontFamily:'inherit',
  },
};

// Sparkline mini para o foot do hero
const HomeSparkline = () => {
  const data = [2, 4, 3, 6, 8, 5, 9, 12, 14, 10, 13, 16, 14, 18, 22, 19, 24, 21, 26, 28, 25, 30, 32, 28];
  const max = Math.max(...data);
  const w = 100, h = 14;
  const points = data.map((v, i) => `${(i * w) / (data.length - 1)},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h+2}`} width="100%" height={h+2} preserveAspectRatio="none" style={{flex:1, maxWidth: 120}}>
      <polyline points={points} fill="none" stroke="rgba(217,207,234,0.7)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
};

const MobileHome = ({ checklistDone = 5, hasAlert = true }) => {
  const isOnboarding = checklistDone < 5;

  const checklist = [
    {label:'Suas afiliadas (Shopee, ML…)',    done: true},
    {label:'Conectar WhatsApp',               done: true},
    {label:'1 grupo de origem',                done: true},
    {label:'1 grupo de destino',               done: true},
    {label:'Ligar o espelhamento',             done: false, current: true},
  ];

  return (
    <MobileFrame title="Conversor" active="inicio">
      {/* Alerta inline — só quando há problemas reais */}
      {hasAlert && !isOnboarding && (
        <div style={homeStyles.alert}>
          <div style={homeStyles.alertIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.5"/>
            </svg>
          </div>
          <div style={homeStyles.alertText}>
            <div style={homeStyles.alertTitle}>3 envios falharam hoje</div>
            <div style={homeStyles.alertSub}>AliExpress desconectou · toque para resolver</div>
          </div>
          <Icon name="arrow" size={14}/>
        </div>
      )}

      {/* Saudação + manchete factual */}
      <div style={homeStyles.greet}>
        <div style={homeStyles.greetHi}>Oi, Sol 👋</div>
        {isOnboarding ? (
          <div style={homeStyles.greetHead}>
            Falta um passo<br/>pra começar.
          </div>
        ) : (
          <div style={homeStyles.greetHead}>
            Hoje você postou{' '}
            <span style={homeStyles.greetNum}>147 promoções</span>{' '}
            nos seus grupos.
          </div>
        )}
      </div>

      {/* Hero — só números factuais, sem rótulos vagos */}
      {!isOnboarding && (
        <div style={homeStyles.hero}>
          <div style={homeStyles.heroBlob}/>
          <div style={homeStyles.heroGrid}>
            <div style={homeStyles.heroStat}>
              <div style={homeStyles.heroStatLabel}>Detectados</div>
              <div style={homeStyles.heroStatNum}>183</div>
              <div style={homeStyles.heroStatTrend()}>nos grupos monitorados</div>
            </div>
            <div style={homeStyles.heroDivider}/>
            <div style={homeStyles.heroStat}>
              <div style={homeStyles.heroStatLabel}>Postados</div>
              <div style={homeStyles.heroStatNum}>147</div>
              <div style={homeStyles.heroStatTrend(true)}>↑ 12% vs. ontem</div>
            </div>
          </div>
          <div style={homeStyles.heroFoot}>
            <span style={homeStyles.heroLive}/>
            <span>último envio há 2 min</span>
            <span style={{flex:1}}/>
            <HomeSparkline/>
          </div>
        </div>
      )}

      {/* Setup checklist (só no onboarding) */}
      {isOnboarding && (
        <div style={homeStyles.setup}>
          <div style={homeStyles.setupHead}>
            <div style={homeStyles.setupTitle}>Configurar bot</div>
            <span style={homeStyles.setupProgress}>{checklistDone}/5</span>
          </div>
          <div style={homeStyles.setupBar}>
            <div style={{...homeStyles.setupBarFill, width: `${(checklistDone/5)*100}%`}}/>
          </div>
          <div>
            {checklist.map((c, i, a) => (
              <div key={i} style={{
                ...homeStyles.setupItem(),
                borderBottom: i === a.length-1 ? 'none' : '1px solid var(--line)',
              }}>
                <div style={homeStyles.setupCheck(c.done)}>
                  {c.done && <Icon name="check" size={11} stroke={3}/>}
                </div>
                <span style={homeStyles.setupItemLabel(c.done)}>{c.label}</span>
                {c.current && <button style={homeStyles.setupItemAction}>Fazer</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AÇÃO PRIMÁRIA — única, dominante */}
      <div style={homeStyles.primaryWrap}>
        <button style={homeStyles.primaryBtn}>
          <div style={homeStyles.primaryIcon}>
            <Icon name="sparkles" size={20}/>
          </div>
          <div style={homeStyles.primaryText}>
            <div style={homeStyles.primaryTitle}>Criar oferta agora</div>
            <div style={homeStyles.primarySub}>cole um link e a gente faz o resto</div>
          </div>
          <Icon name="arrow" size={16}/>
        </button>
      </div>

      {/* Atalhos — só 2, não 4. Nada de "status disfarçado de ação" */}
      <div style={homeStyles.shortcutsRow}>
        <div style={homeStyles.shortcut}>
          <div style={homeStyles.shortcutIcon('color-mix(in oklab, var(--accent-2) 60%, var(--surface))', 'var(--ink)')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a5 5 0 0 1 5-5h4"/><path d="M7 12l-4-5 5-2"/>
              <path d="M21 17a5 5 0 0 1-5 5h-4"/><path d="M17 12l4 5-5 2"/>
            </svg>
          </div>
          <div style={homeStyles.shortcutLabel}>Espelhamento</div>
        </div>
        <div style={homeStyles.shortcut}>
          <div style={homeStyles.shortcutIcon('var(--bg-soft)', 'var(--ink-soft)')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </div>
          <div style={homeStyles.shortcutLabel}>Ver envios</div>
        </div>
      </div>

      {/* Atividade recente — só quando já tem operação rodando */}
      {!isOnboarding && (
        <>
          <div style={homeStyles.sectionH}>
            <div style={homeStyles.sectionTitle}>Últimos envios</div>
            <div style={homeStyles.sectionLink}>Ver tudo →</div>
          </div>
          <div style={homeStyles.activityCard}>
        {[
          {t:'Sandália Bege Verão 2026', loja:'Shopee', dest:'Achados da Sol 💜', when:'agora', tone:'ok'},
          {t:'Air Fryer Mondial 4L', loja:'Mercado Livre', dest:'Sol · Tech & Casa', when:'12 min', tone:'ok'},
          {t:'Kit Maquiagem Ruby Rose', loja:'Amazon', dest:'Canal Sol Achados', when:'27 min', tone:'ok'},
          {t:'Carregador USB-C 65W', loja:'AliExpress', dest:null, when:'1h 18', tone:'fail', erro:'AliExpress desconectada'},
        ].map((a, i, arr) => (
          <div key={i} style={homeStyles.actRow(i === arr.length - 1)}>
            <div style={homeStyles.actDot(a.tone)}/>
            <div style={homeStyles.actMain}>
              <div style={homeStyles.actTitle}>{a.t}</div>
              <div style={homeStyles.actMeta}>
                <span>{a.loja}</span>
                <span style={{color:'var(--ink-faint)'}}>→</span>
                {a.dest
                  ? <span style={{color:'var(--ink)', fontWeight: 500}}>{a.dest}</span>
                  : <span style={{color:'var(--danger)', fontWeight: 500}}>{a.erro}</span>}
              </div>
            </div>
            <div style={homeStyles.actTime}>{a.when}</div>
          </div>
        ))}
          </div>
        </>
      )}

      <div style={{height: 20}}/>
    </MobileFrame>
  );
};

window.MobileHome = MobileHome;
