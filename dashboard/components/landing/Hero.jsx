import Link from 'next/link';
import { Icon } from './Icon';
import { WhatsAppMockup } from './WhatsAppMockup';
import { buildRegisterHref } from '@/lib/marketing-attribution';

const s = {
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 0' },
  navLinks: { display: 'flex', gap: 32, fontSize: 14, color: 'var(--ink-soft)' },
  navLink: { color: 'var(--ink-soft)', textDecoration: 'none', cursor: 'pointer' },
  logo: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 17, color: 'var(--ink)' },
  logoMark: {
    width: 32, height: 32, borderRadius: 10,
    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 14,
    boxShadow: '0 4px 10px -2px color-mix(in oklab, var(--accent-strong) 40%, transparent)',
  },
  hero: {
    display: 'grid', gridTemplateColumns: '1fr 0.85fr', gap: 56, alignItems: 'center',
    paddingTop: 40, paddingBottom: 80,
  },
  eyebrow: { display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  h1: { fontSize: 'clamp(44px, 5.5vw, 76px)', lineHeight: 1.02, marginBottom: 20 },
  sub: { fontSize: 18, lineHeight: 1.55, color: 'var(--ink-soft)', maxWidth: 520, marginBottom: 32 },
  cta: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  trust: { display: 'flex', gap: 24, marginTop: 40, alignItems: 'center', flexWrap: 'wrap', color: 'var(--ink-soft)', fontSize: 13.5 },
  trustItem: { display: 'flex', alignItems: 'center', gap: 8 },
  mockWrap: { display: 'flex', justifyContent: 'center', position: 'relative' },
  decor: { position: 'absolute', borderRadius: '50%', filter: 'blur(40px)', opacity: 0.55, pointerEvents: 'none' },
  floatNote: {
    position: 'absolute',
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 16,
    padding: '14px 18px',
    boxShadow: 'var(--shadow-soft)',
    fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 10,
    zIndex: 2,
  },
};

function Nav() {
  const navRegisterHref = buildRegisterHref({ source: 'landing', campaign: 'home-nav', content: 'nav-entrar' })
  return (
    <nav style={s.nav} className="landing-nav" aria-label="Navegação principal da página inicial">
      <div style={s.logo}>
        <div style={s.logoMark}>b</div>
        <span>BOTinho</span>
      </div>
      <div style={s.navLinks} className="landing-nav-links">
        <a style={s.navLink} href="#como">Como funciona</a>
        <a style={s.navLink} href="#features">Recursos</a>
        <Link style={s.navLink} href="/ferramentas">Ferramentas</Link>
        <a style={s.navLink} href="#planos">Planos</a>
        <a style={s.navLink} href="#faq">Perguntas</a>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} className="landing-nav-cta">
        <Link className="btn btn-ghost" href={navRegisterHref} style={{ padding: '10px 18px', fontSize: 14 }}>Entrar</Link>
        <a className="btn btn-primary" href="#planos" style={{ padding: '10px 18px', fontSize: 14 }}>Começar grátis</a>
      </div>
      <details className="landing-mobile-menu">
        <summary className="landing-mobile-menu-trigger" aria-label="Abrir menu de navegação">Menu</summary>
        <div className="landing-mobile-menu-panel">
          <a style={s.navLink} href="#como">Como funciona</a>
          <a style={s.navLink} href="#features">Recursos</a>
          <Link style={s.navLink} href="/ferramentas">Ferramentas</Link>
          <a style={s.navLink} href="#planos">Planos</a>
          <a style={s.navLink} href="#faq">Perguntas</a>
          <Link className="btn btn-ghost" href={navRegisterHref}>Entrar</Link>
          <a className="btn btn-primary" href="#planos">Começar grátis</a>
        </div>
      </details>
    </nav>
  );
}

export function Hero({ tone, primaryCtaLabel = 'Conectar meu WhatsApp', eyebrowLabel = 'Experimente grátis!', headlineOverride, subOverride, heroStyle }) {
  const heroPrimaryHref = buildRegisterHref({ source: 'landing', campaign: 'home-hero', content: 'hero-primary' })
  const heroChecklistHref = buildRegisterHref({ source: 'landing', campaign: 'home-hero', content: 'hero-checklist' })
  const headline = headlineOverride ?? (tone === 'direto'
    ? <><span>Ofertas conferidas,</span><br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>rotina organizada.</span></>
    : tone === 'animado'
    ? <><span>Os grupos geram ofertas.</span><br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>Você organiza.</span> 💜</>
    : <><span>Promoções conferidas</span><br />viram <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>rotina no seu grupo.</span></>);

  const sub = subOverride ?? (tone === 'direto'
    ? 'Você escolhe os grupos de promoção que quer monitorar. O bot pega cada link da Shopee, ML ou Amazon, ajuda a usar suas credenciais cadastradas e prepara a postagem para seu grupo de achadinhos.'
    : tone === 'animado'
    ? 'Aqueles grupos lotados de promoção que você acompanha? O bot monitora conforme sua configuração. Cada link suportado pode ser conferido, organizado e enviado para o seu grupo com cadência. ✨'
    : 'Você indica os grupos que quer monitorar (de promoções, ofertas, achadinhos). O bot detecta cada link da Shopee, ML ou Amazon, usa as credenciais cadastradas quando aplicável e reposta no seu próprio grupo de clientes com controle operacional.');

  return (
    <div className="wrap" style={{ position: 'relative' }}>
      <Nav />
      <div className="landing-mobile-priority">
        <Link className="btn btn-ghost" href={heroPrimaryHref}>Entrar</Link>
      </div>
      <div style={{ ...s.decor, width: 380, height: 380, background: 'var(--accent-2)', top: -40, right: -80 }} />
      <div style={{ ...s.decor, width: 280, height: 280, background: 'var(--accent-3)', bottom: -60, left: -40 }} />

      <header style={{ ...s.hero, ...heroStyle }} className="landing-hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={s.eyebrow}>
            <span className="pill"><span className="dot" />{eyebrowLabel}</span>
          </div>
          <h1 style={s.h1}>{headline}</h1>
          <p style={s.sub}>{sub}</p>
          <div style={s.cta} className="landing-hero-cta">
            <Link className="btn btn-accent" href={heroPrimaryHref} data-seo-cta="hero-primary-register">
              {primaryCtaLabel} <Icon name="arrow" size={16} />
            </Link>
            <a className="btn btn-ghost" href="#como" data-seo-cta="hero-secondary-como">Ver como funciona</a>
            <Link className="btn btn-ghost" href={heroChecklistHref} data-seo-cta="hero-secondary-checklist">Receber checklist</Link>
          </div>
          <div style={s.trust} className="landing-trust">
            <div style={s.trustItem} className="landing-trust-item"><Icon name="check" size={16} /> Sem cartão para testar</div>
            <div style={s.trustItem} className="landing-trust-item"><Icon name="check" size={16} /> Configura em 4 minutos</div>
            <div style={s.trustItem} className="landing-trust-item"><Icon name="check" size={16} /> Cancela quando quiser</div>
          </div>
        </div>

        <div style={s.mockWrap} className="landing-mock-wrap">
          <div style={{ ...s.floatNote, top: 24, left: -40, transform: 'rotate(-3deg)' }} className="landing-float-note">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-strong)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>Link interceptado</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{'de "Promoções Brasil" · 0,3s'}</div>
            </div>
          </div>
          <div style={{ ...s.floatNote, bottom: 80, right: -50, transform: 'rotate(2deg)', background: 'color-mix(in oklab, var(--accent) 18%, var(--surface))' }} className="landing-float-note">
            <Icon name="chart" size={18} />
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>Exemplo ilustrativo</div>
              <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1 }}>campanha</div>
            </div>
          </div>
          <WhatsAppMockup />
        </div>
      </header>
    </div>
  );
}
