'use client'

import { useEffect, useState, useRef } from 'react'
import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api, openQRSocket } from '@/lib/api'

export default function WhatsAppPage() {
  useMobileRoutePerf('m/config/whatsapp')
  const [session, setSession] = useState(null)
  const [connectMethod, setConnectMethod] = useState('qr')
  const [qr, setQr] = useState('')
  const [pairingPhone, setPairingPhone] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [showForgetConfirm, setShowForgetConfirm] = useState(false)
  const pollingRef = useRef(null)
  const wsRef = useRef(null)

  async function refreshSession({ silent = false } = {}) {
    if (!silent) setLoading(true)
    setError('')
    try {
      const status = await api.sessionStatusFast()
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
        const status = await api.sessionStatusFast().catch(() => null)
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

  // Poll when connecting (pairing code flow) to detect successful connection
  useEffect(() => {
    const isConnecting = session?.running && session?.status === 'connecting'
    // Poll while there's a pairing code visible OR while the session is in connecting state.
    // Using only session?.status was unreliable: the first refreshSession after generating the
    // code sometimes returned a non-'connecting' status due to timing, so the interval never
    // started and the page got stuck on the code screen after the phone connected.
    const shouldPoll = isConnecting || Boolean(pairingCode) || Boolean(qr)
    if (!shouldPoll) {
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
      return
    }
    if (pollingRef.current) return
    pollingRef.current = setInterval(async () => {
      const latest = await api.sessionStatusFast().catch(() => null)
      if (!latest) return
      setSession(latest)
      if (latest.status === 'connected') {
        setPairingCode('')
        setQr('')
        setFeedback('Bot online ✅ Conexão concluída.')
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }, 5000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [session?.running, session?.status, pairingCode, qr])

  // Fallback polling for the QR image while connecting via QR (in case the
  // WebSocket channel never delivers the qr frame).
  useEffect(() => {
    if (connectMethod !== 'qr') return
    const connecting = session?.running && session?.status === 'connecting'
    if (!connecting || qr) return
    const id = setInterval(async () => {
      const result = await api.sessionQRLatest().catch(() => null)
      if (result?.qr) {
        setQr(result.qr)
        clearInterval(id)
      }
    }, 4000)
    return () => clearInterval(id)
  }, [connectMethod, session?.running, session?.status, qr])

  // Close the QR WebSocket when the component unmounts.
  useEffect(() => () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
  }, [])

  function switchMethod(method) {
    if (method === connectMethod) return
    setConnectMethod(method)
    setError('')
    setFeedback('')
    if (method === 'qr') {
      // Saindo do fluxo de número: descarta o código pendente.
      setPairingCode('')
    } else {
      // Saindo do fluxo de QR: descarta o QR e fecha o canal WS.
      setQr('')
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    }
  }

  async function openQrSocket() {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    const { ticket } = await api.sessionQRTicket()
    const ws = openQRSocket(ticket, {
      onMessage: (msg) => {
        if (msg.type === 'qr') {
          setQr(msg.data)
        }
        if (msg.type === 'status' && msg.data === 'connected') {
          setQr('')
          setPairingCode('')
          setFeedback('Bot online ✅ Conexão concluída.')
          setSession((prev) => ({ ...(prev || {}), running: true, status: 'connected' }))
          if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
          refreshSession({ silent: true })
        }
      },
    })
    wsRef.current = ws
  }

  async function startQrConnect() {
    setActionLoading('qr')
    setFeedback('')
    setError('')
    setPairingCode('')
    setQr('')
    setConnectMethod('qr')
    setSession((prev) => ({ ...(prev || {}), running: true, status: 'connecting' }))
    try {
      await api.sessionStart().catch((err) => {
        if (err?.status === 409) return
        throw err
      })
      await openQrSocket().catch(() => {})
      // Fallback imediato: tenta puxar o QR mais recente caso o WS demore.
      const latest = await api.sessionQRLatest().catch(() => null)
      if (latest?.qr) setQr(latest.qr)
      await refreshSession({ silent: true })
    } catch (err) {
      setError(err.message || 'Não foi possível iniciar a conexão por QR Code.')
    } finally {
      setActionLoading('')
    }
  }

  async function startPairing() {
    if (!pairingPhone.trim()) {
      setFeedback('Informe o número com DDI e DDD para gerar o código.')
      return
    }
    setActionLoading('pairing')
    setFeedback('')
    setPairingCode('')
    setQr('')
    setConnectMethod('pairing')
    setError('')
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    try {
      const result = await api.sessionPairingCode(pairingPhone.trim())
      setPairingCode(result?.code || '')
      setFeedback('Código gerado. Digite no WhatsApp: Configurações → Dispositivos vinculados → Vincular pelo número.')
      await refreshSession({ silent: true })
    } catch (err) {
      setError(err.message || 'Não foi possível gerar o código de pareamento.')
    } finally {
      setActionLoading('')
    }
  }

  async function disconnect() {
    setActionLoading('stop')
    setFeedback('')
    setError('')
    try {
      await api.sessionStop()
      setPairingCode('')
      setQr('')
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
      setFeedback('WhatsApp desconectado.')
      await refreshSession({ silent: true })
    } catch (err) {
      setError(err.message || 'Não foi possível desconectar.')
    } finally {
      setActionLoading('')
    }
  }

  async function forget() {
    setShowForgetConfirm(false)
    setActionLoading('forget')
    setFeedback('')
    setError('')
    try {
      await api.sessionForget()
      setPairingCode('')
      setQr('')
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
      setFeedback('Sessão removida. Conecte novamente por QR Code ou código de pareamento.')
      await refreshSession({ silent: true })
    } catch (err) {
      setError(err.message || 'Não foi possível esquecer a sessão.')
    } finally {
      setActionLoading('')
    }
  }

  async function copyPairingCode() {
    try {
      await navigator.clipboard.writeText(pairingCode)
      setFeedback('Código copiado!')
    } catch {
      setError('Não foi possível copiar. Copie o código manualmente.')
    }
  }

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando status..." /></div>
      </MobileShell>
    )
  }
  if (error && !session) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div>
      </MobileShell>
    )
  }

  const isConnected = session?.status === 'connected'
  const isConnecting = Boolean(session?.running && session?.status === 'connecting')
  const running = Boolean(session?.running)
  const phone = session?.phone || session?.phoneNumber || ''
  const connectedLabel = session?.connectedAt ? new Date(session.connectedAt).toLocaleDateString('pt-BR') : ''
  const postLimit = session?.config?.postLimitDaily || 250
  const postsToday = session?.statsToday?.posts || 0
  const postPercentage = Math.round((postsToday / postLimit) * 100)
  const postInterval = session?.config?.postIntervalMs ? Math.round(session.config.postIntervalMs / 1000) : 45

  const statusBg = isConnected
    ? 'color-mix(in oklab, var(--success) 12%, var(--surface))'
    : isConnecting
    ? 'color-mix(in oklab, var(--warn) 12%, var(--surface))'
    : 'color-mix(in oklab, var(--danger) 8%, var(--surface))'
  const statusBorder = isConnected
    ? '1px solid color-mix(in oklab, var(--success) 30%, var(--line))'
    : isConnecting
    ? '1px solid color-mix(in oklab, var(--warn) 30%, var(--line))'
    : '1px solid color-mix(in oklab, var(--danger) 20%, var(--line))'
  const statusIconBg = isConnected ? 'var(--success)' : isConnecting ? 'var(--warn)' : 'var(--danger)'
  const statusLabel = isConnected ? 'conectado' : isConnecting ? 'conectando...' : 'desconectado'
  const statusSub = isConnected
    ? `${phone || 'número conectado'}${connectedLabel ? ` · desde ${connectedLabel}` : ''}`
    : isConnecting
    ? (connectMethod === 'qr' ? 'aguardando leitura do QR Code...' : 'aguardando código de pareamento...')
    : 'escolha QR Code ou número para conectar'

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Conexão WhatsApp</div>
      </div>

      {/* Status card */}
      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.cardP, background: statusBg, border: statusBorder}}>
          <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: 14}}>
            <div style={{width: 40, height: 40, borderRadius: 12, background: statusIconBg, display:'flex', alignItems:'center', justifyContent:'center', color:'white'}}>
              {isConnected ? <MobileIcon name="check" size={20} stroke={3}/> : <MobileIcon name="alert" size={18} stroke={2}/>}
            </div>
            <div style={{flex: 1}}>
              <div style={{fontSize: 14, fontWeight: 600, color:'var(--ink)'}}>WhatsApp {statusLabel}</div>
              <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>{statusSub}</div>
            </div>
          </div>
          <div style={{display:'flex', gap: 8}}>
            <button type="button" onClick={() => refreshSession({ silent: true })} style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5, padding:'10px 14px'}}>Sincronizar</button>
            {running && (
              <button type="button" onClick={disconnect} disabled={!!actionLoading} style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5, padding:'10px 14px', color:'var(--danger)'}}>
                {actionLoading === 'stop' ? 'Desconectando...' : 'Desconectar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Method switcher — alternar entre QR Code e número a qualquer momento */}
      {!isConnected && (
        <div style={cfgStyles.cardWrap}>
          <div style={{display:'flex', gap: 4, padding: 4, background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 999}}>
            {[{ id: 'qr', label: 'QR Code' }, { id: 'pairing', label: 'Número' }].map((m) => {
              const active = connectMethod === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => switchMethod(m.id)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    borderRadius: 999,
                    border: 'none',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'white' : 'var(--ink-soft)',
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* QR Code connect — show when QR method selected and not connected */}
      {!isConnected && connectMethod === 'qr' && (
        <div style={cfgStyles.cardWrap}>
          <div style={{...cfgStyles.cardP, display:'grid', gap: 12, textAlign:'center'}}>
            <div style={cfgStyles.rowTitle}>Conectar por QR Code</div>
            {qr ? (
              <>
                <div style={{display:'flex', justifyContent:'center', padding: 14, background:'white', borderRadius: 14, margin:'0 auto'}}>
                  <QRCode value={qr} size={216} includeMargin={false} />
                </div>
                <p style={{fontSize: 11.5, color:'var(--ink-soft)', lineHeight: 1.45}}>
                  No WhatsApp: <strong>Configurações → Dispositivos vinculados → Vincular um aparelho</strong> e aponte a câmera para o código.
                </p>
                <button type="button" onClick={startQrConnect} disabled={actionLoading === 'qr'} style={{...mobi.btn('ghost', true), fontSize: 12.5}}>
                  {actionLoading === 'qr' ? 'Gerando...' : 'Gerar novo QR Code'}
                </button>
              </>
            ) : (
              <>
                <p style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45}}>
                  Gere um QR Code e escaneie com o WhatsApp em Dispositivos vinculados → Vincular um aparelho.
                </p>
                <button type="button" onClick={startQrConnect} disabled={actionLoading === 'qr'} style={{...mobi.btn('primary', true), opacity: actionLoading === 'qr' ? 0.7 : 1}}>
                  {actionLoading === 'qr' ? 'Gerando...' : 'Gerar QR Code'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pairing code display */}
      {connectMethod === 'pairing' && pairingCode && !isConnected && (
        <div style={cfgStyles.cardWrap}>
          <div style={{...cfgStyles.cardP, display:'grid', gap: 12, textAlign:'center'}}>
            <div style={cfgStyles.rowTitle}>Seu código de pareamento</div>
            <div style={{fontSize: 34, letterSpacing: 6, fontWeight: 800, color:'var(--accent-strong)', fontFamily:'monospace'}}>{pairingCode}</div>
            <button type="button" onClick={copyPairingCode} style={{...mobi.btn('ghost', true), fontSize: 12.5}}>Copiar código</button>
            <p style={{fontSize: 11.5, color:'var(--ink-soft)', lineHeight: 1.45}}>
              No WhatsApp: <strong>Configurações → Dispositivos vinculados → Vincular pelo número</strong>. O código expira em ~60s.
            </p>
            <button
              type="button"
              onClick={startPairing}
              disabled={actionLoading === 'pairing' || !pairingPhone.trim()}
              style={{...mobi.btn('primary', true), opacity: (actionLoading === 'pairing' || !pairingPhone.trim()) ? 0.7 : 1, fontSize: 12.5}}
            >
              {actionLoading === 'pairing' ? 'Gerando...' : 'Gerar novo código'}
            </button>
          </div>
        </div>
      )}

      {/* Connect form — show when pairing method selected, not connected and no code pending */}
      {!isConnected && connectMethod === 'pairing' && !pairingCode && (
        <div style={cfgStyles.cardWrap}>
          <div style={{...cfgStyles.cardP, display:'grid', gap: 12}}>
            <div style={cfgStyles.rowTitle}>Conectar por código de pareamento</div>
            <p style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45}}>
              Digite o número com DDI e DDD. Depois abra WhatsApp → Aparelhos conectados → Conectar com número.
            </p>
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
          </div>
        </div>
      )}

      {feedback && (
        <div style={{margin:'12px 16px 0', fontSize: 12, color: feedback.includes('Não') || feedback.includes('Informe') ? 'var(--danger)' : 'var(--success)'}}>
          {feedback}
        </div>
      )}
      {error && (
        <div style={{margin:'8px 16px 0', fontSize: 12, color:'var(--danger)'}}>{error}</div>
      )}

      {/* Advanced actions — forget session */}
      <div style={{...cfgStyles.cardWrap, marginTop: 8}}>
        <div style={{...cfgStyles.cardP, background:'color-mix(in oklab, var(--warn) 8%, var(--surface))', border:'1px solid color-mix(in oklab, var(--warn) 20%, var(--line))'}}>
          <div style={{fontSize: 13, fontWeight: 600, color:'var(--ink)', marginBottom: 4}}>Ações avançadas</div>
          <div style={{fontSize: 12, color:'var(--ink-soft)', marginBottom: 12, lineHeight: 1.45}}>
            &ldquo;Esquecer número&rdquo; desconecta o WhatsApp e remove a sessão salva. Para usar novamente, você precisará conectar por QR Code ou código de pareamento.
          </div>
          {!showForgetConfirm ? (
            <button
              type="button"
              onClick={() => setShowForgetConfirm(true)}
              disabled={!!actionLoading}
              style={{...mobi.btn('ghost', false), fontSize: 12.5, color:'var(--warn)'}}
            >
              Esquecer número salvo
            </button>
          ) : (
            <div style={{display:'grid', gap: 8}}>
              <div style={{fontSize: 12.5, color:'var(--danger)', fontWeight: 600}}>
                Tem certeza? Esta ação remove a sessão permanentemente.
              </div>
              <div style={{display:'flex', gap: 8}}>
                <button type="button" onClick={() => setShowForgetConfirm(false)} style={{...mobi.btn('ghost', false), flex: 1, fontSize: 12.5}}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={forget}
                  disabled={actionLoading === 'forget'}
                  style={{...mobi.btn('primary', false), flex: 1, fontSize: 12.5, background:'var(--danger)'}}
                >
                  {actionLoading === 'forget' ? 'Removendo...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
