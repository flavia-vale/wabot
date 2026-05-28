'use client'

import React, { useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'


export default function GroupsPage() {
  useMobileRoutePerf('m/config/groups')

  const [tab, setTab] = React.useState('origem');
  const origem = [
    {nome:'Promoções Brasil 🔥', m:'1.842 membros', last:'agora · 124 hoje', on:true, g:'linear-gradient(135deg,#94A3B8,#475569)'},
    {nome:'Cupons & Cashback BR', m:'2.340 membros', last:'4 min · 87 hoje', on:true, g:'linear-gradient(135deg,#F4D9E0,#E8A488)'},
    {nome:'Ofertas Relâmpago Shopee', m:'967 membros', last:'12 min · 58 hoje', on:true, g:'linear-gradient(135deg,#C8E6D8,#3E9C7A)'},
    {nome:'Promoções de TI', m:'580 membros', last:'23 min · 34 hoje', on:true, g:'linear-gradient(135deg,#D9CFEA,#7C5CF5)'},
    {nome:'Achadinhos Mães', m:'412 membros', last:'pausado', on:false, g:'linear-gradient(135deg,#F6E8D8,#E8A488)'},
  ];
  const destino = [
    {nome:'Achados da Sol 💜', m:'grupo · 247 membros', last:'89 posts hoje', on:true, g:'linear-gradient(135deg,#7CC9A9,#D9CFEA)'},
    {nome:'Sol · Tech & Casa', m:'grupo · 118 membros', last:'38 posts hoje', on:true, g:'linear-gradient(135deg,#D9CFEA,#7C5CF5)'},
    {nome:'Canal Sol Achados', m:'canal · 2.4k inscritos', last:'72 posts hoje', on:true, g:'linear-gradient(135deg,#F6E8D8,#7CC9A9)'},
  ];
  const data = tab === 'origem' ? origem : destino;

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Grupos e canais</div>
      </div>

      {/* Toggle origem/destino */}
      <div style={{padding:'14px 16px 0'}}>
        <div style={{display:'flex', gap: 4, padding: 4, background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 14}}>
          {[
            {key:'origem', label:'👁 Monitorar', n: origem.length},
            {key:'destino', label:'⚡ Publicar', n: destino.length},
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding:'10px 8px', borderRadius: 10, border:'none', cursor:'pointer',
              fontSize: 12.5, fontWeight: 600, fontFamily:'inherit',
              background: tab === t.key ? 'var(--ink)' : 'transparent',
              color: tab === t.key ? 'white' : 'var(--ink-soft)',
              display:'flex', alignItems:'center', justifyContent:'center', gap: 6,
            }}>
              {t.label}
              <span style={{fontSize: 10.5, opacity: tab === t.key ? .7 : .55, padding:'1px 6px', borderRadius: 999, background: tab === t.key ? 'rgba(255,255,255,0.15)' : 'var(--bg-soft)'}}>{t.n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Texto explicativo */}
      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        {tab === 'origem'
          ? 'Grupos onde o bot lê os links de promoção. Você só precisa ser membro — ele não posta aqui.'
          : 'Seus grupos ou canais onde o bot publica os links já convertidos para o seu ID de afiliada.'}
      </div>

      {/* Lista */}
      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {data.map((g, i, a) => (
            <div key={g.nome} style={{...cfgStyles.row(i === a.length-1), opacity: g.on ? 1 : 0.55}}>
              <div style={{width: 40, height: 40, borderRadius:'50%', background: g.g, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight: 700, fontSize: 12, flexShrink: 0}}>
                {g.nome.replace(/[^A-Za-zÀ-ÿ ]/g,'').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>{g.nome}</div>
                <div style={cfgStyles.rowSub}>{g.m} · {g.last}</div>
              </div>
              <div style={cfgStyles.toggle(g.on)}><div style={cfgStyles.toggleKnob(g.on)}/></div>
            </div>
          ))}
        </div>
      </div>

      {/* Add CTA */}
      <div style={{padding:'18px 16px 24px'}}>
        <button style={{...mobi.btn('primary', true)}}>
          <MobileIcon name="plus" size={14}/> Adicionar {tab === 'origem' ? 'grupo para monitorar' : 'destino'}
        </button>
      </div>
    </MobileShell>
  )
}
