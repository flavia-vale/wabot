// TEMPLATES — editor das mensagens promocionais
const ScreenTemplates = () => {
  const [active, setActive] = React.useState(0);
  const templates = [
    {
      nome:'Achadinho do dia ✨',
      categoria:'Geral',
      uso: '47% dos posts',
      texto: '✨ Achadinho do dia\n\n{produto} — só hoje por *{preco}* {frete}!\n\n{link}\n\n#achados #{categoria}',
    },
    {
      nome:'Promo relâmpago ⚡',
      categoria:'Ofertas curtas',
      uso: '28% dos posts',
      texto: '⚡ CORRE QUE É RELÂMPAGO!\n\n{produto}\nDe ~{preco_de}~ por *{preco}*\n\nLink na descrição: {link}',
    },
    {
      nome:'Tech do dia ⚡',
      categoria:'Eletrônicos',
      uso: '17% dos posts',
      texto: '🔌 Tech do dia\n\n{produto}\n💸 {preco} {frete}\n\nGarante: {link}',
    },
    {
      nome:'Beleza & cuidados 💄',
      categoria:'Beleza',
      uso: '8% dos posts',
      texto: '💄 Pra você ficar ainda mais linda\n\n{produto} por *{preco}*\n\n{link}\n\n#beleza #autocuidado',
    },
  ];
  const t = templates[active];

  return (
    <AppShell active="templates" title="Mensagens promocionais" sub="Como o bot escreve quando reposta no seu grupo"
      action={<button style={shellStyles.btn('accent')}><Icon name="plus" size={14}/> Nova mensagem</button>}
    >
      <div style={{display:'grid', gridTemplateColumns:'320px 1fr', gap: 20}}>
        {/* List */}
        <div style={{...shellStyles.card, padding: 0}}>
          <div style={{padding:'16px 20px', borderBottom:'1px solid var(--line)', fontSize: 13, fontWeight: 600, letterSpacing:'0.04em'}}>Modelos · 4</div>
          {templates.map((tpl, i) => (
            <div key={i} onClick={() => setActive(i)} style={{
              padding:'14px 20px',
              borderBottom: i < templates.length-1 ? '1px solid var(--line)' : 'none',
              cursor:'pointer',
              background: active === i ? 'color-mix(in oklab, var(--accent) 14%, var(--surface))' : 'transparent',
              borderLeft: active === i ? '3px solid var(--accent-strong)' : '3px solid transparent',
            }}>
              <div style={{fontSize: 14, fontWeight: 600, marginBottom: 4}}>{tpl.nome}</div>
              <div style={{fontSize: 11.5, color:'var(--ink-soft)'}}>{tpl.categoria} · {tpl.uso}</div>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div style={{display:'grid', gridTemplateRows:'auto 1fr', gap: 20}}>
          <div style={shellStyles.card}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 18}}>
              <div>
                <div style={{fontSize: 18, fontWeight: 600}}>{t.nome}</div>
                <div style={{fontSize: 12.5, color:'var(--ink-soft)', marginTop: 2}}>Edite o texto. Use variáveis entre chaves.</div>
              </div>
              <div style={{display:'flex', gap: 8}}>
                <button style={shellStyles.btn('ghost')}><Icon name="sparkles" size={13}/> Variar com IA</button>
                <button style={shellStyles.btn('primary')}>Salvar</button>
              </div>
            </div>
            <div style={{
              border:'1px solid var(--line)', borderRadius: 12, padding: 18,
              fontFamily:"'JetBrains Mono', monospace",
              fontSize: 13, lineHeight: 1.7,
              background:'var(--bg-soft)',
              color:'var(--ink)',
              whiteSpace:'pre-wrap',
              minHeight: 180,
            }}>
              {t.texto.split(/(\{[^}]+\})/).map((part, i) => part.startsWith('{')
                ? <span key={i} style={{background:'color-mix(in oklab, var(--accent-2) 60%, transparent)', padding:'1px 6px', borderRadius: 5, color:'var(--ink)', fontWeight: 500}}>{part}</span>
                : <span key={i}>{part}</span>
              )}
            </div>
            <div style={{display:'flex', gap: 8, flexWrap:'wrap', marginTop: 14}}>
              <span style={{fontSize: 11.5, color:'var(--ink-soft)', alignSelf:'center', marginRight: 4}}>variáveis:</span>
              {['{produto}','{preco}','{preco_de}','{frete}','{link}','{categoria}','{loja}','{cupom}'].map(v => (
                <span key={v} style={{
                  fontSize: 11.5, fontFamily:"'JetBrains Mono', monospace",
                  padding:'3px 8px', borderRadius: 6,
                  background:'var(--bg-soft)', color:'var(--ink-soft)',
                  border:'1px solid var(--line)', cursor:'pointer',
                }}>{v}</span>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{...shellStyles.card, padding: 0, overflow:'hidden'}}>
            <div style={{padding:'14px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontSize: 13, fontWeight: 600}}>Pré-visualização no WhatsApp</div>
              <span style={{fontSize: 11.5, color:'var(--ink-soft)'}}>como vai chegar no grupo da Sol</span>
            </div>
            <div style={{padding: 24, background:'var(--bg-soft)', minHeight: 220, backgroundImage:'radial-gradient(color-mix(in oklab, var(--accent) 15%, transparent) 1px, transparent 1px)', backgroundSize:'14px 14px'}}>
              <div style={{
                maxWidth: 360,
                background:'var(--surface)',
                border:'1px solid var(--line)',
                borderRadius: 14,
                borderBottomLeftRadius: 4,
                padding:'12px 14px',
                fontSize: 13.5,
                lineHeight: 1.5,
                whiteSpace:'pre-wrap',
                boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
              }}>
                <div style={{fontSize: 11.5, fontWeight: 600, color:'#7C5CF5', marginBottom: 4}}>
                  Sol Bot
                  <span style={{marginLeft: 6, padding:'1px 6px', borderRadius: 5, background:'var(--accent-3)', fontSize: 10}}>BOT</span>
                </div>
                {t.texto
                  .replace('{produto}','Sandália Bege Verão 2026')
                  .replace('{preco_de}','R$ 79,90')
                  .replace('{preco}','R$ 39,90')
                  .replace('{frete}','com frete grátis')
                  .replace('{link}','s.shopee.com.br/3As9XkLp2')
                  .replace('{categoria}','moda')
                  .replace('{loja}','Shopee')
                  .replace('{cupom}','SOL10')
                }
                <div style={{fontSize: 10.5, color:'var(--ink-faint)', textAlign:'right', marginTop: 6}}>14:23 ✓✓</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

window.ScreenTemplates = ScreenTemplates;
