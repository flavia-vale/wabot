'use client'

import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

export default function WhatsAppPage() {
  useMobileRoutePerf('m/config/whatsapp')
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const s = await api.sessionStatus().catch(() => null)
        if (!active) return
        setSession(s || {})
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar o status.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando status..." /></div>
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

  const running = session?.running
  const phone = session?.phone || '+55 11 9 XXXX-XXXX'
  const daysSinceConnect = session?.connectedAt ? Math.floor((Date.now() - new Date(session.connectedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0
  const postLimit = session?.config?.postLimitDaily || 250
  const postsToday = session?.statsToday?.posts || 0
  const postPercentage = Math.round((postsToday / postLimit) * 100)
  const postInterval = session?.config?.postIntervalMs ? Math.round(session.config.postIntervalMs / 1000) : 45
  const sleepMode = session?.config?.sleepMode?.enabled !== false

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Conexão WhatsApp</div>
      </div>

      {/* Status */}
      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.cardP, background: running ? 'color-mix(in oklab, var(--success) 12%, var(--surface))' : 'color-mix(in oklab, var(--warn) 12%, var(--surface))', border: running ? '1px solid color-mix(in oklab, var(--success) 30%, var(--line))' : '1px solid color-mix(in oklab, var(--warn) 30%, var(--line))'}}>
          <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: 14}}>
            <div style={{width: 40, height: 40, borderRadius: 12, background: running ? 'var(--success)' : 'var(--warn)', display:'flex', alignItems:'center', justifyContent:'center', color:'white'}}>
              {running ? <MobileIcon name="check" size={20} stroke={3}/> : <MobileIcon name="alert" size={18} stroke={2}/>}
            </div>
            <div style={{flex: 1}}>
              <div style={{fontSize: 14, fontWeight: 600, color:'var(--ink)'}}>WhatsApp {running ? 'conectado' : 'desconectado'}</div>
              {running && <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>{phone} · {daysSinceConnect} dias ativos</div>}
            </div>
          </div>
          <div style={{display:'flex', gap: 8}}>
            {running && <button style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5, padding:'10px 14px'}}>Sincronizar</button>}
            <button style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5, padding:'10px 14px', color: running ? 'var(--danger)' : 'var(--ink)'}}>
              {running ? 'Desconectar' : 'Conectar'}
            </button>
          </div>
        </div>
      </div>

      {/* Limites */}
      {running && (
        <>
          <div style={cfgStyles.sectionLabel}>Limites e cadência</div>
          <div style={{padding:'0 16px'}}>
            <div style={cfgStyles.card}>
              <div style={cfgStyles.row()}>
                <div style={cfgStyles.rowMain}>
                  <div style={cfgStyles.rowTitle}>Posts hoje</div>
                  <div style={cfgStyles.rowSub}>{postsToday} de {postLimit} · {postPercentage}% do limite</div>
                  <div style={{height: 5, background:'var(--bg-soft)', borderRadius: 999, marginTop: 8, overflow:'hidden'}}>
                    <div style={{width:`${Math.min(postPercentage, 100)}%`, height:'100%', background: postPercentage > 80 ? 'var(--warn)' : 'var(--accent-strong)'}}/>
                  </div>
                </div>
              </div>
              <div style={cfgStyles.row()}>
                <div style={cfgStyles.rowMain}>
                  <div style={cfgStyles.rowTitle}>Tempo mínimo entre posts</div>
                  <div style={cfgStyles.rowSub}>recomendado para evitar bloqueios</div>
                </div>
                <div style={{fontSize: 13, fontWeight: 600, color:'var(--ink)'}}>{postInterval} s</div>
              </div>
              <div style={cfgStyles.row(true)}>
                <div style={cfgStyles.rowMain}>
                  <div style={cfgStyles.rowTitle}>Modo soneca · 23h–7h</div>
                  <div style={cfgStyles.rowSub}>bot não posta no período noturno</div>
                </div>
                <div style={cfgStyles.toggle(sleepMode)}><div style={cfgStyles.toggleKnob(sleepMode)}/></div>
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{height: 24}}/>
    </MobileShell>
  )
}
