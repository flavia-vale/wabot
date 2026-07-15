const s = {
  section: { background: 'var(--bg-soft)', borderRadius: 48, margin: '0 auto', maxWidth: 1380 },
  inner: { padding: '88px 64px' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56, gap: 32, flexWrap: 'wrap' },
  h2: { fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.05, maxWidth: 600 },
  steps: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 },
  step: {
    background: 'var(--surface)', borderRadius: 28, padding: 28,
    border: '1px solid var(--line)', position: 'relative',
    minHeight: 360, display: 'flex', flexDirection: 'column',
  },
  num: {
    fontFamily: "var(--font-instrument-serif), serif", fontStyle: 'italic',
    fontSize: 64, lineHeight: 1, color: 'var(--accent-strong)', marginBottom: 24,
  },
  stepTitle: { fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.01em' },
  stepBody: { fontSize: 15, lineHeight: 1.55, color: 'var(--ink-soft)', marginBottom: 24, flex: 1 },
  visual: {
    background: 'var(--bg-soft)', borderRadius: 16, padding: 16,
    border: '1px dashed var(--line)', fontSize: 12,
    fontFamily: "var(--font-jetbrains-mono), monospace", color: 'var(--ink-soft)',
  },
};

const steps = [
  {
    n: '01',
    title: 'Aponte grupos e/ou canais para monitorar',
    body: 'Conecte seu WhatsApp via QR Code e marque quais grupos e/ou canais de promoção, ofertas ou achadinhos o bot vai escutar. Pode ser 1 origem ou 20.',
    visual: (
      <div style={s.visual}>
        <div style={{ color: 'var(--ink-soft)' }}>{'// grupos e canais monitorados'}</div>
        <div style={{ color: 'var(--ink)', marginTop: 6 }}>✓ Promoções Brasil 🔥</div>
        <div style={{ color: 'var(--ink)' }}>✓ Ofertas Relâmpago</div>
        <div style={{ color: 'var(--ink)' }}>✓ Achadinhos do dia</div>
        <div style={{ marginTop: 8, color: 'var(--accent-strong)' }}>● 3 origens ativas</div>
      </div>
    ),
  },
  {
    n: '02',
    title: 'O bot detecta e converte o link',
    body: 'Toda mensagem com link de Shopee, Mercado Livre, Amazon ou Magalu é interceptada. O bot troca o ID original pelo seu código de afiliada.',
    visual: (
      <div style={s.visual}>
        <div style={{ color: 'var(--ink-soft)' }}>{'// detectado em "Promoções Brasil"'}</div>
        <div style={{ color: 'var(--ink)', marginTop: 6, textDecoration: 'line-through', opacity: 0.5 }}>shopee.com.br/...?aff=outraPessoa</div>
        <div style={{ color: 'var(--accent-strong)', marginTop: 4 }}>↓ convertendo</div>
        <div style={{ color: 'var(--ink)', marginTop: 4 }}>s.shopee.com.br/seu-id-afiliada</div>
      </div>
    ),
  },
  {
    n: '03',
    title: 'Posta no SEU grupo e/ou canal de clientes',
    body: 'O link convertido vai direto para o seu grupo e/ou canal de achadinhos, com a mensagem promocional do seu jeito. Você dorme, ele trabalha.',
    visual: (
      <div style={s.visual}>
        <div style={{ color: 'var(--ink-soft)' }}>{'// publicado em "Achados da Sol"'}</div>
        <div style={{ color: 'var(--ink)', marginTop: 6 }}>✨ Achadinho do dia</div>
        <div style={{ color: 'var(--ink-soft)', marginTop: 2 }}>R$ 39,90 · frete grátis</div>
        <div style={{ color: 'var(--accent-strong)', marginTop: 4 }}>s.shopee.com.br/3As9XkLp2</div>
        <div style={{ marginTop: 10, fontSize: 11, padding: '4px 8px', background: 'var(--accent-3)', display: 'inline-block', borderRadius: 6, color: 'var(--ink)' }}>+R$ 3,19 rastreado</div>
      </div>
    ),
  },
  {
    n: '04',
    title: 'Ligue as ofertas automáticas (Pro)',
    body: 'No plano Pro, o bot também busca ofertas da Shopee por palavra-chave e filtro, aplica dedup inteligente entre automações e envia direto para os canais e/ou grupos configurados — sem precisar de um grupo de origem para copiar.',
    visual: (
      <div style={s.visual}>
        <div style={{ color: 'var(--ink-soft)' }}>{'// automação · palavra-chave "fone bluetooth"'}</div>
        <div style={{ color: 'var(--ink)', marginTop: 6 }}>✓ filtro de preço aplicado</div>
        <div style={{ color: 'var(--ink)' }}>✓ dedup: sem repetição em 24h</div>
        <div style={{ marginTop: 8, color: 'var(--accent-strong)' }}>{'● enviado para "Achados da Sol"'}</div>
      </div>
    ),
  },
];

export function How() {
  return (
    <section id="como" data-screen-label="03 Como funciona">
      <div className="wrap">
        <div style={s.section} className="landing-how-shell">
          <div style={s.inner} className="landing-how-inner">
            <div style={s.head}>
              <div>
                <span className="pill" style={{ marginBottom: 16 }}><span className="dot" />Como funciona</span>
                <h2 style={s.h2}>Do manual ao automático.<br /><span className="serif" style={{ fontStyle: 'italic' }}>Zero esforço diário.</span></h2>
              </div>
              <p style={{ maxWidth: 360, color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6 }}>
                Você configura a rotina e acompanha pelos logs. Ideal para quem tem mais de um grupo e/ou canal e não quer ficar copiando link toda hora — e pode evoluir para ofertas automáticas quando quiser escalar.
              </p>
            </div>
            <div style={s.steps} className="landing-how-steps">
              {steps.map(step => (
                <div key={step.n} style={s.step} className="landing-how-step">
                  <div style={s.num}>{step.n}</div>
                  <div style={s.stepTitle}>{step.title}</div>
                  <p style={s.stepBody}>{step.body}</p>
                  {step.visual}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
