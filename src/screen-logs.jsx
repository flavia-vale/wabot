// LOGS — auditoria detalhada de cada link processado pelo bot
const ScreenLogs = () => {
  const [filter, setFilter] = React.useState('todos');
  const [expandedId, setExpandedId] = React.useState(2);

  const filters = [
    {key:'todos', label:'Todos', count: 1284},
    {key:'venda', label:'Vendas', count: 47},
    {key:'enviado', label:'Enviados', count: 1187},
    {key:'falha', label:'Falhas', count: 32},
    {key:'ignorado', label:'Ignorados pela regra', count: 218},
  ];

  const logs = [
    {id:1, hora:'14:48:22', status:'venda', origem:'Promoções Brasil 🔥', loja:'Shopee', produto:'Sandália Bege Verão', destino:'Achados da Sol 💜', regra:'Moda · Casa · Beleza', comissao:'R$ 4,79', linkOriginal:'shopee.com.br/Sandalia-Bege-i.4738291.928374', linkConvertido:'s.shopee.com.br/3As9XkLp2', tempo:'1m 12s'},
    {id:2, hora:'14:23:08', status:'venda', origem:'Cupons & Cashback BR', loja:'Mercado Livre', produto:'Air Fryer Mondial 4L 1500W', destino:'Sol · Tech & Casa', regra:'Eletrônicos · Tech', comissao:'R$ 12,40', linkOriginal:'mercadolivre.com.br/air-fryer-mondial-4l/p/MLB12903847?affkey=outroaff_xyz', linkConvertido:'mercadolivre.com.br/sec/2QkX8nP', tempo:'imediato'},
    {id:3, hora:'13:51:45', status:'enviado', origem:'Promoções Brasil 🔥', loja:'Amazon', produto:'Kit Maquiagem Ruby Rose 12 itens', destino:'Achados da Sol 💜', regra:'Moda · Casa · Beleza', comissao:null, linkOriginal:'amazon.com.br/dp/B0BXY4K8N9?tag=outroaff-20', linkConvertido:'amzn.to/3pK9wQs', tempo:'imediato'},
    {id:4, hora:'13:32:11', status:'venda', origem:'Promoções de TI', loja:'Magalu', produto:'Mouse Logitech M170', destino:'Sol · Tech & Casa', regra:'Eletrônicos · Tech', comissao:'R$ 2,80', linkOriginal:'magazinevoce.com.br/magazinepromocoes/p/mouse-logitech', linkConvertido:'magazinevoce.com.br/solalmeida/p/mouse-logitech', tempo:'imediato'},
    {id:5, hora:'13:18:33', status:'falha', origem:'Promoções Brasil 🔥', loja:'AliExpress', produto:'Carregador USB-C 65W', destino:'Sol · Tech & Casa', regra:'Eletrônicos · Tech', comissao:null, linkOriginal:'aliexpress.com/item/100500394827.html', linkConvertido:null, erro:'AliExpress não conectada — adicione seu ID em Ajustes', tempo:'—'},
    {id:6, hora:'12:58:02', status:'enviado', origem:'Cupons & Cashback BR', loja:'Shopee', produto:'Vestido Floral Midi', destino:'Achados da Sol 💜', regra:'Moda · Casa · Beleza', comissao:null, linkOriginal:'shopee.com.br/Vestido-Floral-Midi-i.182734.728273', linkConvertido:'s.shopee.com.br/8Pq2RxNm9', tempo:'imediato'},
    {id:7, hora:'12:14:55', status:'venda', origem:'Promoções Brasil 🔥', loja:'Shopee', produto:'Tênis Casual Branco', destino:'Achados da Sol 💜', regra:'Moda · Casa · Beleza', comissao:'R$ 6,10', linkOriginal:'shopee.com.br/Tenis-Casual-Branco-i.928374.182763', linkConvertido:'s.shopee.com.br/7Mn3PqL8w', tempo:'47s'},
    {id:8, hora:'11:47:19', status:'ignorado', origem:'Promoções Brasil 🔥', loja:'Shopee', produto:'Geladeira Brastemp 375L (R$ 3.489)', destino:null, regra:'Filtro de preço — máx R$ 200', comissao:null, linkOriginal:'shopee.com.br/Geladeira-Brastemp-i.83948.273645', linkConvertido:null, motivo:'Preço acima do limite definido na regra', tempo:'—'},
    {id:9, hora:'11:33:07', status:'enviado', origem:'Promoções Brasil 🔥', loja:'Amazon', produto:'Livro Mindset · Carol Dweck', destino:'Achados da Sol 💜', regra:'Moda · Casa · Beleza', comissao:null, linkOriginal:'amazon.com.br/dp/B07YQGH892', linkConvertido:'amzn.to/4kP2qXn', tempo:'imediato'},
    {id:10, hora:'10:58:44', status:'falha', origem:'Promoções de TI', loja:'Mercado Livre', produto:'Notebook Acer Aspire 5', destino:'Sol · Tech & Casa', regra:'Eletrônicos · Tech', comissao:null, linkOriginal:'mercadolivre.com.br/notebook-acer/p/MLB...', linkConvertido:null, erro:'Link de afiliada expirado — verifique seu ID', tempo:'—'},
  ];

  const StatusBadge = ({status}) => {
    const map = {
      venda: {bg:'color-mix(in oklab, var(--success) 18%, var(--surface))', color:'var(--success)', label:'venda', icon:'check'},
      enviado: {bg:'color-mix(in oklab, var(--accent) 22%, var(--surface))', color:'var(--accent-strong)', label:'enviado', icon:'arrow'},
      falha: {bg:'color-mix(in oklab, var(--danger) 18%, var(--surface))', color:'var(--danger)', label:'falha', icon:'bolt'},
      ignorado: {bg:'var(--bg-soft)', color:'var(--ink-soft)', label:'ignorado', icon:'shield'},
    };
    const m = map[status];
    return (
      <span style={{display:'inline-flex', alignItems:'center', gap: 5, fontSize: 11.5, fontWeight: 600, padding:'3px 9px', borderRadius: 999, background: m.bg, color: m.color, border:'1px solid var(--line)'}}>
        <Icon name={m.icon} size={11}/> {m.label}
      </span>
    );
  };

  const filtered = filter === 'todos' ? logs : logs.filter(l => l.status === filter);

  return (
    <AppShell active="logs" title="Logs de envio" sub="Tudo que o bot processou — links recebidos, convertidos, postados ou ignorados"
      action={
        <div style={{display:'flex', gap: 8}}>
          <button style={shellStyles.btn('ghost')}><Icon name="arrow" size={13}/> Exportar CSV</button>
          <button style={shellStyles.btn('ghost')}>Hoje · 4 mai</button>
        </div>
      }
    >
      {/* Filter chips */}
      <div style={{display:'flex', gap: 8, marginBottom: 18, flexWrap:'wrap'}}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding:'8px 14px', borderRadius: 999,
            border:'1px solid ' + (filter === f.key ? 'var(--ink)' : 'var(--line)'),
            background: filter === f.key ? 'var(--ink)' : 'var(--surface)',
            color: filter === f.key ? 'white' : 'var(--ink)',
            fontSize: 12.5, fontWeight: 500, cursor:'pointer', fontFamily:'inherit',
            display:'inline-flex', alignItems:'center', gap: 6,
          }}>
            {f.label}
            <span style={{fontSize: 11, opacity: filter === f.key ? .7 : .55}}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Search + secondary filters */}
      <div style={{display:'flex', gap: 10, marginBottom: 16}}>
        <div style={{flex:1, position:'relative'}}>
          <input placeholder="Buscar por produto, loja, link…" style={{
            width:'100%', padding:'11px 14px 11px 40px', fontSize: 13.5,
            background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 10,
            fontFamily:'inherit', color:'var(--ink)',
          }}/>
          <div style={{position:'absolute', left: 14, top:'50%', transform:'translateY(-50%)', color:'var(--ink-faint)'}}>
            <Icon name="sparkles" size={14}/>
          </div>
        </div>
        <select style={{padding:'11px 14px', fontSize: 13.5, background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 10, color:'var(--ink)', fontFamily:'inherit'}}>
          <option>Todas as lojas</option><option>Shopee</option><option>Mercado Livre</option><option>Amazon</option><option>Magalu</option><option>AliExpress</option>
        </select>
        <select style={{padding:'11px 14px', fontSize: 13.5, background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 10, color:'var(--ink)', fontFamily:'inherit'}}>
          <option>Todos os grupos</option><option>Achados da Sol 💜</option><option>Sol · Tech & Casa</option>
        </select>
      </div>

      {/* Table */}
      <div style={{...shellStyles.card, padding: 0, overflow:'hidden'}}>
        <div style={{
          display:'grid',
          gridTemplateColumns:'90px 110px 1fr 1.1fr 1fr 110px 32px',
          gap: 16, padding:'12px 20px',
          fontSize: 11, fontWeight: 600, letterSpacing:'0.06em', textTransform:'uppercase',
          color:'var(--ink-soft)', borderBottom:'1px solid var(--line)', background:'var(--bg-soft)',
        }}>
          <div>Hora</div>
          <div>Status</div>
          <div>Produto</div>
          <div>Origem → Destino</div>
          <div>Regra aplicada</div>
          <div style={{textAlign:'right'}}>Comissão</div>
          <div></div>
        </div>

        {filtered.map((l, i) => (
          <React.Fragment key={l.id}>
            <div onClick={() => setExpandedId(expandedId === l.id ? null : l.id)} style={{
              display:'grid',
              gridTemplateColumns:'90px 110px 1fr 1.1fr 1fr 110px 32px',
              gap: 16, padding:'14px 20px',
              alignItems:'center', cursor:'pointer',
              borderBottom: i < filtered.length-1 ? '1px solid var(--line)' : 'none',
              background: expandedId === l.id ? 'color-mix(in oklab, var(--accent) 8%, var(--surface))' : 'transparent',
            }}>
              <div style={{fontSize: 11.5, color:'var(--ink-faint)', fontFamily:"'JetBrains Mono', monospace"}}>{l.hora}</div>
              <div><StatusBadge status={l.status}/></div>
              <div style={{minWidth: 0}}>
                <div style={{fontSize: 13, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{l.produto}</div>
                <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>{l.loja}</div>
              </div>
              <div style={{fontSize: 12, color:'var(--ink-soft)', minWidth: 0}}>
                <div style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{l.origem}</div>
                <div style={{display:'flex', alignItems:'center', gap: 4, marginTop: 2, color: l.destino ? 'var(--ink)' : 'var(--ink-faint)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                  <span style={{color:'var(--accent-strong)'}}>↓</span> {l.destino || 'não publicado'}
                </div>
              </div>
              <div style={{fontSize: 12, color:'var(--ink-soft)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{l.regra}</div>
              <div style={{textAlign:'right', fontSize: 13, fontWeight: 600, color: l.comissao ? 'var(--success)' : 'var(--ink-faint)'}}>
                {l.comissao ? '+' + l.comissao : '—'}
              </div>
              <div style={{color:'var(--ink-faint)', transform: expandedId === l.id ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform .15s'}}>
                <Icon name="arrow" size={14}/>
              </div>
            </div>

            {expandedId === l.id && (
              <div style={{
                padding:'20px 28px 24px',
                background:'var(--bg-soft)',
                borderBottom: i < filtered.length-1 ? '1px solid var(--line)' : 'none',
                display:'grid', gridTemplateColumns:'1fr 1fr', gap: 24,
              }}>
                <div>
                  <div style={{fontSize: 11, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--ink-soft)', marginBottom: 10}}>Detecção</div>
                  <div style={{display:'flex', flexDirection:'column', gap: 8, fontSize: 12.5}}>
                    <div style={{display:'flex', gap: 8}}>
                      <span style={{color:'var(--ink-soft)', minWidth: 100}}>Recebido em</span>
                      <span style={{fontFamily:"'JetBrains Mono', monospace"}}>{l.hora} · de {l.origem}</span>
                    </div>
                    <div style={{display:'flex', gap: 8}}>
                      <span style={{color:'var(--ink-soft)', minWidth: 100}}>Link original</span>
                      <span style={{fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5, color:'var(--ink)', wordBreak:'break-all'}}>{l.linkOriginal}</span>
                    </div>
                    {l.linkConvertido && (
                      <div style={{display:'flex', gap: 8}}>
                        <span style={{color:'var(--ink-soft)', minWidth: 100}}>Convertido</span>
                        <span style={{fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5, color:'var(--success)', wordBreak:'break-all', fontWeight: 500}}>{l.linkConvertido}</span>
                      </div>
                    )}
                    <div style={{display:'flex', gap: 8}}>
                      <span style={{color:'var(--ink-soft)', minWidth: 100}}>Loja detectada</span>
                      <span>{l.loja}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{fontSize: 11, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--ink-soft)', marginBottom: 10}}>
                    {l.status === 'falha' ? 'Erro' : l.status === 'ignorado' ? 'Por que foi ignorado' : 'Publicação'}
                  </div>

                  {l.erro && (
                    <div style={{padding: 12, background:'color-mix(in oklab, var(--danger) 12%, var(--surface))', border:'1px solid color-mix(in oklab, var(--danger) 30%, var(--line))', borderRadius: 10, color:'var(--danger)', fontSize: 12.5, marginBottom: 12}}>
                      <Icon name="bolt" size={12}/> &nbsp;{l.erro}
                    </div>
                  )}
                  {l.motivo && (
                    <div style={{padding: 12, background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 10, color:'var(--ink-soft)', fontSize: 12.5, marginBottom: 12}}>
                      {l.motivo}
                    </div>
                  )}

                  {!l.erro && !l.motivo && (
                    <div style={{display:'flex', flexDirection:'column', gap: 8, fontSize: 12.5, marginBottom: 12}}>
                      <div style={{display:'flex', gap: 8}}>
                        <span style={{color:'var(--ink-soft)', minWidth: 100}}>Postado em</span>
                        <span>{l.destino}</span>
                      </div>
                      <div style={{display:'flex', gap: 8}}>
                        <span style={{color:'var(--ink-soft)', minWidth: 100}}>Tempo até envio</span>
                        <span>{l.tempo}</span>
                      </div>
                      <div style={{display:'flex', gap: 8}}>
                        <span style={{color:'var(--ink-soft)', minWidth: 100}}>Modelo usado</span>
                        <span>Achadinho do dia ✨</span>
                      </div>
                      {l.status === 'venda' && (
                        <div style={{display:'flex', gap: 8}}>
                          <span style={{color:'var(--ink-soft)', minWidth: 100}}>Venda confirmada</span>
                          <span style={{color:'var(--success)', fontWeight: 600}}>{l.comissao} via {l.loja}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{display:'flex', gap: 8}}>
                    {l.linkConvertido && <button style={shellStyles.btn('ghost')}>Ver no WhatsApp</button>}
                    {l.status === 'falha' && <button style={shellStyles.btn('primary')}>Tentar novamente</button>}
                    {l.status === 'ignorado' && <button style={shellStyles.btn('ghost')}>Editar regra</button>}
                  </div>
                </div>
              </div>
            )}
          </React.Fragment>
        ))}

        <div style={{padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid var(--line)', fontSize: 12.5, color:'var(--ink-soft)'}}>
          <span>Mostrando {filtered.length} de {filter === 'todos' ? '1.284' : filters.find(f=>f.key===filter)?.count} eventos</span>
          <div style={{display:'flex', gap: 6}}>
            <button style={{...shellStyles.btn('ghost'), padding:'6px 10px'}}>‹</button>
            <button style={{...shellStyles.btn('ghost'), padding:'6px 10px', background:'var(--ink)', color:'white', borderColor:'var(--ink)'}}>1</button>
            <button style={{...shellStyles.btn('ghost'), padding:'6px 10px'}}>2</button>
            <button style={{...shellStyles.btn('ghost'), padding:'6px 10px'}}>3</button>
            <button style={{...shellStyles.btn('ghost'), padding:'6px 10px'}}>›</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

window.ScreenLogs = ScreenLogs;
