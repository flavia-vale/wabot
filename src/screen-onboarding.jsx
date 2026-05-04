// ONBOARDING — conexão WhatsApp via QR Code
const ScreenOnboarding = () => {
  const steps = [
    {n: 1, label: 'Conta', done: true},
    {n: 2, label: 'WhatsApp', active: true},
    {n: 3, label: 'Grupos', done: false},
    {n: 4, label: 'Pronto', done: false},
  ];
  return (
    <AppShell active="" title="Conectar WhatsApp" sub="Passo 2 de 4">
      <div style={{maxWidth: 880, margin: '0 auto'}}>
        {/* Stepper */}
        <div style={{display:'flex', alignItems:'center', gap: 8, marginBottom: 32}}>
          {steps.map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{display:'flex', alignItems:'center', gap: 10}}>
                <div style={{
                  width: 28, height: 28, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize: 13, fontWeight: 600,
                  background: s.done ? 'var(--accent-strong)' : s.active ? 'var(--ink)' : 'var(--bg-soft)',
                  color: s.done || s.active ? 'white' : 'var(--ink-soft)',
                  border:'1px solid ' + (s.active ? 'var(--ink)' : 'var(--line)'),
                }}>
                  {s.done ? <Icon name="check" size={14}/> : s.n}
                </div>
                <span style={{fontSize: 13, fontWeight: s.active ? 600 : 500, color: s.active ? 'var(--ink)' : 'var(--ink-soft)'}}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div style={{flex:1, height: 1, background:'var(--line)'}}/>}
            </React.Fragment>
          ))}
        </div>

        <div style={{...shellStyles.card, padding: 0, overflow:'hidden'}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr'}}>
            {/* Left: instructions */}
            <div style={{padding: 36, borderRight:'1px solid var(--line)'}}>
              <div className="serif" style={{fontSize: 14, fontStyle:'italic', color:'var(--accent-strong)', marginBottom: 8}}>conecte em 30 segundos</div>
              <h2 style={{fontSize: 28, lineHeight: 1.15, marginBottom: 20}}>Escaneie o código com o WhatsApp do celular</h2>
              <ol style={{padding: 0, margin: 0, listStyle:'none', display:'flex', flexDirection:'column', gap: 14}}>
                {[
                  'Abra o WhatsApp no celular',
                  'Toque em ⋮ (Android) ou Ajustes (iPhone)',
                  'Vá em Aparelhos conectados → Conectar um aparelho',
                  'Aponte a câmera para o QR ao lado',
                ].map((t, i) => (
                  <li key={i} style={{display:'flex', gap: 12, alignItems:'flex-start'}}>
                    <span style={{
                      width: 22, height: 22, borderRadius:'50%',
                      background:'var(--bg-soft)', color:'var(--ink)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize: 12, fontWeight: 600, flexShrink: 0,
                    }}>{i+1}</span>
                    <span style={{fontSize: 14, lineHeight: 1.5, color:'var(--ink)'}}>{t}</span>
                  </li>
                ))}
              </ol>
              <div style={{marginTop: 32, padding: 16, background:'var(--bg-soft)', borderRadius: 12, fontSize: 12.5, lineHeight: 1.55, color:'var(--ink-soft)'}}>
                <div style={{display:'flex', alignItems:'center', gap: 6, fontWeight: 600, color:'var(--ink)', marginBottom: 6}}>
                  <Icon name="shield" size={14}/> 100% seguro
                </div>
                A conexão é igual à do WhatsApp Web. Você pode desconectar a qualquer momento. A gente não armazena suas conversas.
              </div>
            </div>

            {/* Right: QR */}
            <div style={{padding: 36, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'color-mix(in oklab, var(--accent) 10%, var(--surface))'}}>
              <div style={{padding: 20, background:'white', borderRadius: 18, boxShadow:'var(--shadow-soft)', position:'relative'}}>
                {/* Stylized QR */}
                <div style={{
                  width: 220, height: 220,
                  display:'grid',
                  gridTemplateColumns:'repeat(21, 1fr)',
                  gap: 0,
                }}>
                  {[...Array(441)].map((_, i) => {
                    // deterministic pseudo-random
                    const x = i % 21, y = Math.floor(i/21);
                    const corner = (x<7 && y<7) || (x>13 && y<7) || (x<7 && y>13);
                    const cornerInner = (x>=2 && x<=4 && y>=2 && y<=4) || (x>=16 && x<=18 && y>=2 && y<=4) || (x>=2 && x<=4 && y>=16 && y<=18);
                    const cornerOuter = corner && !((x>0 && x<6 && y>0 && y<6) || (x>14 && x<20 && y>0 && y<6) || (x>0 && x<6 && y>14 && y<20));
                    const filled = corner ? cornerOuter || cornerInner : ((i * 7919 + 31) % 100) > 52;
                    return <div key={i} style={{aspectRatio:'1/1', background: filled ? 'var(--ink)' : 'transparent'}}/>;
                  })}
                </div>
                <div style={{
                  position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                  width: 44, height: 44, borderRadius: 12,
                  background:'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'white', fontWeight: 700, fontSize: 18,
                  boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
                }}>b</div>
              </div>
              <div style={{marginTop: 18, display:'flex', alignItems:'center', gap: 8, fontSize: 12.5, color:'var(--ink-soft)'}}>
                <span style={{width:6, height:6, borderRadius:'50%', background:'var(--accent-strong)'}}/>
                Aguardando leitura · expira em 1:42
              </div>
              <button style={{...shellStyles.btn('ghost'), marginTop: 14, fontSize: 12.5}}>
                <Icon name="sparkles" size={14}/> Gerar novo código
              </button>
            </div>
          </div>
        </div>

        <div style={{display:'flex', justifyContent:'space-between', marginTop: 24}}>
          <button style={shellStyles.btn('ghost')}>← Voltar</button>
          <button style={{...shellStyles.btn('primary'), opacity: 0.5, cursor:'not-allowed'}}>
            Continuar <Icon name="arrow" size={14}/>
          </button>
        </div>
      </div>
    </AppShell>
  );
};

window.ScreenOnboarding = ScreenOnboarding;
