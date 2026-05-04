// RULES — mapear grupo de origem → destino, com filtros
const ScreenRules = () => {
  const regras = [
    {
      ativa: true,
      origem: ['Promoções Brasil 🔥', 'Cupons & Cashback BR'],
      lojas: ['Shopee', 'Mercado Livre', 'Amazon'],
      filtroPreco: 'até R$ 200',
      categoria: 'Moda · Casa · Beleza',
      destino: 'Achados da Sol 💜',
      template: 'Achadinho do dia ✨',
      delay: '1 min',
    },
    {
      ativa: true,
      origem: ['Promoções de TI'],
      lojas: ['Amazon', 'Magalu'],
      filtroPreco: 'qualquer preço',
      categoria: 'Eletrônicos · Tech',
      destino: 'Sol · Tech & Casa',
      template: 'Tech do dia ⚡',
      delay: 'imediato',
    },
    {
      ativa: false,
      origem: ['Ofertas Relâmpago Shopee'],
      lojas: ['Shopee'],
      filtroPreco: 'até R$ 50',
      categoria: 'Qualquer',
      destino: 'Achados da Sol 💜',
      template: 'Promo relâmpago ⚡',
      delay: 'imediato',
    },
  ];

  const Chip = ({children, tone}) => (
    <span style={{
      display:'inline-flex', alignItems:'center', gap: 4,
      fontSize: 12, fontWeight: 500,
      padding:'3px 9px', borderRadius: 999,
      background: tone === 'origem' ? 'color-mix(in oklab, var(--accent-2) 50%, var(--surface))'
                : tone === 'destino' ? 'color-mix(in oklab, var(--accent) 24%, var(--surface))'
                : 'var(--bg-soft)',
      color: 'var(--ink)',
      border:'1px solid var(--line)',
    }}>{children}</span>
  );

  return (
    <AppShell active="rules" title="Regras de conversão" sub="Para qual grupo cada link vai, e com qual mensagem"
      action={<button style={shellStyles.btn('accent')}><Icon name="plus" size={14}/> Nova regra</button>}
    >
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 16, marginBottom: 24}}>
        {[
          ['3','regras ativas'],
          ['8','grupos envolvidos'],
          ['127','conversões hoje'],
        ].map(([n,l]) => (
          <div key={l} style={shellStyles.card}>
            <div className="serif" style={{fontStyle:'italic', fontSize: 36, lineHeight:1, color:'var(--accent-strong)'}}>{n}</div>
            <div style={{fontSize: 13, color:'var(--ink-soft)', marginTop: 6}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex', flexDirection:'column', gap: 16}}>
        {regras.map((r, i) => (
          <div key={i} style={{...shellStyles.card, padding: 0, opacity: r.ativa ? 1 : 0.6}}>
            <div style={{padding:'18px 24px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap: 12}}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: r.ativa ? 'var(--accent-strong)' : 'var(--bg-soft)',
                  color: r.ativa ? 'white' : 'var(--ink-faint)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight: 600, fontSize: 13,
                }}>{i+1}</div>
                <div style={{fontSize: 15, fontWeight: 600}}>Regra · {r.categoria}</div>
                <span style={shellStyles.pill(r.ativa ? 'success' : '')}>
                  {r.ativa ? '● ativa' : '○ pausada'}
                </span>
              </div>
              <div style={{display:'flex', gap: 8}}>
                <button style={shellStyles.btn('ghost')}>Editar</button>
                <div style={{
                  width: 36, height: 20, borderRadius: 999,
                  background: r.ativa ? 'var(--accent-strong)' : 'var(--bg-soft)',
                  position:'relative', cursor:'pointer',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius:'50%', background:'white',
                    position:'absolute', top: 2, left: r.ativa ? 18 : 2,
                    boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
                  }}/>
                </div>
              </div>
            </div>

            <div style={{padding: 24, display:'grid', gridTemplateColumns:'1fr auto 1fr', gap: 24, alignItems:'center'}}>
              {/* Origem */}
              <div>
                <div style={{fontSize: 11, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--ink-faint)', marginBottom: 10}}>👁 Quando aparecer link em</div>
                <div style={{display:'flex', flexWrap:'wrap', gap: 6, marginBottom: 12}}>
                  {r.origem.map(o => <Chip key={o} tone="origem">{o}</Chip>)}
                </div>
                <div style={{fontSize: 12.5, color:'var(--ink-soft)', lineHeight: 1.5}}>
                  <div><b style={{color:'var(--ink)'}}>Lojas:</b> {r.lojas.join(', ')}</div>
                  <div style={{marginTop: 4}}><b style={{color:'var(--ink)'}}>Filtro de preço:</b> {r.filtroPreco}</div>
                </div>
              </div>

              {/* Setinha */}
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap: 6, color:'var(--accent-strong)'}}>
                <div style={{
                  width: 40, height: 40, borderRadius:'50%',
                  background:'color-mix(in oklab, var(--accent) 24%, var(--surface))',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  border:'1px solid var(--line)',
                }}>
                  <Icon name="arrow" size={18}/>
                </div>
                <div style={{fontSize: 11, color:'var(--ink-soft)', whiteSpace:'nowrap'}}>{r.delay}</div>
              </div>

              {/* Destino */}
              <div>
                <div style={{fontSize: 11, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--success)', marginBottom: 10}}>⚡ Posta em</div>
                <div style={{display:'flex', flexWrap:'wrap', gap: 6, marginBottom: 12}}>
                  <Chip tone="destino">{r.destino}</Chip>
                </div>
                <div style={{fontSize: 12.5, color:'var(--ink-soft)', lineHeight: 1.5}}>
                  <div><b style={{color:'var(--ink)'}}>Mensagem:</b> {r.template}</div>
                  <div style={{marginTop: 4}}><b style={{color:'var(--ink)'}}>Com seu ID de afiliada</b></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
};

window.ScreenRules = ScreenRules;
