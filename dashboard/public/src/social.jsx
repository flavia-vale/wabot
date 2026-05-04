const socStyles = {
  head: { textAlign:'center', marginBottom: 56 },
  h2: { fontSize: 'clamp(32px, 3.5vw, 48px)', lineHeight: 1.1 },
  grid: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 20 },
  card: {
    background:'var(--surface)',
    border:'1px solid var(--line)',
    borderRadius: 24,
    padding: 28,
    display:'flex', flexDirection:'column',
    minHeight: 240,
  },
  stars: { display:'flex', gap: 2, color:'var(--accent-strong)', marginBottom: 14 },
  quote: { fontSize: 16, lineHeight: 1.55, color:'var(--ink)', marginBottom: 24, fontFamily:"'Instrument Serif', serif", fontStyle:'italic' },
  who: { display:'flex', alignItems:'center', gap: 12, marginTop:'auto' },
  ava: (gradient) => ({
    width: 40, height: 40, borderRadius:'50%',
    background: gradient,
    flexShrink: 0,
  }),
  name: { fontSize: 14, fontWeight: 600, color:'var(--ink)' },
  role: { fontSize: 12.5, color:'var(--ink-soft)', marginTop: 2 },
  numbers: {
    display:'grid', gridTemplateColumns:'repeat(4,1fr)',
    background:'color-mix(in oklab, var(--accent) 18%, var(--surface))',
    borderRadius: 24,
    padding: '32px 16px',
    marginTop: 32,
    border:'1px solid var(--line)',
  },
  numItem: { textAlign:'center', borderRight:'1px solid var(--line)', padding: '8px 16px' },
  numBig: { fontFamily:"'Instrument Serif', serif", fontStyle:'italic', fontSize: 48, lineHeight: 1, color:'var(--ink)' },
  numLabel: { fontSize: 12.5, color:'var(--ink-soft)', marginTop: 8 },
};

const Social = () => {
  const tt = [
    {q: 'Eu mandava os links na mão para 4 grupos diferentes. Agora durmo e acordo com comissão pingando.', name: 'Sol Almeida', role: 'Afiliada Shopee · 6 grupos', g: 'linear-gradient(135deg,#F4D9E0,#A78BFA)'},
    {q: 'O texto que ele monta soa igual eu falando. As meninas do grupo nem percebem que é bot.', name: 'Mariana Costa', role: 'Influencer micro · ML + Amazon', g: 'linear-gradient(135deg,#C8E6D8,#7CC9A9)'},
    {q: 'Em duas semanas paguei a assinatura do ano. Sério, era dinheiro que eu deixava na mesa.', name: 'Rafa Pires', role: 'Mãe afiliada · Shopee', g: 'linear-gradient(135deg,#F4E5D5,#E8A488)'},
  ];
  return (
    <section data-screen-label="05 Prova social">
      <div className="wrap">
        <div style={socStyles.head}>
          <span className="pill"><span className="dot"/>Quem já usa</span>
          <h2 style={{...socStyles.h2, marginTop: 16}}>Mais de <span className="serif" style={{fontStyle:'italic', color:'var(--accent-strong)'}}>1.200 afiliadas</span> deixaram o copia-e-cola.</h2>
        </div>
        <div style={socStyles.grid}>
          {tt.map((t,i) => (
            <div key={i} style={socStyles.card}>
              <div style={socStyles.stars}>
                {[...Array(5)].map((_,j) => <Icon key={j} name="star" size={16}/>)}
              </div>
              <p style={socStyles.quote}>"{t.q}"</p>
              <div style={socStyles.who}>
                <div style={socStyles.ava(t.g)}/>
                <div>
                  <div style={socStyles.name}>{t.name}</div>
                  <div style={socStyles.role}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={socStyles.numbers}>
          {[
            ['1.200+','afiliadas ativas'],
            ['R$ 4,2M','comissões geradas'],
            ['380k','links convertidos'],
            ['4,9 ★','nota das clientes'],
          ].map(([n,l],i,a)=> (
            <div key={n} style={{...socStyles.numItem, borderRight: i===a.length-1?'none':socStyles.numItem.borderRight}}>
              <div style={socStyles.numBig}>{n}</div>
              <div style={socStyles.numLabel}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

window.Social = Social;
