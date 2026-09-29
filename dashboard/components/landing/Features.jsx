import { Icon } from './Icon';

const s = {
  head: { textAlign: 'center', marginBottom: 64 },
  h2: { fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.05, maxWidth: 760, margin: '0 auto 16px' },
  sub: { fontSize: 17, color: 'var(--ink-soft)', maxWidth: 560, margin: '0 auto', lineHeight: 1.55 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20 },
  card: (cols, accent) => ({
    gridColumn: `span ${cols}`,
    background: accent ? 'color-mix(in oklab, var(--accent) 22%, var(--surface))' : 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 24, padding: 32, minHeight: 240,
    display: 'flex', flexDirection: 'column',
  }),
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    background: 'var(--bg-soft)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--accent-strong)', marginBottom: 20,
  },
  cardTitle: { fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.01em' },
  cardBody: { fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-soft)' },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  proTag: {
    padding: '4px 10px', borderRadius: 999, background: 'var(--pro-soft)', color: 'var(--pro-ink)',
    fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em',
  },
  preservationCard: {
    gridColumn: 'span 12',
    background: 'linear-gradient(135deg, color-mix(in oklab, var(--accent-3) 65%, var(--surface)) 0%, color-mix(in oklab, var(--accent-2) 45%, var(--surface)) 100%)',
    border: '1px solid var(--line)',
    borderRadius: 28,
    padding: 36,
    minHeight: 220,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)',
    gap: 28,
    alignItems: 'center',
    boxShadow: 'var(--shadow-soft)',
  },
  preservationList: { margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7, fontSize: 14.5 },
  bigStat: { fontWeight: 900, fontSize: 88, lineHeight: 1, color: 'var(--accent-strong)', letterSpacing: '-0.04em' },
  storeRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  store: { padding: '8px 14px', borderRadius: 999, background: 'var(--bg-soft)', border: '1px solid var(--line)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' },
};

/* Cards de recursos — revisados em 29/09/2026 contra a ficha técnica canônica
 * (dashboard/lib/ficha-tecnica.js / public/pricing.md) e o menu do painel.
 * Entraram os recursos lançados que não estavam aqui (criar oferta, ofertas
 * automáticas, filas, marca d'água, cupons, trava do link); saíram os cards
 * repetidos (duas "conversões", envio manual × broadcast). `pro: true` só
 * onde a ficha diz "Não" para o Basic — não inventar divisão nova aqui. */
const featureCards = [
  {
    title: 'Espelhamento automático 24 h',
    body: 'O robô lê seus grupos de origem o dia todo e publica nos seus grupos de destino, sem copiar e colar. No Pro, também de e para canais do WhatsApp.',
    icon: 'arrow',
    accent: true,
  },
  {
    title: 'Link trocado pelo seu código',
    body: 'Cada link de loja sai com o seu código de afiliada, inclusive link de cupom. Dá para testar a conversão no painel antes de ligar o robô.',
    icon: 'link',
  },
  {
    title: 'Nunca sai o link de outra pessoa',
    body: 'Se a troca do link falhar, a oferta não é publicada. Seu grupo nunca recebe o link com o código de quem postou na origem.',
    icon: 'shield',
  },
  {
    title: 'Criar oferta a partir de um link',
    body: 'Cole o seu link: o robô busca nome, preço e foto do produto e monta a oferta pronta para enviar agora ou agendar.',
    icon: 'plus',
    accent: true,
  },
  {
    title: 'Ofertas automáticas da Shopee',
    body: 'O robô busca ofertas da Shopee sozinho por tema e desconto mínimo, sem precisar de um grupo de origem para copiar.',
    icon: 'sparkles',
    pro: true,
  },
  {
    title: 'Modelos de mensagem do seu jeito',
    body: 'A oferta sai reescrita com o seu texto, não copiada da origem. Você define o modelo, com lugar para o link e o cupom.',
    icon: 'chat',
  },
  {
    title: 'Foto no card, com a sua marca',
    body: 'A foto do produto sai no card clicável, sem cortar. No Pro, a foto leva a marca d’água com o seu nome.',
    icon: 'star',
  },
  {
    title: 'Seus cupons na oferta',
    body: 'Cadastre os seus cupons de desconto uma vez. Na hora do envio, o robô coloca o cupom certo na mensagem.',
    icon: 'check',
    accent: true,
  },
  {
    title: 'Palavras bloqueadas',
    body: 'Escolha o que não deve ser espelhado, em todos os grupos ou só em um grupo de origem específico.',
    icon: 'shield',
  },
  {
    title: 'Enviar agora ou agendar',
    body: 'Publique uma oferta pontual em vários grupos de uma vez, na hora ou no horário que você escolher.',
    icon: 'bolt',
  },
  {
    title: 'Filas de envio no seu ritmo',
    body: 'Defina intervalo entre envios, horário de descanso e limite por dia. As ofertas esperam na fila e saem sem atropelo.',
    icon: 'users',
    pro: true,
    accent: true,
  },
  {
    title: 'Histórico de envios',
    body: 'Veja o que foi convertido, enviado ou bloqueado, e por quê, para conferir a operação e resolver falhas rápido.',
    icon: 'chart',
  },
];

export function Features() {
  return (
    <section id="features">
      <div className="wrap">
        <div style={s.head}>
          <span className="pill"><span className="dot" />Recursos</span>
          <h2 style={{ ...s.h2, marginTop: 16 }}>
            Pensado para afiliada que <span className="serif" style={{ fontStyle: 'italic' }}>quer escalar</span> sem ficar copiando link.
          </h2>
          <p style={s.sub}>Você aponta os grupos e/ou canais de promoção que quer monitorar e o seu grupo e/ou canal de destino. O resto é com a gente.</p>
        </div>

        <div style={s.grid} className="landing-features-grid">
          <div style={s.card(7, true)} className="landing-feature-card landing-feature-card-primary">
            <div style={s.iconBox}><Icon name="bolt" size={22} /></div>
            <div style={s.cardTitle}>Detecção em menos de 1 segundo</div>
            <p style={s.cardBody}>O bot escuta seus grupos e/ou canais em tempo real. Quando aparece um link de loja parceira, ele já dispara a versão sua antes da mensagem original sair de vista.</p>
            <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', gap: 32, alignItems: 'baseline' }}>
              <div>
                <div style={s.bigStat}>0,8s</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>tempo médio de resposta</div>
              </div>
              <div>
                <div style={s.bigStat}>24/7</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>sem precisar do seu celular ligado</div>
              </div>
            </div>
          </div>

          <div style={s.card(5)} className="landing-feature-card landing-feature-card-secondary">
            <div style={s.iconBox}><Icon name="link" size={22} /></div>
            <div style={s.cardTitle}>6 lojas com conversão de link</div>
            <p style={s.cardBody}>Suporta as principais plataformas que mais convertem no público brasileiro.</p>
            <div style={s.storeRow}>
              <span style={s.store}>Shopee</span>
              <span style={s.store}>Mercado Livre</span>
              <span style={s.store}>Amazon</span>
              <span style={s.store}>Magalu</span>
              <span style={s.store}>SHEIN</span>
              <span style={s.store}>AliExpress</span>
            </div>
          </div>

          {featureCards.map((card) => (
            <div key={card.title} style={s.card(4, card.accent)} className="landing-feature-card">
              <div style={s.cardTop}>
                <div style={s.iconBox}><Icon name={card.icon} size={22} /></div>
                {card.pro ? <span style={s.proTag}>PRO</span> : null}
              </div>
              <div style={s.cardTitle}>{card.title}</div>
              <p style={s.cardBody}>{card.body}</p>
            </div>
          ))}

          <div style={s.preservationCard} className="landing-feature-card landing-preservation-card">
            <div>
              <span className="pill"><span className="dot" />Camada Pro</span>
              <div style={{ ...s.cardTitle, fontSize: 28, marginTop: 16 }}>Módulo de preservação avançada</div>
              <p style={{ ...s.cardBody, fontSize: 16, maxWidth: 680 }}>
                Uma camada extra de cuidado para quem quer postar mais sem se preocupar: o bot ajusta o ritmo dos envios sozinho, varia o texto das mensagens para não parecer repetitivo e dá uma pausa quando percebe algo fora do padrão.
              </p>
            </div>
            <ul style={s.preservationList}>
              <li>Começa devagar e aumenta o ritmo aos poucos, dentro dos limites que você definir.</li>
              <li>Varia o texto das mensagens para não repetir sempre a mesma coisa.</li>
              <li>Registra tudo e avisa quando for hora de pausar, revisar e continuar com segurança.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
