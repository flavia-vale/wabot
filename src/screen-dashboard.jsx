// DASHBOARD — comissões, conversões, atividade do bot
const ScreenDashboard = () => {
  const stats = [
    {label:'Comissão hoje', value:'R$ 184,50', delta:'+24%', tone:'success'},
    {label:'Conversões 24h', value:'127', delta:'+8', tone:'success'},
    {label:'Cliques', value:'2.847', delta:'+312', tone:'success'},
    {label:'Taxa de conversão', value:'4,4%', delta:'+0,3pp', tone:'success'},
  ];

  // Sparkline data (mock, normalized 0-1)
  const series = [0.2, 0.35, 0.28, 0.5, 0.45, 0.62, 0.55, 0.78, 0.7, 0.85, 0.9, 0.95];

  const recentes = [
    {hora:'14:48', origem:'Promoções Brasil 🔥', loja:'Shopee', produto:'Sandália Bege Verão', destino:'Achados da Sol', comissao:'R$ 4,79', status:'venda'},
    {hora:'14:23', origem:'Cupons & Cashback BR', loja:'Mercado Livre', produto:'Air Fryer 4L Mondial', destino:'Sol · Tech & Casa', comissao:'R$ 12,40', status:'venda'},
    {hora:'13:51', origem:'Promoções Brasil 🔥', loja:'Amazon', produto:'Kit Maquiagem Ruby Rose', destino:'Achados da Sol', comissao:'R$ 0', status:'clique'},
    {hora:'13:32', origem:'Promoções de TI', loja:'Magalu', produto:'Mouse Logitech M170', destino:'Sol · Tech & Casa', comissao:'R$ 2,80', status:'venda'},
    {hora:'12:58', origem:'Cupons & Cashback BR', loja:'Shopee', produto:'Vestido Floral Midi', destino:'Achados da Sol', comissao:'R$ 0', status:'enviado'},
    {hora:'12:14', origem:'Promoções Brasil 🔥', loja:'Shopee', produto:'Tênis Casual Branco', destino:'Achados da Sol', comissao:'R$ 6,10', status:'venda'},
  ];

  const StatusPill = ({status}) => {
    const map = {
      venda: {bg:'color-mix(in oklab, var(--success) 18%, var(--surface))', color:'var(--success)', label:'venda', icon:'check'},
      clique: {bg:'color-mix(in oklab, var(--accent-2) 60%, var(--surface))', color:'var(--ink)', label:'clique', icon:'sparkles'},
      enviado: {bg:'var(--bg-soft)', color:'var(--ink-soft)', label:'enviado', icon:'arrow'},
    };
    const m = map[status];
    return (
      <span style={{display:'inline-flex', alignItems:'center', gap: 5, fontSize: 11.5, fontWeight: 600, padding:'3px 9px', borderRadius: 999, background: m.bg, color: m.color, border:'1px solid var(--line)'}}>
        <Icon name={m.icon} size={11}/> {m.label}
      </span>
    );
  };

  return (
    <AppShell active="dashboard" title="Painel" sub="Bom dia, Sol — segunda, 4 de maio"
      action={<button style={shellStyles.btn('ghost')}>Hoje · 4 mai</button>}
    >
      {/* Hero stat */}
      <div style={{...shellStyles.card, marginBottom: 20, padding: 28, background:'var(--ink)', color:'white', borderColor:'var(--ink)', position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', right: -40, top: -40, width: 220, height: 220, borderRadius:'50%', background:'var(--accent-strong)', filter:'blur(60px)', opacity: .5}}/>
        <div style={{position:'absolute', right: 80, bottom: -60, width: 180, height: 180, borderRadius:'50%', background:'var(--accent-2)', filter:'blur(60px)', opacity: .4}}/>
        <div style={{position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap: 32}}>
          <div>
            <div style={{fontSize: 12, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.6)', marginBottom: 12}}>Comissão acumulada · maio</div>
            <div style={{display:'flex', alignItems:'baseline', gap: 8}}>
              <span style={{fontSize: 18, opacity: .7}}>R$</span>
              <span className="serif" style={{fontStyle:'italic', fontSize: 72, lineHeight: 1, letterSpacing:'-0.04em'}}>2.847</span>
              <span style={{fontSize: 24, opacity: .7}}>,30</span>
            </div>
            <div style={{marginTop: 12, display:'flex', alignItems:'center', gap: 12, fontSize: 13}}>
              <span style={{color:'var(--accent-2)'}}>↑ 38% vs. abril</span>
              <span style={{opacity: .5}}>·</span>
              <span style={{opacity: .7}}>meta R$ 5.000 · 57%</span>
            </div>
          </div>
          {/* Sparkline */}
          <svg viewBox="0 0 240 80" width="240" height="80" style={{flexShrink:0}}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(217,207,234,0.6)"/>
                <stop offset="100%" stopColor="rgba(217,207,234,0)"/>
              </linearGradient>
            </defs>
            <path d={`M 0 ${80 - series[0]*70} ${series.map((v,i)=>`L ${(i*240)/(series.length-1)} ${80 - v*70}`).join(' ')} L 240 80 L 0 80 Z`} fill="url(#grad)"/>
            <path d={`M 0 ${80 - series[0]*70} ${series.map((v,i)=>`L ${(i*240)/(series.length-1)} ${80 - v*70}`).join(' ')}`} fill="none" stroke="#D9CFEA" strokeWidth="2"/>
            {series.map((v,i) => (
              <circle key={i} cx={(i*240)/(series.length-1)} cy={80 - v*70} r={i===series.length-1?4:0} fill="white"/>
            ))}
          </svg>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 16, marginBottom: 24}}>
        {stats.map(s => (
          <div key={s.label} style={shellStyles.card}>
            <div style={{fontSize: 12, color:'var(--ink-soft)', marginBottom: 8}}>{s.label}</div>
            <div className="serif" style={{fontStyle:'italic', fontSize: 32, lineHeight: 1, letterSpacing:'-0.02em'}}>{s.value}</div>
            <div style={{fontSize: 12, color:'var(--success)', marginTop: 8, fontWeight: 500}}>{s.delta} vs ontem</div>
          </div>
        ))}
      </div>

      {/* Activity feed */}
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap: 20}}>
        <div style={shellStyles.card}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 18}}>
            <div>
              <div style={{fontSize: 16, fontWeight: 600}}>Atividade do bot</div>
              <div style={{fontSize: 12.5, color:'var(--ink-soft)', marginTop: 2}}>últimas conversões e cliques</div>
            </div>
            <button style={shellStyles.btn('ghost')}>Ver tudo</button>
          </div>
          <div>
            {recentes.map((r, i) => (
              <div key={i} style={{
                display:'grid', gridTemplateColumns:'auto 1fr auto auto', gap: 16,
                padding:'12px 4px',
                borderBottom: i < recentes.length-1 ? '1px solid var(--line)' : 'none',
                alignItems:'center',
              }}>
                <div style={{fontSize: 11.5, color:'var(--ink-faint)', fontFamily:"'JetBrains Mono', monospace"}}>{r.hora}</div>
                <div>
                  <div style={{fontSize: 13.5, fontWeight: 500, marginBottom: 2}}>{r.produto}</div>
                  <div style={{fontSize: 11.5, color:'var(--ink-soft)'}}>
                    {r.origem} · <b style={{fontWeight:500}}>{r.loja}</b> → {r.destino}
                  </div>
                </div>
                <div style={{fontSize: 13, fontWeight: 600, color: r.comissao === 'R$ 0' ? 'var(--ink-faint)' : 'var(--success)', minWidth: 64, textAlign:'right'}}>
                  {r.comissao !== 'R$ 0' && '+'}{r.comissao}
                </div>
                <StatusPill status={r.status}/>
              </div>
            ))}
          </div>
        </div>

        {/* Top performers */}
        <div style={{...shellStyles.card}}>
          <div style={{fontSize: 16, fontWeight: 600, marginBottom: 4}}>Top do mês</div>
          <div style={{fontSize: 12.5, color:'var(--ink-soft)', marginBottom: 18}}>produtos que mais venderam</div>
          {[
            {n:'Air Fryer 4L Mondial', loja:'ML', vendas:18, total:'R$ 223,20'},
            {n:'Sandália Bege Verão', loja:'Shopee', vendas:24, total:'R$ 114,96'},
            {n:'Kit Maquiagem RR', loja:'Amazon', vendas:9, total:'R$ 84,30'},
            {n:'Tênis Casual Branco', loja:'Shopee', vendas:11, total:'R$ 67,10'},
          ].map((p, i) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap: 12, padding:'10px 0', borderBottom: i<3 ? '1px solid var(--line)' : 'none'}}>
              <div className="serif" style={{fontStyle:'italic', fontSize: 22, color:'var(--accent-strong)', width: 24, lineHeight: 1}}>{i+1}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize: 13, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.n}</div>
                <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>{p.loja} · {p.vendas} vendas</div>
              </div>
              <div style={{fontSize: 13, fontWeight: 600, color:'var(--success)'}}>{p.total}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

window.ScreenDashboard = ScreenDashboard;
