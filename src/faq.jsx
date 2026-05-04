const faqStyles = {
  wrap: { display:'grid', gridTemplateColumns:'1fr 1.4fr', gap: 64, alignItems:'flex-start' },
  h2: { fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.05, marginBottom: 16 },
  sub: { fontSize: 16, color:'var(--ink-soft)', lineHeight: 1.6, maxWidth: 380 },
  list: { display:'flex', flexDirection:'column', gap: 4 },
  item: (open) => ({
    background: open ? 'color-mix(in oklab, var(--accent) 16%, var(--surface))' : 'var(--surface)',
    border:'1px solid var(--line)',
    borderRadius: 18,
    overflow:'hidden',
    transition:'background .2s ease',
  }),
  q: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding: '20px 24px',
    cursor:'pointer',
    fontSize: 16, fontWeight: 500,
    background:'transparent', border:'none', width:'100%', textAlign:'left',
    color: 'var(--ink)',
    fontFamily:'inherit',
  },
  a: (open) => ({
    maxHeight: open ? 400 : 0,
    overflow: 'hidden',
    transition: 'max-height .3s ease',
    padding: open ? '0 24px 22px' : '0 24px',
    fontSize: 14.5, lineHeight: 1.6,
    color:'var(--ink-soft)',
  }),
  toggle: (open) => ({
    width: 28, height: 28, borderRadius:'50%',
    background:'var(--bg-soft)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'var(--ink)',
    transform: open ? 'rotate(45deg)' : 'none',
    transition: 'transform .25s ease',
    flexShrink: 0,
  }),
};

const FAQ = () => {
  const items = [
    {q:'Vou ser banida do WhatsApp?', a:'Não. O bot usa o protocolo oficial do WhatsApp Web (o mesmo que você usa no computador) e respeita os limites de envio. Como ele só reposta com base em links que existem em outros grupos, o comportamento parece humano. Tem mais de 1.200 contas ativas há meses sem incidentes.'},
    {q:'Posso cancelar quando quiser?', a:'Sim, a qualquer momento, direto no painel. Sem multa, sem ligação para call center. Se cancelar antes dos 30 dias grátis acabarem, não cobramos nada.'},
    {q:'Preciso deixar meu celular ligado?', a:'Não. A sessão fica em nossos servidores. Depois de conectar via QR Code, você pode desligar o celular, viajar, dormir — o bot continua trabalhando.'},
    {q:'Funciona com quais programas de afiliados?', a:'Hoje suportamos Shopee, Mercado Livre, Amazon, Magalu e AliExpress. Você só precisa colar seu ID de afiliada de cada plataforma no painel uma vez.'},
    {q:'O texto vai parecer robotizado?', a:'Você escreve seus próprios modelos de mensagem promocional (ou usa os nossos prontos por categoria). Pode usar emoji, hashtags, gírias — o bot mantém exatamente sua voz. Tem também opção de gerar variações com IA para não repetir mensagem.'},
    {q:'Os admins dos grupos monitorados podem perceber?', a:'O bot só lê — ele não posta nada nos grupos de origem (os que você monitora). Ele só reposta no SEU grupo de destino, com o seu link de afiliada. Para os outros admins, você é só mais uma membro do grupo deles.'},
    {q:'Posso escolher para qual grupo cada link vai?', a:'Sim. Você pode ter um grupo de destino único ou vários. Por exemplo: links de moda vão para "Achadinhos Fashion", links de eletrônico vão para "Achadinhos Tech". Você define as regras por categoria ou por grupo de origem.'},
    {q:'E se eu já tenho admin de outro bot no grupo de destino?', a:'Funciona normal. O nosso só posta links das lojas suportadas, então não conflita com bots de mensagem ou moderação. Pode coexistir.'},
    {q:'Os dados dos meus grupos ficam seguros?', a:'A gente nunca lê mensagens fora dos links. As conversas não são armazenadas. Cada conta tem sessão isolada, criptografada, e você pode pedir exclusão completa em 1 clique.'},
  ];
  const [open, setOpen] = React.useState(0);
  return (
    <section id="faq" data-screen-label="07 FAQ">
      <div className="wrap">
        <div style={faqStyles.wrap}>
          <div>
            <span className="pill"><span className="dot"/>Perguntas</span>
            <h2 style={{...faqStyles.h2, marginTop: 16}}>Antes de você <span className="serif" style={{fontStyle:'italic'}}>perguntar</span>.</h2>
            <p style={faqStyles.sub}>Se ficar alguma dúvida, fala com a gente no WhatsApp. Respondemos em minutos no horário comercial.</p>
            <a className="btn btn-ghost" href="#" style={{marginTop: 24}}>
              <Icon name="whatsapp" size={16}/> Conversar agora
            </a>
          </div>
          <div style={faqStyles.list}>
            {items.map((it, i) => (
              <div key={i} style={faqStyles.item(open === i)}>
                <button style={faqStyles.q} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{it.q}</span>
                  <span style={faqStyles.toggle(open === i)}><Icon name="plus" size={14}/></span>
                </button>
                <div style={faqStyles.a(open === i)}>{it.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

window.FAQ = FAQ;
