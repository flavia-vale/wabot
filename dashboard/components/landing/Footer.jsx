import Link from 'next/link';
import { Icon } from './Icon';
import { buildRegisterHref } from '@/lib/marketing-attribution';

const s = {
  cta: {
    background: 'var(--ink)', color: 'var(--surface)',
    borderRadius: 36, padding: '88px 64px',
    margin: '0 auto', maxWidth: 1380,
    position: 'relative', overflow: 'hidden', textAlign: 'center',
  },
  h2: { fontSize: 'clamp(40px, 5vw, 72px)', lineHeight: 1.02, maxWidth: 760, margin: '0 auto 24px', color: 'var(--surface)' },
  sub: { fontSize: 17, color: 'rgba(255,255,255,0.7)', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.55 },
  blob: (color, x, y, size) => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    background: color, filter: 'blur(80px)', opacity: 0.5,
    [x.k]: x.v, [y.k]: y.v,
  }),
  foot: { padding: '64px 0 40px' },
  footGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40 },
  brand: { fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, marginTop: 12, maxWidth: 280 },
  colTitle: { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink)', marginBottom: 16 },
  colLink: { display: 'block', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none', marginBottom: 10 },
  bottom: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 32, marginTop: 48,
    borderTop: '1px solid var(--line)',
    fontSize: 13, color: 'var(--ink-soft)',
  },
};

export function FinalCTA() {
  return (
    <section>
      <div className="wrap">
        <div style={s.cta} className="landing-final-cta">
          <div style={s.blob('var(--accent-strong)', { k: 'left', v: '-10%' }, { k: 'top', v: '-30%' }, 480)} />
          <div style={s.blob('var(--accent-2)', { k: 'right', v: '-10%' }, { k: 'bottom', v: '-40%' }, 420)} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <span className="pill" style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}>
              <span className="dot" />Teste grátis
            </span>
            <h2 style={{ ...s.h2, marginTop: 16 }}>
              Sua próxima rotina<br /><span className="serif" style={{ fontStyle: 'italic' }}>fica mais organizada.</span>
            </h2>
            <p style={s.sub}>Conecte o WhatsApp, valide poucos grupos primeiro e escale apenas rotinas permitidas, com revisão humana e cadência responsável.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }} className="landing-final-cta-actions">
              <Link className="btn" href={buildRegisterHref({ source: 'landing', campaign: 'home-final-cta', content: 'connect-whatsapp' })} style={{ background: 'var(--accent-2)', color: 'var(--ink)' }}>
                <Icon name="whatsapp" size={16} /> Conectar meu WhatsApp <Icon name="arrow" size={16} />
              </Link>
              <Link className="btn" href="/suporte" style={{ background: 'transparent', color: 'var(--surface)', border: '1px solid rgba(255,255,255,0.2)' }}>
                Falar com suporte
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={s.foot}>
      <div className="wrap">
        <div style={s.footGrid} className="landing-footer-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 17 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>b</div>
              <span>BOTinho</span>
            </div>
            <p style={s.brand}>Software web para afiliados e admins organizarem links suportados, grupos e rotinas de divulgação no WhatsApp com revisão humana.</p>
          </div>
          <div>
            <div style={s.colTitle}>Produto</div>
            <a style={s.colLink} href="#como">Como funciona</a>
            <a style={s.colLink} href="#features">Recursos</a>
            <a style={s.colLink} href="#planos">Planos</a>
            <a style={s.colLink} href="#faq">Perguntas</a>
          </div>
          <div>
            <div style={s.colTitle}>Empresa</div>
            <Link style={s.colLink} href="/quem-somos">Sobre</Link>
            <Link style={s.colLink} href="/conteudos">Blog</Link>
            <Link style={s.colLink} href="/suporte">Contato</Link>
            <Link style={s.colLink} href="/suporte">Afiliados (do bot)</Link>
          </div>
          <div>
            <div style={s.colTitle}>Legal</div>
            <Link style={s.colLink} href="/termos">Termos</Link>
            <Link style={s.colLink} href="/privacidade">Privacidade</Link>
            <Link style={s.colLink} href="/privacidade">LGPD</Link>
          </div>
        </div>
        <div style={s.bottom} className="landing-footer-bottom">
          <span>© 2026 Bot Conversor. Feito no Brasil 💜</span>
          <span>Não somos afiliados oficialmente ao WhatsApp Inc.</span>
        </div>
      </div>
    </footer>
  );
}


export default Footer;
