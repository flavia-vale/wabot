// CONFIGURAÇÃO + CONTA · Conexão WhatsApp, Grupos, Credenciais, Preferências, Tutorial, Assinatura, Suporte

const cfgStyles = {
  pageH: { padding: '18px 20px 0' },
  pageEyebrow: { fontSize: 12, color:'var(--ink-soft)' },
  pageTitle: { fontFamily:"'Instrument Serif', serif", fontStyle:'italic', fontSize: 28, lineHeight: 1.1, letterSpacing:'-0.02em', color:'var(--ink)', marginTop: 2 },
  card: { background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 18 },
  cardP: { background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 18, padding: 18 },
  cardWrap: { padding:'14px 16px 0' },
  field: {
    width:'100%', padding:'12px 14px', fontSize: 14,
    background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 12,
    fontFamily:'inherit', color:'var(--ink)',
  },
  label: { fontSize: 12, fontWeight: 600, color:'var(--ink)', marginBottom: 8 },
  row: (last) => ({
    display:'flex', alignItems:'center', gap: 12,
    padding:'14px 16px',
    borderBottom: last ? 'none' : '1px solid var(--line)',
  }),
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13.5, fontWeight: 500, color:'var(--ink)' },
  rowSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },
  toggle: (on) => ({
    width: 36, height: 20, borderRadius: 999,
    background: on ? 'var(--accent-strong)' : 'var(--bg-soft)',
    position:'relative', flexShrink: 0, cursor:'pointer',
  }),
  toggleKnob: (on) => ({
    width: 16, height: 16, borderRadius:'50%', background:'white',
    position:'absolute', top: 2, left: on ? 18 : 2,
    boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
  }),
  pill: (tone) => ({
    display:'inline-flex', alignItems:'center', gap: 5,
    fontSize: 10.5, fontWeight: 600,
    padding:'3px 8px', borderRadius: 999,
    background: tone === 'success' ? 'color-mix(in oklab, var(--success) 18%, var(--surface))'
              : tone === 'danger'  ? 'color-mix(in oklab, var(--danger) 18%, var(--surface))'
              : 'var(--bg-soft)',
    color: tone === 'success' ? 'var(--success)' : tone === 'danger' ? 'var(--danger)' : 'var(--ink)',
    border:'1px solid var(--line)',
  }),
  sectionLabel: { padding:'20px 20px 8px', fontSize: 11, fontWeight: 600, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.08em' },
  storeBadge: (color) => ({
    width: 32, height: 32, borderRadius: 8,
    background: color,
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', fontWeight: 700, fontSize: 10.5, flexShrink: 0,
  }),
};

// ═══════════════ CONEXÃO WHATSAPP ═══════════════
const MobileWhatsApp = () => (
  <MobileFrame title="Conversor" active="">
    <div style={cfgStyles.pageH}>
      <div style={cfgStyles.pageEyebrow}>Configuração</div>
      <div style={cfgStyles.pageTitle}>Conexão WhatsApp</div>
    </div>

    {/* Status conectado */}
    <div style={cfgStyles.cardWrap}>
      <div style={{...cfgStyles.cardP, background:'color-mix(in oklab, var(--success) 12%, var(--surface))', border:'1px solid color-mix(in oklab, var(--success) 30%, var(--line))'}}>
        <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: 14}}>
          <div style={{width: 40, height: 40, borderRadius: 12, background:'var(--success)', display:'flex', alignItems:'center', justifyContent:'center', color:'white'}}>
            <Icon name="check" size={20} stroke={3}/>
          </div>
          <div style={{flex: 1}}>
            <div style={{fontSize: 14, fontWeight: 600, color:'var(--ink)'}}>WhatsApp conectado</div>
            <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>+55 11 9 8765-4321 · 47 dias ativos</div>
          </div>
        </div>
        <div style={{display:'flex', gap: 8}}>
          <button style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5, padding:'10px 14px'}}>Sincronizar</button>
          <button style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5, padding:'10px 14px', color:'var(--danger)'}}>Desconectar</button>
        </div>
      </div>
    </div>

    {/* Limites */}
    <div style={cfgStyles.sectionLabel}>Limites e cadência</div>
    <div style={{padding:'0 16px'}}>
      <div style={cfgStyles.card}>
        <div style={cfgStyles.row()}>
          <div style={cfgStyles.rowMain}>
            <div style={cfgStyles.rowTitle}>Posts hoje</div>
            <div style={cfgStyles.rowSub}>127 de 250 · 51% do limite</div>
            <div style={{height: 5, background:'var(--bg-soft)', borderRadius: 999, marginTop: 8, overflow:'hidden'}}>
              <div style={{width:'51%', height:'100%', background:'var(--accent-strong)'}}/>
            </div>
          </div>
        </div>
        <div style={cfgStyles.row()}>
          <div style={cfgStyles.rowMain}>
            <div style={cfgStyles.rowTitle}>Tempo mínimo entre posts</div>
            <div style={cfgStyles.rowSub}>recomendado para evitar bloqueios</div>
          </div>
          <div style={{fontSize: 13, fontWeight: 600, color:'var(--ink)'}}>45 s</div>
        </div>
        <div style={cfgStyles.row(true)}>
          <div style={cfgStyles.rowMain}>
            <div style={cfgStyles.rowTitle}>Modo soneca · 23h–7h</div>
            <div style={cfgStyles.rowSub}>bot não posta no período noturno</div>
          </div>
          <div style={cfgStyles.toggle(true)}><div style={cfgStyles.toggleKnob(true)}/></div>
        </div>
      </div>
    </div>

    <div style={{height: 24}}/>
  </MobileFrame>
);

// ═══════════════ GRUPOS E CANAIS ═══════════════
const MobileGroups = () => {
  const [tab, setTab] = React.useState('origem');
  const origem = [
    {nome:'Promoções Brasil 🔥', m:'1.842 membros', last:'agora · 124 hoje', on:true, g:'linear-gradient(135deg,#94A3B8,#475569)'},
    {nome:'Cupons & Cashback BR', m:'2.340 membros', last:'4 min · 87 hoje', on:true, g:'linear-gradient(135deg,#F4D9E0,#E8A488)'},
    {nome:'Ofertas Relâmpago Shopee', m:'967 membros', last:'12 min · 58 hoje', on:true, g:'linear-gradient(135deg,#C8E6D8,#3E9C7A)'},
    {nome:'Promoções de TI', m:'580 membros', last:'23 min · 34 hoje', on:true, g:'linear-gradient(135deg,#D9CFEA,#7C5CF5)'},
    {nome:'Achadinhos Mães', m:'412 membros', last:'pausado', on:false, g:'linear-gradient(135deg,#F6E8D8,#E8A488)'},
  ];
  const destino = [
    {nome:'Achados da Sol 💜', m:'grupo · 247 membros', last:'89 posts hoje', on:true, g:'linear-gradient(135deg,#7CC9A9,#D9CFEA)'},
    {nome:'Sol · Tech & Casa', m:'grupo · 118 membros', last:'38 posts hoje', on:true, g:'linear-gradient(135deg,#D9CFEA,#7C5CF5)'},
    {nome:'Canal Sol Achados', m:'canal · 2.4k inscritos', last:'72 posts hoje', on:true, g:'linear-gradient(135deg,#F6E8D8,#7CC9A9)'},
  ];
  const data = tab === 'origem' ? origem : destino;

  return (
    <MobileFrame title="Conversor" active="">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Grupos e canais</div>
      </div>

      {/* Toggle origem/destino */}
      <div style={{padding:'14px 16px 0'}}>
        <div style={{display:'flex', gap: 4, padding: 4, background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 14}}>
          {[
            {key:'origem', label:'👁 Monitorar', n: origem.length},
            {key:'destino', label:'⚡ Publicar', n: destino.length},
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding:'10px 8px', borderRadius: 10, border:'none', cursor:'pointer',
              fontSize: 12.5, fontWeight: 600, fontFamily:'inherit',
              background: tab === t.key ? 'var(--ink)' : 'transparent',
              color: tab === t.key ? 'white' : 'var(--ink-soft)',
              display:'flex', alignItems:'center', justifyContent:'center', gap: 6,
            }}>
              {t.label}
              <span style={{fontSize: 10.5, opacity: tab === t.key ? .7 : .55, padding:'1px 6px', borderRadius: 999, background: tab === t.key ? 'rgba(255,255,255,0.15)' : 'var(--bg-soft)'}}>{t.n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Texto explicativo */}
      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        {tab === 'origem'
          ? 'Grupos onde o bot lê os links de promoção. Você só precisa ser membro — ele não posta aqui.'
          : 'Seus grupos ou canais onde o bot publica os links já convertidos para o seu ID de afiliada.'}
      </div>

      {/* Lista */}
      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {data.map((g, i, a) => (
            <div key={g.nome} style={{...cfgStyles.row(i === a.length-1), opacity: g.on ? 1 : 0.55}}>
              <div style={{width: 40, height: 40, borderRadius:'50%', background: g.g, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight: 700, fontSize: 12, flexShrink: 0}}>
                {g.nome.replace(/[^A-Za-zÀ-ÿ ]/g,'').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>{g.nome}</div>
                <div style={cfgStyles.rowSub}>{g.m} · {g.last}</div>
              </div>
              <div style={cfgStyles.toggle(g.on)}><div style={cfgStyles.toggleKnob(g.on)}/></div>
            </div>
          ))}
        </div>
      </div>

      {/* Add CTA */}
      <div style={{padding:'18px 16px 24px'}}>
        <button style={{...mobi.btn('primary', true)}}>
          <Icon name="plus" size={14}/> Adicionar {tab === 'origem' ? 'grupo para monitorar' : 'destino'}
        </button>
      </div>
    </MobileFrame>
  );
};

// ═══════════════ CREDENCIAIS ═══════════════
const MobileCreds = () => {
  const lojas = [
    {nome:'Shopee', cor:'#EE4D2D', on:true, id:'sol_almeida_aff'},
    {nome:'Mercado Livre', cor:'#FFE600', on:true, id:'MLB-12903847'},
    {nome:'Amazon', cor:'#FF9900', on:true, id:'solalmeida-20'},
    {nome:'Magalu', cor:'#0086FF', on:true, id:'magazinevoce.com.br/solalmeida'},
    {nome:'AliExpress', cor:'#E62E04', on:false, id:''},
  ];
  return (
    <MobileFrame title="Conversor" active="">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Credenciais</div>
      </div>

      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        Cole seu ID de afiliada de cada plataforma. O bot usa esses dados para reescrever os links.
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {lojas.map((l, i, a) => (
            <div key={l.nome} style={{padding:'14px 16px', borderBottom: i < a.length-1 ? '1px solid var(--line)' : 'none'}}>
              <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: l.on ? 10 : 0}}>
                <div style={cfgStyles.storeBadge(l.cor)}>{l.nome.slice(0,2).toUpperCase()}</div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={cfgStyles.rowTitle}>{l.nome}</div>
                  <div style={cfgStyles.rowSub}>
                    {l.on ? <span style={{color:'var(--success)', fontWeight: 600}}>● ativo</span> : <span>○ não conectado</span>}
                  </div>
                </div>
                {l.on
                  ? <button style={{padding:'6px 12px', borderRadius: 999, background:'transparent', border:'1px solid var(--line)', fontSize: 11.5, fontWeight: 600, color:'var(--ink-soft)', cursor:'pointer'}}>Editar</button>
                  : <button style={{padding:'6px 12px', borderRadius: 999, background:'var(--ink)', color:'white', border:'none', fontSize: 11.5, fontWeight: 600, cursor:'pointer'}}>Conectar</button>}
              </div>
              {l.on && (
                <div style={{fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5, color:'var(--ink-soft)', padding:'8px 12px', background:'var(--bg-soft)', borderRadius: 8, wordBreak:'break-all'}}>
                  {l.id}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{height: 24}}/>
    </MobileFrame>
  );
};

// ═══════════════ PREFERÊNCIAS ═══════════════
const MobilePrefs = () => {
  const items = [
    {label:'Toda nova venda confirmada', sub:'WhatsApp privado', on:true},
    {label:'Resumo diário às 22h', sub:'top do dia, comissões', on:true},
    {label:'Bot desconectado', sub:'alerta urgente', on:true},
    {label:'Limite de posts próximo', sub:'aviso aos 90%', on:false},
    {label:'Novidades do produto', sub:'no máximo 1× por mês', on:false},
  ];
  return (
    <MobileFrame title="Conversor" active="">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Preferências</div>
      </div>

      <div style={cfgStyles.sectionLabel}>Aparência</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          <div style={cfgStyles.row()}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Tema</div>
              <div style={cfgStyles.rowSub}>seguindo o sistema</div>
            </div>
            <span style={{fontSize: 13, color:'var(--ink-soft)'}}>Auto ›</span>
          </div>
          <div style={cfgStyles.row()}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Idioma</div>
            </div>
            <span style={{fontSize: 13, color:'var(--ink-soft)'}}>Português BR ›</span>
          </div>
          <div style={cfgStyles.row(true)}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Fuso horário</div>
            </div>
            <span style={{fontSize: 13, color:'var(--ink-soft)'}}>GMT-3 ›</span>
          </div>
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Notificações no WhatsApp</div>
      <div style={{padding:'0 16px'}}>
        <div style={cfgStyles.card}>
          {items.map((n, i, a) => (
            <div key={i} style={cfgStyles.row(i === a.length-1)}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>{n.label}</div>
                <div style={cfgStyles.rowSub}>{n.sub}</div>
              </div>
              <div style={cfgStyles.toggle(n.on)}><div style={cfgStyles.toggleKnob(n.on)}/></div>
            </div>
          ))}
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Conta</div>
      <div style={{padding:'0 16px 24px'}}>
        <div style={cfgStyles.card}>
          <div style={cfgStyles.row()}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Senha</div>
              <div style={cfgStyles.rowSub}>alterada há 23 dias</div>
            </div>
            <span style={{fontSize: 13, color:'var(--ink-soft)'}}>›</span>
          </div>
          <div style={cfgStyles.row(true)}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>Verificação em 2 etapas</div>
              <div style={cfgStyles.rowSub}>SMS para login novo</div>
            </div>
            <span style={cfgStyles.pill('success')}>● ativada</span>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
};

// ═══════════════ ASSINATURA ═══════════════
const MobileAssinatura = () => (
  <MobileFrame title="Conversor" active="">
    <div style={cfgStyles.pageH}>
      <div style={cfgStyles.pageEyebrow}>Conta</div>
      <div style={cfgStyles.pageTitle}>Assinatura</div>
    </div>

    {/* Plano atual */}
    <div style={cfgStyles.cardWrap}>
      <div style={{...cfgStyles.cardP, background:'var(--ink)', color:'white', position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', right:-40, top:-40, width: 180, height: 180, borderRadius:'50%', background:'var(--accent-strong)', filter:'blur(40px)', opacity:.5}}/>
        <div style={{position:'relative'}}>
          <div style={{fontSize: 11, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.6)'}}>Plano atual</div>
          <div style={{display:'flex', alignItems:'baseline', gap: 8, marginTop: 8}}>
            <span className="serif" style={{fontStyle:'italic', fontSize: 42, lineHeight: 1}}>Pro</span>
            <span style={{opacity:.7, fontSize: 13}}>R$ 39/mês</span>
          </div>
          <div style={{fontSize: 12, opacity:.7, marginTop: 8}}>renova em 14 jun · cartão final 4242</div>
          <button style={{marginTop: 16, padding:'10px 16px', borderRadius: 999, background:'var(--accent-2)', color:'var(--ink)', border:'none', fontWeight: 600, fontSize: 13, cursor:'pointer'}}>Mudar plano</button>
        </div>
      </div>
    </div>

    {/* Uso */}
    <div style={cfgStyles.sectionLabel}>Uso este mês</div>
    <div style={{padding:'0 16px'}}>
      <div style={cfgStyles.card}>
        {[
          {l:'Grupos ativos', n:'8', m:'∞ ilimitados'},
          {l:'Posts no mês', n:'2.847', m:'de 5.000'},
          {l:'Lojas conectadas', n:'4', m:'de 5'},
        ].map((s, i, a) => (
          <div key={s.l} style={cfgStyles.row(i === a.length-1)}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>{s.l}</div>
              <div style={cfgStyles.rowSub}>{s.m}</div>
            </div>
            <div className="serif" style={{fontStyle:'italic', fontSize: 22, color:'var(--ink)', lineHeight: 1}}>{s.n}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Faturas */}
    <div style={cfgStyles.sectionLabel}>Últimas faturas</div>
    <div style={{padding:'0 16px'}}>
      <div style={cfgStyles.card}>
        {[
          {d:'14 abr 2026', v:'R$ 39,00'},
          {d:'14 mar 2026', v:'R$ 39,00'},
          {d:'14 fev 2026', v:'R$ 39,00'},
        ].map((f, i, a) => (
          <div key={f.d} style={cfgStyles.row(i === a.length-1)}>
            <div style={cfgStyles.rowMain}>
              <div style={cfgStyles.rowTitle}>{f.d}</div>
              <div style={cfgStyles.rowSub}>{f.v}</div>
            </div>
            <span style={cfgStyles.pill('success')}>paga</span>
            <Icon name="arrow" size={14}/>
          </div>
        ))}
      </div>
    </div>

    {/* Pagamento */}
    <div style={cfgStyles.sectionLabel}>Forma de pagamento</div>
    <div style={{padding:'0 16px 24px'}}>
      <div style={cfgStyles.card}>
        <div style={cfgStyles.row(true)}>
          <div style={{width: 44, height: 30, borderRadius: 6, background:'linear-gradient(135deg,#1A1F71,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize: 10, fontWeight: 700}}>VISA</div>
          <div style={cfgStyles.rowMain}>
            <div style={cfgStyles.rowTitle}>•••• 4242</div>
            <div style={cfgStyles.rowSub}>vence 08/28</div>
          </div>
          <button style={{padding:'6px 12px', borderRadius: 999, background:'transparent', border:'1px solid var(--line)', fontSize: 11.5, fontWeight: 600, color:'var(--ink)', cursor:'pointer'}}>Trocar</button>
        </div>
      </div>
    </div>
  </MobileFrame>
);

// ═══════════════ TUTORIAL / SUPORTE ═══════════════
const MobileTutorial = () => {
  const passos = [
    {n:'01', t:'Como conectar seu WhatsApp', m:'2 min · vídeo', done:true},
    {n:'02', t:'Adicionar grupos para monitorar', m:'1 min · vídeo', done:true},
    {n:'03', t:'Cadastrar IDs de afiliada', m:'3 min · texto', done:true},
    {n:'04', t:'Criar sua primeira regra', m:'4 min · vídeo', done:false, current:true},
    {n:'05', t:'Personalizar mensagens promocionais', m:'3 min · texto', done:false},
    {n:'06', t:'Entender o painel de logs', m:'2 min · vídeo', done:false},
  ];
  return (
    <MobileFrame title="Conversor" active="">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Tutorial</div>
      </div>

      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        6 passos para você dominar o BOTinho. Cada um leva menos de 5 minutos.
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, padding: 14}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
            <div style={{fontSize: 13, fontWeight: 600}}>Seu progresso</div>
            <div style={{fontSize: 12, color:'var(--accent-strong)', fontWeight: 600}}>3/6</div>
          </div>
          <div style={{height: 6, background:'var(--bg-soft)', borderRadius: 999, overflow:'hidden'}}>
            <div style={{width:'50%', height:'100%', background:'var(--accent-strong)'}}/>
          </div>
        </div>
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {passos.map((p, i, a) => (
            <div key={p.n} style={{
              ...cfgStyles.row(i === a.length-1),
              background: p.current ? 'color-mix(in oklab, var(--accent) 12%, var(--surface))' : 'transparent',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius:'50%',
                background: p.done ? 'var(--success)' : p.current ? 'var(--ink)' : 'var(--bg-soft)',
                color: p.done || p.current ? 'white' : 'var(--ink-soft)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontWeight: 600, fontSize: 12,
                fontFamily: p.done || p.current ? 'inherit' : "'JetBrains Mono', monospace",
                flexShrink: 0,
              }}>
                {p.done ? <Icon name="check" size={15} stroke={3}/> : p.n}
              </div>
              <div style={cfgStyles.rowMain}>
                <div style={{...cfgStyles.rowTitle, textDecoration: p.done ? 'line-through' : 'none', color: p.done ? 'var(--ink-soft)' : 'var(--ink)'}}>{p.t}</div>
                <div style={cfgStyles.rowSub}>{p.m}</div>
              </div>
              {p.current && <span style={cfgStyles.pill('success')}>continuar</span>}
              <Icon name="arrow" size={14}/>
            </div>
          ))}
        </div>
      </div>

      {/* Suporte */}
      <div style={cfgStyles.sectionLabel}>Precisa de ajuda?</div>
      <div style={{padding:'0 16px 24px'}}>
        <div style={{...cfgStyles.card, padding: 16, display:'flex', alignItems:'center', gap: 14}}>
          <div style={{width: 44, height: 44, borderRadius: 12, background:'color-mix(in oklab, var(--success) 18%, var(--surface))', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--success)', flexShrink: 0}}>
            <Icon name="whatsapp" size={20}/>
          </div>
          <div style={{flex: 1}}>
            <div style={{fontSize: 13.5, fontWeight: 600, color:'var(--ink)'}}>Falar com a gente</div>
            <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>resposta em minutos · seg–sex 8h–20h</div>
          </div>
          <Icon name="arrow" size={14}/>
        </div>
      </div>
    </MobileFrame>
  );
};

Object.assign(window, { MobileWhatsApp, MobileGroups, MobileCreds, MobilePrefs, MobileAssinatura, MobileTutorial });
