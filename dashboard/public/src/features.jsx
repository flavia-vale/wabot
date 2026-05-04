const featStyles = {
  head: { textAlign:'center', marginBottom: 64 },
  h2: { fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.05, maxWidth: 760, margin: '0 auto 16px' },
  sub: { fontSize: 17, color:'var(--ink-soft)', maxWidth: 560, margin: '0 auto', lineHeight: 1.55 },
  grid: {
    display:'grid',
    gridTemplateColumns:'repeat(12, 1fr)',
    gap: 20,
  },
  card: (cols, accent) => ({
    gridColumn: `span ${cols}`,
    background: accent ? 'color-mix(in oklab, var(--accent) 22%, var(--surface))' : 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 24,
    padding: 32,
    minHeight: 260,
    display:'flex', flexDirection:'column',
  }),
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    background: 'var(--bg-soft)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'var(--accent-strong)',
    marginBottom: 20,
  },
  cardTitle: { fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing:'-0.01em' },
  cardBody: { fontSize: 14.5, lineHeight: 1.55, color:'var(--ink-soft)' },
  bigStat: { fontFamily:"'Instrument Serif', serif", fontStyle:'italic', fontSize: 88, lineHeight: 1, color:'var(--accent-strong)', letterSpacing:'-0.04em' },
  storeRow: { display:'flex', flexWrap:'wrap', gap: 10, marginTop: 20 },
  store: { padding: '8px 14px', borderRadius: 999, background:'var(--bg-soft)', border:'1px solid var(--line)', fontSize: 13, fontWeight: 500, color:'var(--ink)' },
};

const Features = () => (
  <section id="features" data-screen-label="04 Features">
    <div className="wrap">
      <div style={featStyles.head}>
        <span className="pill"><span className="dot"/>Recursos</span>
        <h2 style={{...featStyles.h2, marginTop: 16}}>Pensado para afiliada que <span className="serif" style={{fontStyle:'italic'}}>quer escalar</span> sem ficar copiando link.</h2>
        <p style={featStyles.sub}>Você aponta os grupos de promoção que quer monitorar e o seu grupo de destino. O resto é com a gente.</p>
      </div>

      <div style={featStyles.grid}>
        <div style={featStyles.card(7, true)}>
          <div style={featStyles.iconBox}><Icon name="bolt" size={22}/></div>
          <div style={featStyles.cardTitle}>Detecção em menos de 1 segundo</div>
          <p style={featStyles.cardBody}>O bot escuta seus grupos em tempo real. Quando aparece um link de loja parceira, ele já dispara a versão sua antes da mensagem original sair de vista.</p>
          <div style={{marginTop: 'auto', paddingTop: 24, display:'flex', gap: 32, alignItems:'baseline'}}>
            <div>
              <div style={featStyles.bigStat}>0,8s</div>
              <div style={{fontSize: 12, color:'var(--ink-soft)', marginTop: 4}}>tempo médio de resposta</div>
            </div>
            <div>
              <div style={featStyles.bigStat}>24/7</div>
              <div style={{fontSize: 12, color:'var(--ink-soft)', marginTop: 4}}>sem precisar do seu celular ligado</div>
            </div>
          </div>
        </div>

        <div style={featStyles.card(5)}>
          <div style={featStyles.iconBox}><Icon name="link" size={22}/></div>
          <div style={featStyles.cardTitle}>5 lojas, mais chegando</div>
          <p style={featStyles.cardBody}>Suporta as principais plataformas que mais convertem no público brasileiro.</p>
          <div style={featStyles.storeRow}>
            <span style={featStyles.store}>Shopee</span>
            <span style={featStyles.store}>Mercado Livre</span>
            <span style={featStyles.store}>Amazon</span>
            <span style={featStyles.store}>Magalu</span>
            <span style={featStyles.store}>AliExpress</span>
            <span style={{...featStyles.store, color:'var(--ink-soft)', borderStyle:'dashed'}}>+ Americanas em breve</span>
          </div>
        </div>

        <div style={featStyles.card(4)}>
          <div style={featStyles.iconBox}><Icon name="chat" size={22}/></div>
          <div style={featStyles.cardTitle}>Texto promocional do seu jeito</div>
          <p style={featStyles.cardBody}>Modelos prontos por categoria (moda, casa, eletrônicos) ou escreva o seu. O bot mantém sua voz e suas hashtags.</p>
        </div>

        <div style={featStyles.card(4)}>
          <div style={featStyles.iconBox}><Icon name="users" size={22}/></div>
          <div style={featStyles.cardTitle}>Monitore quantos grupos quiser</div>
          <p style={featStyles.cardBody}>Aponte 1, 5, 20 grupos de promoção como fontes. Defina para qual dos seus grupos cada link vai (moda → grupo A, eletrônicos → grupo B).</p>
        </div>

        <div style={featStyles.card(4)}>
          <div style={featStyles.iconBox}><Icon name="chart" size={22}/></div>
          <div style={featStyles.cardTitle}>Painel com o que rendeu</div>
          <p style={featStyles.cardBody}>Veja cliques, conversões e comissões por grupo. Sabe qual achadinho bombou e qual precisa repostar.</p>
        </div>

        <div style={featStyles.card(6)}>
          <div style={featStyles.iconBox}><Icon name="shield" size={22}/></div>
          <div style={featStyles.cardTitle}>Seguro e dentro das regras</div>
          <p style={featStyles.cardBody}>Conexão criptografada, sessão isolada por usuária, e respeita os limites do WhatsApp para nunca colocar seu número em risco. Você pode desconectar a qualquer momento.</p>
        </div>

        <div style={featStyles.card(6, true)}>
          <div style={featStyles.iconBox}><Icon name="sparkles" size={22}/></div>
          <div style={featStyles.cardTitle}>Modo "achadinho do dia"</div>
          <p style={featStyles.cardBody}>Programe um horário fixo (ex: 9h da manhã) e o bot escolhe o produto com melhor margem dos últimos dias e reposta como destaque.</p>
        </div>
      </div>
    </div>
  </section>
);

window.Features = Features;
