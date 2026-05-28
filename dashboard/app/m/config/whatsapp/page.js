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
  const [pairingPhone, setPairingPhone] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  async function refreshSession({ silent = false } = {}) {
    if (!silent) setLoading(true)
    setError('')
    try {
      const status = await api.sessionStatus()
      setSession(status || {})
      return status || {}
    } catch (err) {
      setError(err.message || 'Não foi possível carregar o status.')
      return null
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const status = await api.sessionStatus().catch(() => null)
        if (active) setSession(status || {})
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível carregar o status.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  async function startPairing() {
    if (!pairingPhone.trim()) {
      setFeedback('Informe o número com DDI e DDD para gerar o código.')
      return
    }
    setActionLoading('pairing')
    setFeedback('')
    setPairingCode('')
    try {
      const result = await api.sessionPairingCode(pairingPhone.trim())
      setPairingCode(result?.code || '')
      setFeedback('Código gerado. Digite no WhatsApp para concluir a conexão.')
      await refreshSession({ silent: true })
    } catch (err) {
      setFeedback(err.message || 'Não foi possível gerar o código de pareamento.')
    } finally {
      setActionLoading('')
    }
  }

  async function startQrFallback() {
    setActionLoading('start')
    setFeedback('')
    try {
      await api.sessionStart()
      setFeedback('Sessão iniciada. Se preferir QR Code completo, use o painel desktop.')
      await refreshSession({ silent: true })
    } catch (err) {
      setFeedback(err.message || 'Não foi possível iniciar a conexão.')
    } finally {
      setActionLoading('')
    }
  }

  async function disconnect() {
    setActionLoading('stop')
    setFeedback('')
    try {
      await api.sessionStop()
      setPairingCode('')
      setFeedback('WhatsApp desconectado.')
      await refreshSession({ silent: true })
    } catch (err) {
      setFeedback(err.message || 'Não foi possível desconectar.')
    } finally {
      setActionLoading('')
    }
  }

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

  const running = Boolean(session?.running)
  const phone = session?.phone || session?.phoneNumber || ''
  const connectedLabel = session?.connectedAt ? new Date(session.connectedAt).toLocaleDateString('pt-BR') : ''
  const postLimit = session?.config?.postLimitDaily || 250
  const postsToday = session?.statsToday?.posts || 0
  const postPercentage = Math.round((postsToday / postLimit) * 100)
  const postInterval = session?.config?.postIntervalMs ? Math.round(session.config.postIntervalMs / 1000) : 45

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Conexão WhatsApp</div>
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.cardP, background: running ? 'color-mix(in oklab, var(--success) 12%, var(--surface))' : 'color-mix(in oklab, var(--warn) 12%, var(--surface))', border: running ? '1px solid color-mix(in oklab, var(--success) 30%, var(--line))' : '1px solid color-mix(in oklab, var(--warn) 30%, var(--line))'}}>
          <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: 14}}>
            <div style={{width: 40, height: 40, borderRadius: 12, background: running ? 'var(--success)' : 'var(--warn)', display:'flex', alignItems:'center', justifyContent:'center', color:'white'}}>
              {running ? <MobileIcon name="check" size={20} stroke={3}/> : <MobileIcon name="alert" size={18} stroke={2}/>} 
            </div>
            <div style={{flex: 1}}>
              <div style={{fontSize: 14, fontWeight: 600, color:'var(--ink)'}}>WhatsApp {running ? 'conectado' : 'desconectado'}</div>
              <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>{running ? `${phone || 'número conectado'}${connectedLabel ? ` · desde ${connectedLabel}` : ''}` : 'gere um código de pareamento para conectar'}</div>
            </div>
          </div>
          <div style={{display:'flex', gap: 8}}>
            <button type="button" onClick={() => refreshSession({ silent: true })} style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5, padding:'10px 14px'}}>Sincronizar</button>
            {running && (
              <button type="button" onClick={disconnect} disabled={actionLoading === 'stop'} style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5, padding:'10px 14px', color:'var(--danger)'}}>
                {actionLoading === 'stop' ? 'Desconectando...' : 'Desconectar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {!running && (
        <div style={cfgStyles.cardWrap}>
          <div style={{...cfgStyles.cardP, display:'grid', gap: 12}}>
            <div style={cfgStyles.rowTitle}>Conectar por código de pareamento</div>
            <p style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45}}>Digite o número com DDI e DDD. Depois abra WhatsApp → Aparelhos conectados → Conectar com número.</p>
            <input
              type="tel"
              inputMode="tel"
              placeholder="5511999999999"
              value={pairingPhone}
              onChange={(event) => setPairingPhone(event.target.value)}
              style={cfgStyles.field}
            />
            <button type="button" onClick={startPairing} disabled={actionLoading === 'pairing'} style={{...mobi.btn('primary', true), opacity: actionLoading === 'pairing' ? 0.7 : 1}}>
              {actionLoading === 'pairing' ? 'Gerando...' : 'Gerar código'}
            </button>
            <button type="button" onClick={startQrFallback} disabled={actionLoading === 'start'} style={{...mobi.btn('ghost', true)}}>
              Iniciar por QR no painel desktop
            </button>
            {pairingCode && <div style={{textAlign:'center', fontSize: 32, letterSpacing: 6, fontWeight: 800, color:'var(--accent-strong)'}}>{pairingCode}</div>}
          </div>
        </div>
      )}

      {feedback && <div style={{margin:'12px 16px 0', fontSize: 12, color: feedback.includes('Não') || feedback.includes('Informe') ? 'var(--danger)' : 'var(--success)'}}>{feedback}</div>}

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
              <div style={cfgStyles.row(true)}>
                <div style={cfgStyles.rowMain}>
                  <div style={cfgStyles.rowTitle}>Tempo mínimo entre posts</div>
                  <div style={cfgStyles.rowSub}>recomendado para evitar bloqueios</div>
                </div>
                <div style={{fontSize: 13, fontWeight: 600, color:'var(--ink)'}}>{postInterval} s</div>
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{height: 24}}/>
    </MobileShell>
  )
}
