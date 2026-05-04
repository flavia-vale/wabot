const heroStyles = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '24px 0'
  },
  navLinks: { display: 'flex', gap: 32, fontSize: 14, color: 'var(--ink-soft)' },
  navLink: { color: 'var(--ink-soft)', textDecoration: 'none', cursor: 'pointer' },
  logo: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 17, color: 'var(--ink)' },
  logoMark: {
    width: 32, height: 32, borderRadius: 10,
    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 14,
    boxShadow: '0 4px 10px -2px color-mix(in oklab, var(--accent-strong) 40%, transparent)'
  },
  hero: {
    display: 'grid', gridTemplateColumns: '1fr 0.85fr', gap: 56, alignItems: 'center',
    paddingTop: 40, paddingBottom: 80
  },
  eyebrow: { display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  h1: { fontSize: 'clamp(44px, 5.5vw, 76px)', lineHeight: 1.02, marginBottom: 20 },
  sub: { fontSize: 18, lineHeight: 1.55, color: 'var(--ink-soft)', maxWidth: 520, marginBottom: 32 },
  cta: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  trust: { display: 'flex', gap: 24, marginTop: 40, alignItems: 'center', flexWrap: 'wrap', color: 'var(--ink-soft)', fontSize: 13.5 },
  trustItem: { display: 'flex', alignItems: 'center', gap: 8 },
  mockWrap: { display: 'flex', justifyContent: 'center', position: 'relative' },
  decor: {
    position: 'absolute', borderRadius: '50%', filter: 'blur(40px)', opacity: .55, pointerEvents: 'none'
  },
  floatNote: {
    position: 'absolute',
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 16,
    padding: '14px 18px',
    boxShadow: 'var(--shadow-soft)',
    fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 10,
    zIndex: 2
  }
};

const Nav = () =>
<nav style={heroStyles.nav}>
    <div style={heroStyles.logo}>
      <div style={heroStyles.logoMark}>b</div>
      <span>bot conversor<span className="serif" style={{ fontStyle: 'italic', marginLeft: 6, color: 'var(--accent-strong)' }}>.afiliados</span></span>
    </div>
    <div style={heroStyles.navLinks}>
      <a style={heroStyles.navLink} href="#como">Como funciona</a>
      <a style={heroStyles.navLink} href="#features">Recursos</a>
      <a style={heroStyles.navLink} href="#planos">Planos</a>
      <a style={heroStyles.navLink} href="#faq">Perguntas</a>
    </div>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <a className="btn btn-ghost" href="#login" style={{ padding: '10px 18px', fontSize: 14 }}>Entrar</a>
      <a className="btn btn-primary" href="#planos" style={{ padding: '10px 18px', fontSize: 14 }}>Começar grátis</a>
    </div>
  </nav>;


const Hero = ({ tone }) => {
  const headline = tone === 'direto' ?
  <>Promoção dos outros,<br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>comissão sua.</span></> :
  tone === 'animado' ?
  <>Os grupos postam.<br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>Você fatura.</span> 💜</> :
  <>Promoções de outros grupos<br />viram <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>vendas no seu.</span></>;

  const sub = tone === 'direto' ?
  'Você escolhe os grupos de promoção que quer monitorar. O bot pega cada link da Shopee, ML ou Amazon, troca pelo seu código de afiliada e posta no seu grupo de achadinhos. Em segundos.' :
  tone === 'animado' ?
  'Aqueles grupos lotados de promoção que você acompanha? O bot fica de olho neles 24h. Cada link vira o seu link de afiliada e cai direto no seu grupo. ✨' :
  'Você indica os grupos que quer monitorar (de promoções, ofertas, achadinhos). O bot detecta cada link da Shopee, ML ou Amazon, converte para o seu código de afiliada e reposta no seu próprio grupo de clientes.';

  return (
    <div className="wrap" style={{ position: 'relative' }}>
      <Nav />
      <div style={{ ...heroStyles.decor, width: 380, height: 380, background: 'var(--accent-2)', top: -40, right: -80 }} />
      <div style={{ ...heroStyles.decor, width: 280, height: 280, background: 'var(--accent-3)', bottom: -60, left: -40 }} />

      <header style={heroStyles.hero}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={heroStyles.eyebrow}>
            <span className="pill"><span className="dot" />Experimente grátis!</span>
          </div>
          <h1 style={heroStyles.h1}>{headline}</h1>
          <p style={heroStyles.sub}>{sub}</p>
          <div style={heroStyles.cta}>
            <a className="btn btn-accent" href="#planos">
              Conectar meu WhatsApp <Icon name="arrow" size={16} />
            </a>
            <a className="btn btn-ghost" href="#como">Ver como funciona</a>
          </div>
          <div style={heroStyles.trust}>
            <div style={heroStyles.trustItem}><Icon name="check" size={16} /> Sem cartão para testar</div>
            <div style={heroStyles.trustItem}><Icon name="check" size={16} /> Configura em 4 minutos</div>
            <div style={heroStyles.trustItem}><Icon name="check" size={16} /> Cancela quando quiser</div>
          </div>
        </div>

        <div style={heroStyles.mockWrap}>
          <div style={{ ...heroStyles.floatNote, top: 24, left: -40, transform: 'rotate(-3deg)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-strong)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>Link interceptado</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>de "Promoções Brasil" · 0,3s</div>
            </div>
          </div>
          <div style={{ ...heroStyles.floatNote, bottom: 80, right: -50, transform: 'rotate(2deg)', background: 'color-mix(in oklab, var(--accent) 18%, var(--surface))' }}>
            <Icon name="chart" size={18} />
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>Comissões hoje</div>
              <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1 }}>R$ 184,50</div>
            </div>
          </div>
          <WhatsAppMockup />
        </div>
      </header>
    </div>);

};

window.Hero = Hero;