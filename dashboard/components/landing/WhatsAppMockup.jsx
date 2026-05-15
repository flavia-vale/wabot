const waStyles = {
  phone: {
    width: 300,
    background: 'var(--surface)',
    borderRadius: 32,
    border: '1px solid var(--line)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    fontFamily: "'Inter', system-ui, sans-serif",
    flexShrink: 0,
  },
  header: {
    padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'color-mix(in oklab, var(--accent) 22%, var(--surface))',
    borderBottom: '1px solid var(--line)',
  },
  avatar: (gradient) => ({
    width: 36, height: 36, borderRadius: '50%',
    background: gradient || 'linear-gradient(135deg, var(--accent), var(--accent-2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 13,
    flexShrink: 0,
  }),
  body: {
    padding: '16px 12px',
    background: 'var(--bg-soft)',
    minHeight: 360,
    display: 'flex', flexDirection: 'column', gap: 8,
    backgroundImage: 'radial-gradient(color-mix(in oklab, var(--accent) 15%, transparent) 1px, transparent 1px)',
    backgroundSize: '14px 14px',
  },
  bubble: (mine) => ({
    maxWidth: '88%',
    padding: '8px 11px',
    borderRadius: 14,
    fontSize: 12.5,
    lineHeight: 1.4,
    background: mine ? 'color-mix(in oklab, var(--accent) 30%, var(--surface))' : 'var(--surface)',
    color: 'var(--ink)',
    alignSelf: mine ? 'flex-end' : 'flex-start',
    border: '1px solid var(--line)',
    borderBottomRightRadius: mine ? 4 : 14,
    borderBottomLeftRadius: mine ? 14 : 4,
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  }),
  meta: { fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 3, textAlign: 'right' },
  metaLeft: { fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 3 },
  link: { color: 'var(--accent-strong)', textDecoration: 'underline', wordBreak: 'break-all' },
  systemMsg: {
    alignSelf: 'center',
    fontSize: 10.5,
    padding: '3px 9px',
    background: 'color-mix(in oklab, var(--surface) 80%, var(--accent-2))',
    borderRadius: 999,
    color: 'var(--ink-soft)',
    fontWeight: 500,
  },
  botBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '1px 6px', borderRadius: 5,
    background: 'var(--accent-3)',
    color: 'var(--ink)',
    fontSize: 9.5, fontWeight: 600,
    marginLeft: 5,
  },
  groupName: { fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.1 },
  groupMembers: { fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 2 },
  senderName: (color) => ({ fontSize: 11, fontWeight: 600, color, marginBottom: 2 }),
  monitorBadge: {
    position: 'absolute', top: 12, right: 12,
    fontSize: 10, fontWeight: 600,
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(6px)',
    borderRadius: 999,
    color: 'var(--ink)',
    border: '1px solid var(--line)',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  monitorDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: '#E55',
    boxShadow: '0 0 0 4px rgba(238,85,85,0.2)',
    animation: 'pulse 1.6s infinite',
  },
};

function OrigemPhone() {
  return (
    <div style={{ ...waStyles.phone, position: 'relative' }}>
      <div style={waStyles.monitorBadge}>
        <span style={waStyles.monitorDot} />monitorando
      </div>
      <div style={waStyles.header}>
        <div style={waStyles.avatar('linear-gradient(135deg,#94A3B8,#475569)')}>PB</div>
        <div style={{ flex: 1 }}>
          <div style={waStyles.groupName}>Promoções Brasil 🔥</div>
          <div style={waStyles.groupMembers}>1.842 membros · grupo de origem</div>
        </div>
      </div>
      <div style={waStyles.body}>
        <div style={waStyles.systemMsg}>Hoje</div>
        <div style={waStyles.bubble(false)}>
          <div style={waStyles.senderName('#C77758')}>Admin do grupo</div>
          Promo relâmpago! Sandália linda na Shopee 😍
          <div style={{ marginTop: 4 }}>
            <span style={waStyles.link}>shopee.com.br/sandalia-bege-A12X9</span>
          </div>
          <div style={waStyles.metaLeft}>14:23</div>
        </div>
        <div style={waStyles.bubble(false)}>
          <div style={waStyles.senderName('#3E9C7A')}>Carlos</div>
          Esse preço tá ótimo!
          <div style={waStyles.metaLeft}>14:24</div>
        </div>
        <div style={waStyles.systemMsg}>● bot detectou link · 0,3s</div>
      </div>
    </div>
  );
}

function DestinoPhone() {
  return (
    <div style={waStyles.phone}>
      <div style={waStyles.header}>
        <div style={waStyles.avatar()}>AS</div>
        <div style={{ flex: 1 }}>
          <div style={waStyles.groupName}>Achados da Sol 💜</div>
          <div style={waStyles.groupMembers}>247 membros · seu grupo</div>
        </div>
      </div>
      <div style={waStyles.body}>
        <div style={waStyles.systemMsg}>Hoje</div>
        <div style={waStyles.bubble(false)}>
          <div style={waStyles.senderName('#7C5CF5')}>
            Sol Bot
            <span style={waStyles.botBadge}>BOT</span>
          </div>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>✨ Achadinho do dia</div>
          Sandália Bege Verão — só hoje por <b>R$ 39,90</b>, frete grátis!
          <div style={{ marginTop: 6, padding: 7, background: 'var(--bg-soft)', borderRadius: 7, fontSize: 11.5 }}>
            <span style={waStyles.link}>s.shopee.com.br/3As9XkLp2</span>
            <div style={{ fontSize: 9.5, color: 'var(--ink-soft)', marginTop: 2 }}>↑ link da Sol (afiliada)</div>
          </div>
          <div style={waStyles.metaLeft}>14:23 · postado pelo bot</div>
        </div>
        <div style={waStyles.bubble(false)}>
          <div style={waStyles.senderName('#3E9C7A')}>Carla</div>
          Comprei pelo seu link, Sol! 💜
          <div style={waStyles.metaLeft}>14:31</div>
        </div>
        <div style={waStyles.bubble(true)}>
          <span style={{ fontWeight: 600 }}>Oferta revisada</span>
          <div style={waStyles.meta}>14:48 · exemplo</div>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppMockup() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
      <OrigemPhone />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
        <div style={{ width: 1, height: 16, background: 'var(--line)' }} />
        <span style={{ padding: '4px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 999, fontWeight: 500 }}>
          ↓ converte e reposta no seu grupo
        </span>
        <div style={{ width: 1, height: 16, background: 'var(--line)' }} />
      </div>
      <DestinoPhone />
    </div>
  );
}
