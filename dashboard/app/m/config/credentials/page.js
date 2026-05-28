'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'


export default function CredentialsPage() {
  useMobileRoutePerf('m/config/credentials')
  const lojas = [
    {nome:'Shopee', cor:'#EE4D2D', on:true, id:'sol_almeida_aff'},
    {nome:'Mercado Livre', cor:'#FFE600', on:true, id:'MLB-12903847'},
    {nome:'Amazon', cor:'#FF9900', on:true, id:'solalmeida-20'},
    {nome:'Magalu', cor:'#0086FF', on:true, id:'magazinevoce.com.br/solalmeida'},
    {nome:'AliExpress', cor:'#E62E04', on:false, id:''},
  ];
  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Credenciais</div>
      </div>

      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        Cole seu ID de afiliada de cada plataforma. O bot usa esses dados para reescrever os links.
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {lojas.map((l, i, a) => (
            <div key={l.nome} style={{padding:'14px 16px', borderBottom: i < a.length-1 ? '1px solid var(--line)' : 'none'}}>
              <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: l.on ? 10 : 0}}>
                <div style={cfgStyles.storeBadge(l.cor)}>{l.nome.slice(0,2).toUpperCase()}</div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={cfgStyles.rowTitle}>{l.nome}</div>
                  <div style={cfgStyles.rowSub}>
                    {l.on ? <span style={{color:'var(--success)', fontWeight: 600}}>● ativo</span> : <span>○ não conectado</span>}
                  </div>
                </div>
                {l.on
                  ? <button style={{padding:'6px 12px', borderRadius: 999, background:'transparent', border:'1px solid var(--line)', fontSize: 11.5, fontWeight: 600, color:'var(--ink-soft)', cursor:'pointer'}}>Editar</button>
                  : <button style={{padding:'6px 12px', borderRadius: 999, background:'var(--ink)', color:'white', border:'none', fontSize: 11.5, fontWeight: 600, cursor:'pointer'}}>Conectar</button>}
              </div>
              {l.on && (
                <div style={{fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5, color:'var(--ink-soft)', padding:'8px 12px', background:'var(--bg-soft)', borderRadius: 8, wordBreak:'break-all'}}>
                  {l.id}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{height: 24}}/>
    </MobileShell>
  )
}
