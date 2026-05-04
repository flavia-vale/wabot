// GROUPS — seleção de grupos de origem (monitorar) e destino (postar)
const ScreenGroups = () => {
  const grupos = [
    {nome:'Promoções Brasil 🔥', membros:1842, role:'origem', ativo:true, links:'124 links/dia'},
    {nome:'Ofertas Relâmpago Shopee', membros:967, role:'origem', ativo:true, links:'58 links/dia'},
    {nome:'Achadinhos Mães', membros:412, role:'origem', ativo:false, links:'12 links/dia'},
    {nome:'Cupons & Cashback BR', membros:2340, role:'origem', ativo:true, links:'87 links/dia'},
    {nome:'Promoções de TI', membros:580, role:'origem', ativo:false, links:'34 links/dia'},
    {nome:'Achados da Sol 💜', membros:247, role:'destino', ativo:true, links:'posta aqui'},
    {nome:'Sol · Tech & Casa', membros:118, role:'destino', ativo:true, links:'posta aqui'},
    {nome:'Família Almeida', membros:8, role:'ignorado', ativo:false, links:'—'},
  ];

  const Tag = ({role}) => {
    if (role === 'origem') return <span style={{...shellStyles.pill(), background:'color-mix(in oklab, var(--accent-2) 50%, var(--surface))'}}>👁 monitorar</span>;
    if (role === 'destino') return <span style={{...shellStyles.pill('success')}}><Icon name="bolt" size={11}/> publicar</span>;
    return <span style={{...shellStyles.pill(), color:'var(--ink-faint)'}}>ignorado</span>;
  };

  return (
    <AppShell active="groups" title="Grupos" sub="Defina quais grupos o bot escuta e onde ele publica" notif={{groups: 2}}
      action={<button style={shellStyles.btn('accent')}><Icon name="plus" size={14}/> Adicionar grupo</button>}
    >
      {/* Banner explicativo */}
      <div style={{...shellStyles.card, marginBottom: 24, padding: 0, overflow:'hidden', background:'color-mix(in oklab, var(--accent) 14%, var(--surface))'}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 0}}>
          <div style={{padding: 24, borderRight:'1px solid var(--line)'}}>
            <div style={{fontSize: 11, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--ink-soft)', marginBottom: 8}}>👁 Origem · monitora</div>
            <div style={{fontSize: 15, lineHeight: 1.55, color:'var(--ink)'}}>Grupos de promoção, ofertas ou achadinhos que você participa. O bot só lê os links.</div>
          </div>
          <div style={{padding: 24}}>
            <div style={{fontSize: 11, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--success)', marginBottom: 8}}>⚡ Destino · publica</div>
            <div style={{fontSize: 15, lineHeight: 1.55, color:'var(--ink)'}}>Seus grupos de clientes/seguidoras. O bot posta o link já com o seu código.</div>
          </div>
        </div>
      </div>

      {/* Tabs/filters */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 16}}>
        <div style={{display:'flex', gap: 4, padding: 4, background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 999}}>
          {['Todos · 8','Origem · 5','Destino · 2','Ignorados · 1'].map((t, i) => (
            <button key={t} style={{
              padding:'7px 14px', borderRadius: 999, border:'none', cursor:'pointer',
              fontSize: 13, fontWeight: 500,
              background: i===0 ? 'var(--ink)' : 'transparent',
              color: i===0 ? 'white' : 'var(--ink-soft)',
            }}>{t}</button>
          ))}
        </div>
        <div style={{display:'flex', gap: 8, alignItems:'center'}}>
          <input placeholder="Buscar grupo…" style={{
            padding:'8px 14px', fontSize: 13,
            background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 999,
            width: 220, fontFamily:'inherit',
          }}/>
        </div>
      </div>

      <div style={shellStyles.card}>
        <div style={{display:'grid', gridTemplateColumns:'1.5fr 0.5fr 0.6fr 0.6fr 0.4fr', gap: 16, padding:'8px 12px', fontSize: 11, fontWeight: 600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--ink-faint)', borderBottom:'1px solid var(--line)'}}>
          <div>Grupo</div>
          <div>Membros</div>
          <div>Função</div>
          <div>Atividade</div>
          <div></div>
        </div>
        {grupos.map((g, i) => (
          <div key={g.nome} style={{
            display:'grid', gridTemplateColumns:'1.5fr 0.5fr 0.6fr 0.6fr 0.4fr', gap: 16,
            padding:'14px 12px',
            borderBottom: i < grupos.length-1 ? '1px solid var(--line)' : 'none',
            alignItems:'center',
            opacity: g.ativo ? 1 : 0.55,
          }}>
            <div style={{display:'flex', alignItems:'center', gap: 12}}>
              <div style={{
                width: 36, height: 36, borderRadius:'50%',
                background: g.role === 'destino' ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'var(--bg-soft)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color: g.role === 'destino' ? 'white' : 'var(--ink-soft)',
                fontWeight: 600, fontSize: 13,
              }}>{g.nome.split(' ').map(w=>w[0]).slice(0,2).join('').replace(/[^A-Za-zÀ-ÿ]/g,'').toUpperCase().slice(0,2)}</div>
              <div>
                <div style={{fontSize: 14, fontWeight: 500}}>{g.nome}</div>
                <div style={{fontSize: 11.5, color:'var(--ink-faint)', marginTop: 2}}>{g.links}</div>
              </div>
            </div>
            <div style={{fontSize: 13, color:'var(--ink-soft)'}}>{g.membros.toLocaleString('pt-BR')}</div>
            <div><Tag role={g.role}/></div>
            <div style={{fontSize: 12.5, color: g.ativo ? 'var(--success)' : 'var(--ink-faint)'}}>
              {g.ativo ? '● ativo' : '○ pausado'}
            </div>
            <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              {/* toggle */}
              <div style={{
                width: 36, height: 20, borderRadius: 999,
                background: g.ativo ? 'var(--accent-strong)' : 'var(--bg-soft)',
                position:'relative', cursor:'pointer',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius:'50%',
                  background:'white',
                  position:'absolute', top: 2, left: g.ativo ? 18 : 2,
                  transition:'left .2s ease',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
                }}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
};

window.ScreenGroups = ScreenGroups;
