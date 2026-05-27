// ESPELHAR v2 — princípio: 1 frase humana resume tudo, 1 toggle controla tudo,
// 2 cards (de onde / pra onde), e o resto é secundário.
//
// Cortado da v1: diagrama 4→3→3 abstrato, "como funciona" explainer, 5 seções
// empilhadas, ticker ao vivo (move pra Envios), regras inline com chips de
// código (vai pra sub-tela).

const espStyles = {
  pageH: { padding: '18px 20px 0' },
  pageEyebrow: { fontSize: 12, color:'var(--ink-soft)' },
  pageTitle: { fontSize: 22, fontWeight: 600, color:'var(--ink)', letterSpacing:'-0.01em', marginTop: 2 },
  pageSentence: {
    fontSize: 14, color:'var(--ink-soft)', lineHeight: 1.5,
    marginTop: 10, textWrap:'pretty',
  },
  pageNum: { color:'var(--ink)', fontWeight: 600 },

  // Switch principal — controla espelhamento ON/OFF
  control: {
    margin:'16px 16px 0',
    background:'var(--ink)', color:'white',
    borderRadius: 18, padding:'14px 16px',
    position:'relative', overflow:'hidden',
    display:'flex', alignItems:'center', gap: 14,
  },
  controlBlob: {
    position:'absolute', right:-30, top:-40, width: 140, height: 140,
    borderRadius:'50%', background:'var(--success)',
    filter:'blur(40px)', opacity:.45, pointerEvents:'none',
  },
  controlIcon: {
    width: 36, height: 36, borderRadius: 11,
    background:'rgba(255,255,255,0.08)',
    border:'1px solid rgba(255,255,255,0.18)',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0, position:'relative',
  },
  controlMain: { flex: 1, minWidth: 0, position:'relative' },
  controlTitle: { fontSize: 14, fontWeight: 600 },
  controlSub: { fontSize: 11.5, opacity:.7, marginTop: 2 },
  controlLive: {
    width: 6, height: 6, borderRadius:'50%',
    background:'var(--success)',
    boxShadow:'0 0 0 3px rgba(46,160,67,0.3)',
    display:'inline-block', marginRight: 6, verticalAlign:'middle',
  },
  bigToggle: (on) => ({
    width: 50, height: 28, borderRadius: 999,
    background: on ? 'var(--success)' : 'rgba(255,255,255,0.15)',
    position:'relative', flexShrink: 0, cursor:'pointer',
    transition:'background .2s',
  }),
  bigToggleKnob: (on) => ({
    width: 22, height: 22, borderRadius:'50%', background:'white',
    position:'absolute', top: 3, left: on ? 25 : 3,
    boxShadow:'0 2px 4px rgba(0,0,0,0.2)',
    transition:'left .2s',
  }),

  // Mini stats — só hoje, factual
  miniStats: {
    margin:'10px 16px 0',
    display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 8,
  },
  miniStat: {
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 14, padding:'12px 12px',
  },
  miniStatLabel: {
    fontSize: 10.5, fontWeight: 600, color:'var(--ink-soft)',
    textTransform:'uppercase', letterSpacing:'0.06em', marginBottom: 4,
  },
  miniStatNum: { fontSize: 22, fontWeight: 600, color:'var(--ink)', lineHeight: 1, letterSpacing:'-0.02em' },
  miniStatSub: { fontSize: 11, color:'var(--ink-soft)', marginTop: 4 },

  // Section
  sectionH: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'24px 20px 8px',
  },
  sectionTitle: { fontSize: 14, fontWeight: 600, color:'var(--ink)' },
  sectionAction: { fontSize: 12, color:'var(--accent-strong)', fontWeight: 600, cursor:'pointer' },
  sectionHint: {
    padding:'0 20px', fontSize: 12, color:'var(--ink-soft)',
    marginBottom: 4, lineHeight: 1.4,
  },

  // Cards de grupos
  card: { margin:'0 16px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 16, overflow:'hidden' },
  groupRow: (last) => ({
    display:'flex', alignItems:'center', gap: 12,
    padding:'12px 14px',
    borderBottom: last ? 'none' : '1px solid var(--line)',
  }),
  groupAvatar: (gradient) => ({
    width: 36, height: 36, borderRadius:'50%',
    background: gradient,
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', fontWeight: 700, fontSize: 12,
    flexShrink: 0,
  }),
  groupMain: { flex: 1, minWidth: 0 },
  groupName: { fontSize: 13.5, fontWeight: 500, color:'var(--ink)' },
  groupSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2, display:'flex', alignItems:'center', gap: 5 },

  addBtn: {
    width:'100%',
    display:'flex', alignItems:'center', gap: 12,
    padding:'14px 14px',
    background:'transparent', border:'none',
    color:'var(--accent-strong)',
    fontSize: 13.5, fontWeight: 600,
    cursor:'pointer', fontFamily:'inherit',
    borderTop:'1px solid var(--line)',
  },
  addIcon: {
    width: 36, height: 36, borderRadius:'50%',
    background:'color-mix(in oklab, var(--accent) 18%, var(--surface))',
    border:'1.5px dashed var(--accent-strong)',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  },

  // Filtros — entry, não card inline
  filtersEntry: {
    margin:'10px 16px 0',
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 16, padding:'14px 16px',
    display:'flex', alignItems:'center', gap: 12,
    cursor:'pointer',
  },
  filtersIcon: {
    width: 36, height: 36, borderRadius: 10,
    background:'color-mix(in oklab, var(--accent-2) 50%, var(--surface))',
    color:'var(--ink)',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  },
  filtersMain: { flex: 1, minWidth: 0 },
  filtersTitle: { fontSize: 13.5, fontWeight: 600, color:'var(--ink)' },
  filtersSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },
  filtersCount: {
    fontSize: 11, fontWeight: 700, color:'var(--ink)',
    background:'var(--bg-soft)', padding:'3px 8px', borderRadius: 999,
    border:'1px solid var(--line)',
  },
};

const MobileEspelhar = ({ on = true }) => {
  const origens = [
    {nome:'Promoções Brasil 🔥', plat:'WhatsApp', g:'linear-gradient(135deg,#94A3B8,#475569)'},
    {nome:'Cupons & Cashback BR', plat:'WhatsApp', g:'linear-gradient(135deg,#F4D9E0,#E8A488)'},
    {nome:'Ofertas Relâmpago', plat:'Telegram', g:'linear-gradient(135deg,#C8E6D8,#3E9C7A)'},
    {nome:'Promoções de TI', plat:'WhatsApp', g:'linear-gradient(135deg,#D9CFEA,#7C5CF5)'},
  ];

  const destinos = [
    {nome:'Achados da Sol 💜', tipo:'grupo · 247 pessoas', g:'linear-gradient(135deg, var(--accent), var(--accent-2))'},
    {nome:'Sol · Tech & Casa', tipo:'grupo · 118 pessoas', g:'linear-gradient(135deg, var(--accent-3), var(--warn))'},
    {nome:'Canal Sol Achados', tipo:'canal · 2.4k inscritos', g:'linear-gradient(135deg, var(--accent-2), var(--accent-strong))'},
  ];

  return (
    <MobileFrame title="Espelhamento" active="espelhar">
      <div style={espStyles.pageH}>
        <div style={espStyles.pageEyebrow}>Funcionalidade PRO</div>
        <div style={espStyles.pageTitle}>Espelhamento</div>
        <div style={espStyles.pageSentence}>
          Você monitora <span style={espStyles.pageNum}>4 grupos</span>.
          Quando aparece uma promoção, a gente troca o link pela sua afiliada
          e posta nos <span style={espStyles.pageNum}>3 grupos seus</span>.
        </div>
      </div>

      {/* Controle ON/OFF — único toggle visível */}
      <div style={espStyles.control}>
        <div style={espStyles.controlBlob}/>
        <div style={espStyles.controlIcon}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a5 5 0 0 1 5-5h4"/><path d="M7 12l-4-5 5-2"/>
            <path d="M21 17a5 5 0 0 1-5 5h-4"/><path d="M17 12l4 5-5 2"/>
          </svg>
        </div>
        <div style={espStyles.controlMain}>
          <div style={espStyles.controlTitle}>
            {on ? 'Ligado' : 'Pausado'}
          </div>
          <div style={espStyles.controlSub}>
            {on ? (
              <>
                <span style={espStyles.controlLive}/>
                último envio há 2 min
              </>
            ) : 'os grupos não estão sendo monitorados'}
          </div>
        </div>
        <div style={espStyles.bigToggle(on)}>
          <div style={espStyles.bigToggleKnob(on)}/>
        </div>
      </div>

      {/* Stats compactos do dia */}
      <div style={espStyles.miniStats}>
        <div style={espStyles.miniStat}>
          <div style={espStyles.miniStatLabel}>Hoje</div>
          <div style={espStyles.miniStatNum}>147</div>
          <div style={espStyles.miniStatSub}>postados</div>
        </div>
        <div style={espStyles.miniStat}>
          <div style={espStyles.miniStatLabel}>Vistos</div>
          <div style={espStyles.miniStatNum}>183</div>
          <div style={espStyles.miniStatSub}>nas origens</div>
        </div>
        <div style={espStyles.miniStat}>
          <div style={espStyles.miniStatLabel}>Erros</div>
          <div style={{...espStyles.miniStatNum, color: 'var(--danger)'}}>3</div>
          <div style={{...espStyles.miniStatSub, color: 'var(--danger)'}}>resolver →</div>
        </div>
      </div>

      {/* ── DE ONDE VEM ── */}
      <div style={espStyles.sectionH}>
        <div style={espStyles.sectionTitle}>Grupos que monitoro</div>
        <div style={espStyles.sectionAction}>Editar</div>
      </div>
      <div style={espStyles.sectionHint}>
        De onde a gente captura as promoções.
      </div>

      <div style={espStyles.card}>
        {origens.map((g, i, a) => (
          <div key={g.nome} style={espStyles.groupRow(false)}>
            <div style={espStyles.groupAvatar(g.g)}>
              {g.nome.replace(/[^A-Za-zÀ-ÿ ]/g,'').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,2)}
            </div>
            <div style={espStyles.groupMain}>
              <div style={espStyles.groupName}>{g.nome}</div>
              <div style={espStyles.groupSub}>
                <span style={{width: 5, height: 5, borderRadius:'50%', background:'var(--success)'}}/>
                {g.plat}
              </div>
            </div>
            <Icon name="arrow" size={14}/>
          </div>
        ))}
        <button style={espStyles.addBtn}>
          <div style={espStyles.addIcon}>
            <Icon name="plus" size={14} stroke={2.4}/>
          </div>
          <span>Adicionar grupo</span>
        </button>
      </div>

      {/* ── PRA ONDE VAI ── */}
      <div style={espStyles.sectionH}>
        <div style={espStyles.sectionTitle}>Meus grupos de promoção</div>
        <div style={espStyles.sectionAction}>Editar</div>
      </div>
      <div style={espStyles.sectionHint}>
        Pra onde a gente posta o link já com sua afiliada.
      </div>

      <div style={espStyles.card}>
        {destinos.map((d, i, a) => (
          <div key={d.nome} style={espStyles.groupRow(false)}>
            <div style={espStyles.groupAvatar(d.g)}>
              {d.nome.split(' ').slice(0,2).map(w=>w[0]).join('').replace(/[^A-Za-zÀ-ÿ]/g,'').toUpperCase().slice(0,2)}
            </div>
            <div style={espStyles.groupMain}>
              <div style={espStyles.groupName}>{d.nome}</div>
              <div style={espStyles.groupSub}>{d.tipo}</div>
            </div>
            <Icon name="arrow" size={14}/>
          </div>
        ))}
        <button style={espStyles.addBtn}>
          <div style={espStyles.addIcon}>
            <Icon name="plus" size={14} stroke={2.4}/>
          </div>
          <span>Adicionar grupo</span>
        </button>
      </div>

      {/* ── FILTROS / REGRAS — entry secundário ── */}
      <div style={espStyles.sectionH}>
        <div style={espStyles.sectionTitle}>Refinar o que entra</div>
      </div>

      <div style={espStyles.filtersEntry}>
        <div style={espStyles.filtersIcon}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
        </div>
        <div style={espStyles.filtersMain}>
          <div style={espStyles.filtersTitle}>Filtros de preço, categoria e loja</div>
          <div style={espStyles.filtersSub}>
            ex: só postar se ≤ R$ 200 com 30%+ de desconto
          </div>
        </div>
        <span style={espStyles.filtersCount}>3 ativos</span>
        <Icon name="arrow" size={14}/>
      </div>

      {/* Ritmo de envio */}
      <div style={espStyles.sectionH}>
        <div style={espStyles.sectionTitle}>Ritmo de envio</div>
      </div>

      <div style={espStyles.filtersEntry}>
        <div style={espStyles.filtersIcon}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div style={espStyles.filtersMain}>
          <div style={espStyles.filtersTitle}>1 envio a cada 12 minutos</div>
          <div style={espStyles.filtersSub}>
            evita parecer spam · ajustável conforme o uso
          </div>
        </div>
        <Icon name="arrow" size={14}/>
      </div>

      <div style={{height: 24}}/>
    </MobileFrame>
  );
};

window.MobileEspelhar = MobileEspelhar;
