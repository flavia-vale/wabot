const priceStyles = {
  head: { textAlign:'center', marginBottom: 56 },
  h2: { fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.05 },
  sub: { fontSize: 17, color:'var(--ink-soft)', maxWidth: 520, margin:'16px auto 0', lineHeight: 1.55 },
  grid: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 20, alignItems:'stretch' },
  card: (highlight) => ({
    background: highlight ? 'var(--ink)' : 'var(--surface)',
    color: highlight ? 'var(--surface)' : 'var(--ink)',
    border: '1px solid ' + (highlight ? 'var(--ink)' : 'var(--line)'),
    borderRadius: 28,
    padding: 36,
    display:'flex', flexDirection:'column',
    position:'relative',
    boxShadow: highlight ? 'var(--shadow)' : 'none',
  }),
  badge: {
    position:'absolute', top: -12, left: 36,
    background: 'var(--accent-2)',
    color: 'var(--ink)',
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 12, fontWeight: 600,
    border:'1px solid var(--line)',
    whiteSpace: 'nowrap',
  },
  planName: { fontSize: 14, fontWeight: 600, textTransform:'uppercase', letterSpacing: '0.08em', color:'var(--accent-strong)', marginBottom: 16 },
  price: (h) => ({ display:'flex', alignItems:'baseline', gap: 6, marginBottom: 8, color: h ? 'var(--surface)':'var(--ink)' }),
  priceBig: { fontFamily:"'Instrument Serif', serif", fontStyle:'italic', fontSize: 64, lineHeight: 1, letterSpacing:'-0.03em' },
  priceUnit: { fontSize: 14, opacity: 0.7 },
  desc: (h) => ({ fontSize: 14.5, lineHeight: 1.55, color: h ? 'rgba(255,255,255,0.7)' : 'var(--ink-soft)', marginBottom: 24, minHeight: 50 }),
  list: { listStyle: 'none', padding: 0, margin: '0 0 28px', display:'flex', flexDirection:'column', gap: 12, flex: 1 },
  li: (h) => ({ display:'flex', alignItems:'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, color: h ? 'rgba(255,255,255,0.85)' : 'var(--ink)' }),
  liIcon: (h) => ({ flexShrink: 0, marginTop: 2, color: h ? 'var(--accent-2)' : 'var(--accent-strong)' }),
  cta: (h) => ({
    display:'block', textAlign:'center',
    padding:'14px 22px', borderRadius: 999,
    fontWeight: 600, fontSize: 15,
    textDecoration:'none',
    background: h ? 'var(--accent-2)' : 'var(--ink)',
    color: h ? 'var(--ink)' : 'var(--surface)',
    border:'1px solid transparent',
    cursor:'pointer',
  }),
  toggle: {
    display:'inline-flex', padding: 4, background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 999, marginTop: 24,
  },
  toggleBtn: (active) => ({
    padding: '8px 18px', borderRadius: 999,
    border:'none', cursor:'pointer',
    fontSize: 13.5, fontWeight: 500,
    background: active ? 'var(--accent-strong)' : 'transparent',
    color: active ? 'white' : 'var(--ink-soft)',
  }),
};

const Pricing = () => {
  const [yr, setYr] = React.useState(false);

  const plans = [
    {
      name: 'Início',
      mo: 29, yr: 19,
      desc: 'Para quem está testando o jogo de afiliada.',
      cta: 'Começar grátis',
      features: ['Até 2 grupos do WhatsApp','Lojas: Shopee + Mercado Livre','Painel básico de comissões','Texto promocional padrão','Suporte por e-mail'],
    },
    {
      name: 'Pro',
      mo: 59, yr: 39,
      desc: 'Para quem já tem grupos rodando e quer escala.',
      cta: 'Assinar Pro',
      highlight: true,
      features: ['Grupos ilimitados','Todas as lojas suportadas','Painel completo + relatórios','Texto promocional editável (com IA)','Modo "achadinho do dia"','Regras por grupo','Suporte por WhatsApp'],
    },
    {
      name: 'Agência',
      mo: 149, yr: 99,
      desc: 'Para quem gerencia afiliadas ou várias contas.',
      cta: 'Falar com a gente',
      features: ['Tudo do Pro','Até 5 contas WhatsApp','Painel multi-conta','API para integração','Onboarding 1:1','Gerente de conta dedicado'],
    },
  ];

  return (
    <section id="planos" data-screen-label="06 Planos">
      <div className="wrap">
        <div style={priceStyles.head}>
          <span className="pill"><span className="dot"/>Planos</span>
          <h2 style={{...priceStyles.h2, marginTop: 16}}>Preço <span className="serif" style={{fontStyle:'italic', color:'var(--accent-strong)'}}>menor que uma comissão</span> por mês.</h2>
          <p style={priceStyles.sub}>Cancele a qualquer momento. Os primeiros 30 dias são por nossa conta para você testar com seus grupos reais.</p>
          <div style={priceStyles.toggle}>
            <button style={priceStyles.toggleBtn(!yr)} onClick={()=>setYr(false)}>Mensal</button>
            <button style={priceStyles.toggleBtn(yr)} onClick={()=>setYr(true)}>Anual · -34%</button>
          </div>
        </div>

        <div style={priceStyles.grid}>
          {plans.map(p => (
            <div key={p.name} style={priceStyles.card(p.highlight)}>
              {p.highlight && <div style={priceStyles.badge}>Mais escolhido</div>}
              <div style={priceStyles.planName}>{p.name}</div>
              <div style={priceStyles.price(p.highlight)}>
                <span style={{fontSize: 18}}>R$</span>
                <span style={priceStyles.priceBig}>{yr ? p.yr : p.mo}</span>
                <span style={priceStyles.priceUnit}>/mês</span>
              </div>
              <p style={priceStyles.desc(p.highlight)}>{p.desc}</p>
              <ul style={priceStyles.list}>
                {p.features.map(f => (
                  <li key={f} style={priceStyles.li(p.highlight)}>
                    <span style={priceStyles.liIcon(p.highlight)}><Icon name="check" size={16}/></span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a style={priceStyles.cta(p.highlight)} href="#">{p.cta}</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

window.Pricing = Pricing;
