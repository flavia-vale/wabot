'use client'

import React, { useState, useEffect } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

const avatarColor = (name) => {
  const hues = [210, 145, 280, 50, 180, 0]
  const hash = name.split('').reduce((h, c) => h + c.charCodeAt(0), 0)
  const hue = hues[hash % hues.length]
  return `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${hue + 20}, 70%, 60%))`
}

export default function GroupsPage() {
  useMobileRoutePerf('m/config/groups')

  const [tab, setTab] = useState('origem')
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const g = await api.groups().catch(() => [])
        if (!active) return
        setGroups(Array.isArray(g) ? g : [])
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar os grupos.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const origem = groups.filter(g => g.role === 'monitor').map(g => ({
    nome: g.subject || g.name || 'Sem nome',
    m: g.participantCount ? `${g.participantCount} membros` : 'membros desconhecido',
    last: g.lastMessageTimestamp ? `${new Date(g.lastMessageTimestamp).toLocaleDateString('pt-BR')}` : 'sem mensagens',
    on: g.active !== false,
    g: avatarColor(g.name || g.subject),
  }))
  const destino = groups.filter(g => g.role === 'post').map(g => ({
    nome: g.subject || g.name || 'Sem nome',
    m: g.isChannel ? `canal · ${g.participantCount || '?'} inscritos` : `grupo · ${g.participantCount || '?'} membros`,
    last: g.postCount ? `${g.postCount} posts hoje` : 'sem posts',
    on: g.active !== false,
    g: avatarColor(g.name || g.subject),
  }))
  const data = tab === 'origem' ? origem : destino;

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando grupos..." /></div>
      </MobileShell>
    )
  }
  if (error) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div>
      </MobileShell>
    )
  }

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
          {data.length === 0 ? (
            <div style={{padding:'24px 16px', textAlign:'center', color:'var(--ink-soft)', fontSize: 13}}>
              Nenhum grupo {tab === 'origem' ? 'para monitorar' : 'para publicar'} configurado
            </div>
          ) : (
            data.map((g, i, a) => (
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
            ))
          )}
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
