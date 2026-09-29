import { Icon } from './Icon';
import { PainelVendasIlustrativo } from '@/components/marketing/PainelVendasIlustrativo';

/* Aba Vendas na home (29/09/2026): a imagem ilustrativa ocupava a largura
 * inteira (960px) e sozinha não dizia o que a tela faz. Agora fica menor, com
 * cards curtos do lado. Os cards descrevem só o que a aba mostra de fato
 * (ver /vendas-e-comissao-afiliado-whatsapp) — nada de número ou promessa de
 * ganho: os dados da imagem são fictícios e a legenda diz isso. */

const s = {
  head: { textAlign: 'center', marginBottom: 40 },
  h2: { fontSize: 'clamp(30px, 3.4vw, 46px)', lineHeight: 1.08, marginTop: 16 },
  sub: { fontSize: 16.5, color: 'var(--ink-soft)', maxWidth: 600, margin: '14px auto 0', lineHeight: 1.55 },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: 28, alignItems: 'center' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  card: {
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 18, padding: '16px 18px',
  },
  icon: { color: 'var(--accent-strong)', marginBottom: 8, display: 'block' },
  title: { fontSize: 15, fontWeight: 600, color: 'var(--ink)' },
  body: { fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-soft)', marginTop: 4 },
  proTag: {
    display: 'inline-block', padding: '4px 10px', borderRadius: 999,
    background: 'var(--pro-soft)', color: 'var(--pro-ink)',
    fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em',
  },
};

const cards = [
  { icon: 'check', title: 'Pedidos atribuídos', body: 'Quais pedidos da Shopee vieram das ofertas que o robô publicou.' },
  { icon: 'chart', title: 'Valor vendido', body: 'Quanto foi vendido e quantos itens, no período que você escolher.' },
  { icon: 'star', title: 'Comissão estimada e confirmada', body: 'Separadas, para você saber o que ainda pode mudar.' },
  { icon: 'link', title: 'Por pedido e por produto', body: 'Veja o que vende de verdade e decida o que publicar amanhã.' },
];

export function VendasPreview() {
  return (
    <section id="vendas" aria-labelledby="vendas-home-titulo">
      <div className="wrap">
        <div style={s.head}>
          <span className="pill"><span className="dot" />Aba Vendas</span>
          <h2 id="vendas-home-titulo" style={s.h2}>
            Veja o que <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>vendeu</span>, não só o que saiu.
          </h2>
          <p style={s.sub}>
            Pedidos e comissão da Shopee das ofertas publicadas pelo robô, no próprio painel.{' '}
            <span style={s.proTag}>PRO</span>
          </p>
        </div>
        <div style={s.layout} className="landing-vendas-grid">
          <PainelVendasIlustrativo
            style={{ margin: 0, maxWidth: 560, width: '100%', justifySelf: 'center' }}
            sizes="(max-width: 1024px) 100vw, 560px"
          />
          <div style={s.cards} className="landing-vendas-cards">
            {cards.map((c) => (
              <div key={c.title} style={s.card}>
                <span style={s.icon}><Icon name={c.icon} size={18} /></span>
                <div style={s.title}>{c.title}</div>
                <div style={s.body}>{c.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
