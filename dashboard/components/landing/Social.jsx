import { Icon } from './Icon';
import {
  BRAND_PRODUCT_NAME,
  BRAND_YOUTUBE_TUTORIAL_EMBED_URL,
  BRAND_YOUTUBE_TUTORIAL_URL,
  BRAND_LINKEDIN_URL,
  BRAND_YOUTUBE_URL,
  SUPPORT_HOURS,
  SUPPORT_RESPONSE_SLA,
} from '@/lib/marketing-content';

/* PROVA SOCIAL — regra permanente (auditoria de funil 2026-08-05, §1.1)
 *
 * Este bloco publicava "1.200+ afiliadas", "R$ 4,2M em comissões", "380k links"
 * e "4,9 ★", além de 3 depoimentos com nome e avatar. Nenhum desses números
 * tinha lastro em lugar nenhum do repositório, e eles contradiziam a própria
 * PRODUCT_LIMITATIONS renderizada logo abaixo na mesma home ("Não prometemos
 * ganho financeiro, comissão ou aumento garantido de vendas"). Promessa de
 * resultado financeiro não comprovável em peça publicitária é risco de
 * publicidade enganosa (CDC art. 37 / CONAR) — e, no funil, número redondo sem
 * print nem @ verificável derruba confiança em vez de construir.
 *
 * NÃO REINTRODUZIR número de clientes, volume de comissão, nota média ou
 * depoimento sem: (a) fonte rastreável e (b) autorização por escrito de quem
 * deu o depoimento. Guarda de regressão: test/landing-social-proof.test.js.
 *
 * Enquanto não houver depoimento colhido, o bloco entrega prova VERIFICÁVEL:
 * o vídeo oficial do canal (qualquer um confere) e os compromissos que o
 * produto de fato cumpre (trial sem cartão, cancelamento, suporte humano).
 */

const s = {
  head: { textAlign: 'center', marginBottom: 40 },
  h2: { fontSize: 'clamp(32px, 3.5vw, 48px)', lineHeight: 1.1 },
  sub: { fontSize: 17, color: 'var(--ink-soft)', maxWidth: 620, margin: '16px auto 0', lineHeight: 1.55 },
  layout: { display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 32, alignItems: 'center' },
  videoCard: {
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 24, padding: 12, boxShadow: 'var(--shadow-soft)',
  },
  videoFrame: {
    position: 'relative', width: '100%', aspectRatio: '16 / 9',
    borderRadius: 16, overflow: 'hidden', background: 'var(--ink)',
  },
  videoCaption: { fontSize: 13, color: 'var(--ink-soft)', padding: '12px 8px 4px', lineHeight: 1.5 },
  promises: { display: 'flex', flexDirection: 'column', gap: 14 },
  promise: {
    display: 'flex', gap: 14, alignItems: 'flex-start',
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 18, padding: '18px 20px',
  },
  promiseIcon: { flexShrink: 0, marginTop: 2, color: 'var(--accent-strong)' },
  promiseTitle: { fontSize: 15, fontWeight: 600, color: 'var(--ink)' },
  promiseBody: { fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-soft)', marginTop: 4 },
  link: { color: 'var(--accent-strong)', fontWeight: 600 },
};

const promises = [
  {
    icon: 'check',
    title: 'Sem cartão para testar',
    body: 'Os 7 dias de teste não pedem cartão de crédito. Se não servir, é só não assinar.',
  },
  {
    icon: 'check',
    title: 'Cancela quando quiser',
    body: 'Assinatura de 30 dias, sem fidelidade e sem multa. Você cancela pelo próprio painel.',
  },
  {
    icon: 'check',
    title: 'Suporte por WhatsApp, com gente de verdade',
    body: `${SUPPORT_HOURS}. ${SUPPORT_RESPONSE_SLA}.`,
  },
];

export function Social() {
  return (
    <section id="prova">
      <div className="wrap">
        <div style={s.head}>
          <span className="pill"><span className="dot" />Veja funcionando</span>
          <h2 style={{ ...s.h2, marginTop: 16 }}>
            Não pedimos que você{' '}
            <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>acredite</span>. Veja.
          </h2>
          <p style={s.sub}>
            O passo a passo real de criar a conta, no nosso canal oficial — sem corte e sem
            edição. É o mesmo caminho que você vai fazer em seguida.
          </p>
        </div>

        <div style={s.layout} className="landing-social-grid">
          <div style={s.videoCard}>
            <div style={s.videoFrame}>
              <iframe
                src={BRAND_YOUTUBE_TUTORIAL_EMBED_URL}
                title={`Como criar sua conta no ${BRAND_PRODUCT_NAME}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p style={s.videoCaption}>
              Tutorial: como criar sua conta.{' '}
              <a style={s.link} href={BRAND_YOUTUBE_TUTORIAL_URL} target="_blank" rel="noopener noreferrer">
                Assistir no YouTube
              </a>
              {' · '}
              <a style={s.link} href={BRAND_YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
                canal oficial
              </a>
              {' · '}
              <a style={s.link} href={BRAND_LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </p>
          </div>

          <div style={s.promises}>
            {promises.map((p) => (
              <div key={p.title} style={s.promise}>
                <span style={s.promiseIcon}><Icon name={p.icon} size={18} /></span>
                <div>
                  <div style={s.promiseTitle}>{p.title}</div>
                  <div style={s.promiseBody}>{p.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
