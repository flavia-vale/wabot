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

const featureCards = [

  {
    title: 'Conversão de links',
    body: 'Converta automaticamente links de ofertas para o seu código de afiliada antes de enviar para grupos e/ou canais de destino.',
    icon: 'link',
    cols: 4,
    accent: true,
  },
  {
    title: 'Geração de texto de ofertas',
    body: 'Crie mensagem promocional com estrutura pronta (benefício, preço e CTA) para publicar com mais consistência em grupos e/ou canais.',
    icon: 'chat',
    cols: 4,
  },
  {
    title: 'Conversão Instantânea',
    body: 'Links de lojas suportadas são detectados e convertidos em tempo real com o seu código de afiliada, sem copiar e colar manualmente.',
    icon: 'bolt',
    cols: 4,
    accent: true,
  },
  {
    title: 'Monitoramento 24/7',
    body: 'O bot acompanha seus grupos e/ou canais de origem continuamente e mantém a operação rodando mesmo quando você não está no painel.',
    icon: 'users',
    cols: 4,
  },
  {
    title: 'Anti-Spam Inteligente',
    body: 'Regras de intervalo, filtros por palavras e controle por grupo/canal reduzem disparos repetidos e protegem a saúde do seu número.',
    icon: 'shield',
    cols: 4,
  },
  {
    title: 'Envio manual',
    body: 'Envie uma oferta pontual para seus grupos e/ou canais quando quiser reforçar uma campanha ou publicar um achadinho específico.',
    icon: 'chat',
    cols: 4,
  },
  {
    title: 'Broadcast em Massa',
    body: 'Distribua mensagens para múltiplos grupos e/ou canais de destino de uma só vez, mantendo controle sobre quais públicos recebem cada oferta.',
    icon: 'sparkles',
    cols: 4,
    accent: true,
  },

  {
    title: 'Espelhamento entre grupos e canais',
    body: 'Envie de canais para grupos, de grupos para canais ou entre destinos do mesmo tipo, mantendo cada rotina com origem, destino e cadência definidos.',
    icon: 'arrow',
    cols: 4,
    accent: true,
  },
  {
    title: 'Histórico de Logs',
    body: 'Acompanhe o que foi convertido, enviado ou bloqueado para validar a operação e diagnosticar falhas rapidamente.',
    icon: 'chart',
    cols: 4,
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
            <div key={card.title} style={s.card(card.cols, card.accent)} className="landing-feature-card">
              <div style={s.iconBox}><Icon name={card.icon} size={22} /></div>
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
