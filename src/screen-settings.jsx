// SETTINGS SCREENS — cada subtópico é uma tela própria, ativada pelo sidebar

const sFieldStyle = {
  width:'100%', padding:'10px 14px', fontSize: 13.5,
  background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 10,
  fontFamily:'inherit', color:'var(--ink)',
};
const Field = ({label, children, hint}) => (
  <div style={{marginBottom: 20}}>
    <label style={{display:'block', fontSize: 12.5, fontWeight: 600, color:'var(--ink)', marginBottom: 6}}>{label}</label>
    {children}
    {hint && <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 6}}>{hint}</div>}
  </div>
);

// ──────────── IDs de afiliada ────────────
const ScreenAfiliada = () => {
  const lojas = [
    {nome:'Shopee', cor:'#EE4D2D', conectado:true, id:'sol_almeida_aff', cliques:'1.847', vendas:'58'},
    {nome:'Mercado Livre', cor:'#FFE600', conectado:true, id:'MLB-12903847', cliques:'612', vendas:'18'},
    {nome:'Amazon', cor:'#FF9900', conectado:true, id:'solalmeida-20', cliques:'298', vendas:'9'},
    {nome:'Magalu', cor:'#0086FF', conectado:false, id:'', cliques:'—', vendas:'—'},
    {nome:'AliExpress', cor:'#E62E04', conectado:false, id:'', cliques:'—', vendas:'—'},
  ];
  return (
    <AppShell active="afiliada" title="IDs de afiliada" sub="Cole o ID de cada plataforma — o bot cuida do resto">
      <div style={{maxWidth: 980}}>
        <div style={{...shellStyles.card, marginBottom: 16}}>
          <div style={{display:'flex', alignItems:'flex-start', gap: 14}}>
            <div style={{width: 40, height: 40, borderRadius: 12, background:'color-mix(in oklab, var(--accent-2) 60%, var(--surface))', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <Icon name="link" size={18}/>
            </div>
            <div>
              <div style={{fontSize: 16, fontWeight: 600, marginBottom: 4}}>Como pegar seu ID</div>
              <div style={{fontSize: 13, color:'var(--ink-soft)', lineHeight: 1.55}}>Acesse o painel de afiliados de cada loja, copie o seu ID (ou tag), e cole aqui. O bot vai usar para gerar links com a sua comissão automaticamente.</div>
            </div>
          </div>
        </div>

        <div style={{...shellStyles.card, padding: 0}}>
          {lojas.map((l, i) => (
            <div key={l.nome} style={{display:'grid', gridTemplateColumns:'40px 1fr 1.2fr 0.8fr auto', gap: 16, padding:'18px 20px', alignItems:'center', borderBottom: i < lojas.length-1 ? '1px solid var(--line)' : 'none'}}>
              <div style={{width: 32, height: 32, borderRadius: 8, background: l.cor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight: 700, fontSize: 11}}>{l.nome.slice(0,2).toUpperCase()}</div>
              <div>
                <div style={{fontSize: 14, fontWeight: 600}}>{l.nome}</div>
                <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>{l.conectado ? `${l.cliques} cliques · ${l.vendas} vendas` : 'não conectado'}</div>
              </div>
              {l.conectado ? (
                <div style={{...sFieldStyle, fontFamily:"'JetBrains Mono', monospace", fontSize: 12.5, padding:'8px 12px', display:'flex', alignItems:'center', gap: 8}}>
                  <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.id}</span>
                  <Icon name="check" size={14}/>
                </div>
              ) : (<input placeholder={`Cole seu ID da ${l.nome}…`} style={sFieldStyle}/>)}
              <div>{l.conectado ? <span style={shellStyles.pill('success')}>● ativo</span> : <span style={shellStyles.pill()}>○ pendente</span>}</div>
              <button style={shellStyles.btn('ghost')}>{l.conectado ? 'Editar' : 'Conectar'}</button>
            </div>
          ))}
        </div>

        <div style={{display:'flex', justifyContent:'flex-end', gap: 10, marginTop: 20}}>
          <button style={shellStyles.btn('ghost')}>Cancelar</button>
          <button style={shellStyles.btn('primary')}>Salvar alterações</button>
        </div>
      </div>
    </AppShell>
  );
};

// ──────────── Conta ────────────
const ScreenConta = () => (
  <AppShell active="conta" title="Conta" sub="Seus dados pessoais e preferências">
    <div style={{...shellStyles.card, maxWidth: 820}}>
      <div style={{display:'flex', alignItems:'center', gap: 16, marginBottom: 28, paddingBottom: 24, borderBottom:'1px solid var(--line)'}}>
        <div style={{width: 64, height: 64, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent), var(--accent-2))', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight: 600, fontSize: 22}}>SO</div>
        <div style={{flex:1}}>
          <div style={{fontSize: 17, fontWeight: 600}}>Sol Almeida</div>
          <div style={{fontSize: 13, color:'var(--ink-soft)', marginTop: 2}}>sol@almeida.com.br · Plano Pro</div>
        </div>
        <button style={shellStyles.btn('ghost')}>Trocar foto</button>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 20}}>
        <Field label="Nome de exibição"><input defaultValue="Sol Almeida" style={sFieldStyle}/></Field>
        <Field label="E-mail"><input defaultValue="sol@almeida.com.br" style={sFieldStyle}/></Field>
        <Field label="Telefone (WhatsApp)" hint="Usado para suporte e recuperação de conta"><input defaultValue="+55 11 9 8765-4321" style={sFieldStyle}/></Field>
        <Field label="Fuso horário"><select style={sFieldStyle} defaultValue="brt"><option value="brt">São Paulo (GMT-3)</option><option>Manaus (GMT-4)</option><option>Fortaleza (GMT-3)</option></select></Field>
        <Field label="Idioma"><select style={sFieldStyle} defaultValue="ptbr"><option value="ptbr">Português (BR)</option><option>English</option></select></Field>
        <Field label="Como podemos te chamar?"><input defaultValue="Sol" style={sFieldStyle}/></Field>
      </div>
      <div style={{display:'flex', justifyContent:'flex-end', gap: 10, marginTop: 16}}>
        <button style={shellStyles.btn('ghost')}>Cancelar</button>
        <button style={shellStyles.btn('primary')}>Salvar</button>
      </div>
    </div>
  </AppShell>
);

// ──────────── Conexão WhatsApp ────────────
const ScreenWhatsapp = () => (
  <AppShell active="whatsapp" title="Conexão WhatsApp" sub="Status da sessão e limites de envio">
    <div style={{maxWidth: 980}}>
      <div style={{...shellStyles.card, marginBottom: 16}}>
        <div style={{display:'flex', alignItems:'flex-start', gap: 16, padding: 18, background:'color-mix(in oklab, var(--success) 12%, var(--surface))', border:'1px solid var(--line)', borderRadius: 14}}>
          <div style={{width: 40, height: 40, borderRadius: 12, background:'var(--success)', display:'flex', alignItems:'center', justifyContent:'center', color:'white'}}><Icon name="check" size={18}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize: 15, fontWeight: 600, marginBottom: 2}}>WhatsApp conectado</div>
            <div style={{fontSize: 12.5, color:'var(--ink-soft)'}}>+55 11 9 8765-4321 · conectado há 47 dias · sessão ativa</div>
          </div>
          <button style={{...shellStyles.btn('ghost'), color:'var(--danger)'}}>Desconectar</button>
        </div>
      </div>

      <div style={shellStyles.card}>
        <div style={{fontSize: 14, fontWeight: 600, marginBottom: 14}}>Limites e segurança</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16}}>
          <div style={{padding: 18, background:'var(--bg-soft)', borderRadius: 12, border:'1px solid var(--line)'}}>
            <div style={{fontSize: 11.5, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600, marginBottom: 8}}>Posts hoje</div>
            <div style={{display:'flex', alignItems:'baseline', gap: 6}}>
              <span className="serif" style={{fontStyle:'italic', fontSize: 32, lineHeight: 1}}>127</span>
              <span style={{color:'var(--ink-soft)', fontSize: 13}}>/ 250 limite</span>
            </div>
            <div style={{height: 6, background:'var(--surface)', borderRadius: 999, marginTop: 10, overflow:'hidden'}}>
              <div style={{width:'51%', height:'100%', background:'var(--accent-strong)', borderRadius: 999}}/>
            </div>
          </div>
          <div style={{padding: 18, background:'var(--bg-soft)', borderRadius: 12, border:'1px solid var(--line)'}}>
            <div style={{fontSize: 11.5, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600, marginBottom: 8}}>Tempo entre posts</div>
            <div style={{display:'flex', alignItems:'baseline', gap: 6}}>
              <span className="serif" style={{fontStyle:'italic', fontSize: 32, lineHeight: 1}}>45</span>
              <span style={{color:'var(--ink-soft)', fontSize: 13}}>segundos mínimo</span>
            </div>
            <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 10}}>recomendado para evitar bloqueios</div>
          </div>
        </div>
        <div style={{marginTop: 20, padding: 18, border:'1px solid var(--line)', borderRadius: 12}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <div style={{fontSize: 13.5, fontWeight: 600}}>Modo soneca</div>
              <div style={{fontSize: 12, color:'var(--ink-soft)', marginTop: 2}}>Bot não posta entre 23h e 7h (horário de Brasília)</div>
            </div>
            <div style={{width: 36, height: 20, borderRadius: 999, background:'var(--accent-strong)', position:'relative', cursor:'pointer'}}>
              <div style={{width:16, height:16, borderRadius:'50%', background:'white', position:'absolute', top:2, left:18, boxShadow:'0 1px 3px rgba(0,0,0,0.15)'}}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppShell>
);

// ──────────── Notificações ────────────
const ScreenNotif = () => {
  const items = [
    {label:'Toda nova venda confirmada', sub:'+R$ 4,79 · Sandália Bege', on:true},
    {label:'Resumo diário (todo dia às 22h)', sub:'comissões, cliques e top produtos', on:true},
    {label:'Resumo semanal (domingo)', sub:'desempenho da semana', on:true},
    {label:'Bot desconectado do WhatsApp', sub:'urgente · pedir reconexão', on:true},
    {label:'Limite de posts próximo (90%)', sub:'aviso para pausar manualmente', on:false},
    {label:'Novidades e atualizações do produto', sub:'no máximo 1 vez por mês', on:false},
  ];
  return (
    <AppShell active="notif" title="Notificações" sub="O que você quer receber no WhatsApp">
      <div style={{...shellStyles.card, maxWidth: 820}}>
        <div style={{fontSize: 14, fontWeight: 600, marginBottom: 4}}>Receba alertas no seu WhatsApp pessoal</div>
        <div style={{fontSize: 12.5, color:'var(--ink-soft)', marginBottom: 24}}>O bot manda mensagens privadas para você quando algo importante acontecer.</div>
        {items.map((n, i, a) => (
          <div key={i} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom: i < a.length-1 ? '1px solid var(--line)' : 'none'}}>
            <div>
              <div style={{fontSize: 13.5, fontWeight: 500}}>{n.label}</div>
              <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>{n.sub}</div>
            </div>
            <div style={{width: 36, height: 20, borderRadius: 999, background: n.on ? 'var(--accent-strong)' : 'var(--bg-soft)', position:'relative', cursor:'pointer', flexShrink: 0}}>
              <div style={{width:16, height:16, borderRadius:'50%', background:'white', position:'absolute', top:2, left: n.on ? 18 : 2, boxShadow:'0 1px 3px rgba(0,0,0,0.15)'}}/>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
};

// ──────────── Plano e cobrança ────────────
const ScreenPlano = () => (
  <AppShell active="plano" title="Plano e cobrança" sub="Sua assinatura, uso e forma de pagamento">
    <div style={{maxWidth: 980}}>
      <div style={{...shellStyles.card, padding: 28, background:'var(--ink)', color:'white', marginBottom: 16, position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', right:-40, top:-40, width: 200, height: 200, borderRadius:'50%', background:'var(--accent-strong)', filter:'blur(60px)', opacity: .5}}/>
        <div style={{position:'relative', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontSize: 11.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.6)'}}>Plano atual</div>
            <div style={{display:'flex', alignItems:'baseline', gap: 8, marginTop: 8}}>
              <span className="serif" style={{fontStyle:'italic', fontSize: 44, lineHeight: 1}}>Pro</span>
              <span style={{opacity: .7}}>· R$ 39/mês (anual)</span>
            </div>
            <div style={{fontSize: 13, opacity: .7, marginTop: 8}}>Renovação em 14 de junho · cartão final 4242</div>
          </div>
          <div style={{display:'flex', gap: 10}}>
            <button style={{...shellStyles.btn('ghost'), color:'white', borderColor:'rgba(255,255,255,0.2)'}}>Histórico</button>
            <button style={{padding:'9px 16px', borderRadius: 999, background:'var(--accent-2)', color:'var(--ink)', border:'none', fontWeight: 600, fontSize: 13.5, cursor:'pointer'}}>Mudar plano</button>
          </div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 16}}>
        {[
          {label:'Grupos ativos', n:'8', max:'∞ ilimitados'},
          {label:'Posts no mês', n:'2.847', max:'de 5.000'},
          {label:'Lojas conectadas', n:'3', max:'de 5'},
        ].map(s => (
          <div key={s.label} style={shellStyles.card}>
            <div style={{fontSize: 12, color:'var(--ink-soft)', marginBottom: 8}}>{s.label}</div>
            <div className="serif" style={{fontStyle:'italic', fontSize: 28, lineHeight: 1}}>{s.n}</div>
            <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 6}}>{s.max}</div>
          </div>
        ))}
      </div>

      <div style={{...shellStyles.card, marginTop: 16}}>
        <div style={{fontSize: 13.5, fontWeight: 600, marginBottom: 14}}>Forma de pagamento</div>
        <div style={{display:'flex', alignItems:'center', gap: 14, padding: 14, background:'var(--bg-soft)', borderRadius: 12}}>
          <div style={{width: 44, height: 30, borderRadius: 6, background:'linear-gradient(135deg, #1A1F71, #4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize: 10, fontWeight: 700}}>VISA</div>
          <div style={{flex:1}}>
            <div style={{fontSize: 13, fontWeight: 500}}>•••• •••• •••• 4242</div>
            <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>vence 08/28 · Sol Almeida</div>
          </div>
          <button style={shellStyles.btn('ghost')}>Trocar</button>
        </div>
      </div>

      <div style={{...shellStyles.card, marginTop: 16}}>
        <div style={{fontSize: 13.5, fontWeight: 600, marginBottom: 14}}>Últimas faturas</div>
        {[
          {data:'14 abr 2026', val:'R$ 39,00', status:'paga'},
          {data:'14 mar 2026', val:'R$ 39,00', status:'paga'},
          {data:'14 fev 2026', val:'R$ 39,00', status:'paga'},
        ].map((f, i, a) => (
          <div key={i} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom: i < a.length-1 ? '1px solid var(--line)' : 'none', fontSize: 13}}>
            <div style={{color:'var(--ink-soft)'}}>{f.data}</div>
            <div style={{fontWeight: 500}}>{f.val}</div>
            <span style={shellStyles.pill('success')}>● {f.status}</span>
            <button style={shellStyles.btn('ghost')}>Baixar PDF</button>
          </div>
        ))}
      </div>
    </div>
  </AppShell>
);

// ──────────── Segurança ────────────
const ScreenSeguranca = () => (
  <AppShell active="seguranca" title="Segurança" sub="Senha, 2FA e sessões ativas">
    <div style={{maxWidth: 980}}>
      <div style={shellStyles.card}>
        <div style={{fontSize: 14, fontWeight: 600, marginBottom: 4}}>Senha</div>
        <div style={{fontSize: 12.5, color:'var(--ink-soft)', marginBottom: 18}}>Última alteração há 23 dias</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 14}}>
          <Field label="Senha atual"><input type="password" defaultValue="••••••••" style={sFieldStyle}/></Field>
          <Field label="Nova senha"><input type="password" placeholder="mínimo 10 caracteres" style={sFieldStyle}/></Field>
          <Field label="Confirmar"><input type="password" style={sFieldStyle}/></Field>
        </div>
        <button style={shellStyles.btn('primary')}>Atualizar senha</button>
      </div>

      <div style={{...shellStyles.card, marginTop: 16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize: 14, fontWeight: 600, marginBottom: 4}}>Verificação em duas etapas</div>
            <div style={{fontSize: 12.5, color:'var(--ink-soft)'}}>Pediremos um código por SMS sempre que você fizer login num novo aparelho.</div>
          </div>
          <span style={shellStyles.pill('success')}>● ativada</span>
        </div>
      </div>

      <div style={{...shellStyles.card, marginTop: 16}}>
        <div style={{fontSize: 14, fontWeight: 600, marginBottom: 14}}>Sessões ativas</div>
        {[
          {dev:'Chrome · Windows', loc:'São Paulo, BR', when:'agora', cur:true},
          {dev:'Safari · iPhone', loc:'São Paulo, BR', when:'há 2 horas', cur:false},
        ].map((s, i, a) => (
          <div key={i} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom: i < a.length-1 ? '1px solid var(--line)' : 'none'}}>
            <div>
              <div style={{fontSize: 13.5, fontWeight: 500, display:'flex', alignItems:'center', gap: 8}}>
                {s.dev} {s.cur && <span style={shellStyles.pill('success')}>esta sessão</span>}
              </div>
              <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>{s.loc} · {s.when}</div>
            </div>
            {!s.cur && <button style={{...shellStyles.btn('ghost'), color:'var(--danger)'}}>Encerrar</button>}
          </div>
        ))}
      </div>

      <div style={{...shellStyles.card, marginTop: 16, borderColor:'color-mix(in oklab, var(--danger) 30%, var(--line))'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontSize: 14, fontWeight: 600, color:'var(--danger)', marginBottom: 4}}>Excluir conta</div>
            <div style={{fontSize: 12.5, color:'var(--ink-soft)'}}>Apaga todos os dados, regras e desconecta o WhatsApp. Não tem volta.</div>
          </div>
          <button style={{...shellStyles.btn('ghost'), color:'var(--danger)', borderColor:'color-mix(in oklab, var(--danger) 40%, var(--line))'}}>Excluir conta</button>
        </div>
      </div>
    </div>
  </AppShell>
);

Object.assign(window, { ScreenAfiliada, ScreenConta, ScreenWhatsapp, ScreenNotif, ScreenPlano, ScreenSeguranca });
