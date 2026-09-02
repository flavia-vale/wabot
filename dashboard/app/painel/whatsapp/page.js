'use client'

/* Conexão WhatsApp — reskin Menta do corpo. TODA a lógica crítica
 * (QR/pareamento/polling/WS/telemetria) é idêntica à tela original
 * fluxo canônico de sessão — a apresentação (JSX/classes) usa o
 * visual Menta. Nenhuma mudança em handlers, refs, efeitos ou chamadas de API.
 * Reusa QRCode, ConfirmDialog, HelpLink e o ToastProvider existentes. */

import { useEffect, useState, useRef, useCallback } from 'react'
import { api, openQRSocket } from '@/lib/api'
import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HelpLink } from '@/components/HelpLink'
import { useToast } from '@/components/ToastProvider'
import { usePainelHeader, usePainel } from '../PainelShell'
import { WHATSAPP_SAFETY_HEADLINE, WHATSAPP_SAFETY_POINTS } from '../../../../src/domain/painel/whatsappSafety.js'
import { VIDEO_ATIVACAO_ROBO_URL } from '../../../../src/tutorialVideo.js'

const QR_TIMEOUT_SECONDS = 20
const QR_EXPIRY_SECONDS = 60
const INACTIVITY_RESET_SECONDS = 45
const STATUS_LOADING_TIMEOUT_SECONDS = 15
const STATUS_ERROR_MESSAGE = 'Não foi possível carregar o status da conexão. Tente novamente.'
const WS_QR_RECONNECT_MAX_ATTEMPTS = 3

function NoteBox({ variant = 'is-warn', title, message }) {
  return (
    <div className={`pnl-note-box ${variant}`} role={variant === 'is-error' ? 'alert' : 'status'}>
      {title && <strong style={{ fontWeight: 600, display: 'block' }}>{title}</strong>}
      {message && <span>{message}</span>}
    </div>
  )
}

export default function WhatsAppPage() {
  usePainelHeader({ title: 'Conexão WhatsApp', subtitle: 'Status da sessão e conexão pelo número ou QR Code' })
  const { refreshSession } = usePainel()
  const reconnectHandledRef = useRef(false)

  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [statusLoadingTimedOut, setStatusLoadingTimedOut] = useState(false)
  const [qr, setQr] = useState(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const toast = useToast()
  const [feedback, setFeedback] = useState('')
  const [socketState, setSocketState] = useState('idle')
  const [qrWaitElapsed, setQrWaitElapsed] = useState(0)
  const [wsErrorMessage, setWsErrorMessage] = useState('')
  const [qrStartElapsed, setQrStartElapsed] = useState(0)
  const [qrRetrying, setQrRetrying] = useState(false)
  const wsRef = useRef(null)
  const openWSRef = useRef(null)
  const refreshSessionRef = useRef(refreshSession)
  useEffect(() => { refreshSessionRef.current = refreshSession }, [refreshSession])
  const wsReconnectAttemptsRef = useRef(0)
  const wsQrTimeoutRef = useRef(null)
  const qrPollingRef = useRef(null)
  const qrWaitElapsedRef = useRef(0)
  const qrRef = useRef(null)
  const pairingCodeRef = useRef('')

  const [pairingPhone, setPairingPhone] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [connectMethod, setConnectMethod] = useState('pairing')
  const [showForgetConfirm, setShowForgetConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const trackTelemetry = useCallback((payload) => {
    api.sessionTelemetry(payload).catch(() => {})
  }, [])

  const waitForRunningSession = useCallback(async (timeoutMs = 12000) => {
    const startedAt = Date.now()
    let latest = null
    while (Date.now() - startedAt < timeoutMs) {
      latest = await api.sessionStatusFast().catch(() => null)
      if (latest?.running) {
        setStatus(latest)
        return latest
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    if (latest) setStatus(latest)
    return latest
  }, [])

  const fetchStatus = useCallback(async ({ showLoading = false, recoverable = false } = {}) => {
    if (showLoading) setStatusLoading(true)
    if (showLoading) setStatusLoadingTimedOut(false)
    if (recoverable) setStatusError('')

    try {
      const s = await api.sessionStatusFast()
      setStatus(s)
      setStatusError('')
      setStatusLoadingTimedOut(false)
      return s
    } catch (err) {
      if (recoverable) setStatusError(err.message || STATUS_ERROR_MESSAGE)
      return null
    } finally {
      if (showLoading) setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!statusLoading) return
    const timeoutId = setTimeout(() => {
      setStatusLoadingTimedOut(true)
    }, STATUS_LOADING_TIMEOUT_SECONDS * 1000)
    return () => clearTimeout(timeoutId)
  }, [statusLoading])

  const openWS = useCallback(async () => {
    if (wsQrTimeoutRef.current) clearTimeout(wsQrTimeoutRef.current)
    if (wsRef.current) wsRef.current.close()
    const { ticket } = await api.sessionQRTicket()
    const ws = openQRSocket(ticket, {
      onOpen: () => setSocketState('connected'),
      onError: () => setSocketState('error'),
      onClose: async () => {
        setSocketState('closed')
        if (wsReconnectAttemptsRef.current >= WS_QR_RECONNECT_MAX_ATTEMPTS) return
        const latest = await api.sessionStatusFast().catch(() => null)
        const stillConnecting = latest?.running && latest?.status === 'connecting'
        if (!stillConnecting || qrRef.current || pairingCodeRef.current) return
        wsReconnectAttemptsRef.current += 1
        setWsErrorMessage('Canal de QR oscilou; tentando reconectar automaticamente...')
        trackTelemetry({ stage: 'authenticating', event: 'ws_reconnect_attempt', detail: String(wsReconnectAttemptsRef.current) })
        setTimeout(() => {
          openWSRef.current?.().catch(() => setSocketState('error'))
        }, 1200)
      },
      onMessage: (msg) => {
        if (msg.type === 'error') {
          setWsErrorMessage(msg.message || 'Falha ao conectar no canal de QR Code')
          trackTelemetry({ stage: 'authenticating', event: 'ws_error_message', detail: msg.message || 'unknown' })
        }
        if (msg.type === 'qr') {
          wsReconnectAttemptsRef.current = 0
          if (wsQrTimeoutRef.current) clearTimeout(wsQrTimeoutRef.current)
          setWsErrorMessage('')
          setQr(msg.data)
          setQrStartElapsed(qrWaitElapsedRef.current)
          trackTelemetry({ stage: 'authenticating', event: 'qr_received' })
          trackTelemetry({ stage: 'authenticating', event: 'qr_rendered' })
        }
        if (msg.type === 'status') {
          setStatus((s) => ({ ...s, status: msg.data, phone: msg.phone ?? s?.phone }))
          setStatusError('')
          if (msg.data === 'connected') {
            wsReconnectAttemptsRef.current = 0
            trackTelemetry({ stage: 'ready', event: 'connected' })
            trackTelemetry({ stage: 'ready', event: 'session_connected' })
            setFeedback('Bot online ✅ Conexão concluída.')
            setQr(null)
            setPairingCode('')
            wsRef.current?.close()
            fetchStatus()
            refreshSessionRef.current?.()
          }
        }
      },
    })
    wsRef.current = ws
    wsQrTimeoutRef.current = setTimeout(async () => {
      const latest = await api.sessionStatusFast().catch(() => null)
      const stillConnecting = latest?.running && latest?.status === 'connecting'
      if (stillConnecting && !qrRef.current && !pairingCodeRef.current) {
        setWsErrorMessage('QR não foi recebido em até 25s (conexão possivelmente presa)')
        trackTelemetry({ stage: 'authenticating', event: 'qr_timeout_25s' })
      }
    }, 25_000)
  }, [fetchStatus, trackTelemetry])

  useEffect(() => {
    openWSRef.current = openWS
  }, [openWS])

  useEffect(() => {
    const shouldPoll = connectMethod === 'qr' && status?.running && status?.status === 'connecting' && !qr
    if (!shouldPoll) {
      if (qrPollingRef.current) clearInterval(qrPollingRef.current)
      qrPollingRef.current = null
      return
    }
    if (qrPollingRef.current) return
    qrPollingRef.current = setInterval(async () => {
      const result = await api.sessionQRLatest().catch(() => null)
      if (result?.qr) {
        setQr(result.qr)
        setQrStartElapsed(qrWaitElapsedRef.current)
        setWsErrorMessage('')
        trackTelemetry({ stage: 'authenticating', event: 'qr_received_polling_fallback' })
        trackTelemetry({ stage: 'authenticating', event: 'qr_rendered' })
      }
    }, 3000)
    return () => {
      if (qrPollingRef.current) clearInterval(qrPollingRef.current)
      qrPollingRef.current = null
    }
  }, [status?.running, status?.status, qr, trackTelemetry, connectMethod])

  useEffect(() => {
    qrWaitElapsedRef.current = qrWaitElapsed
  }, [qrWaitElapsed])

  useEffect(() => {
    qrRef.current = qr
  }, [qr])

  useEffect(() => {
    pairingCodeRef.current = pairingCode
  }, [pairingCode])

  useEffect(() => {
    let active = true

    async function loadInitialStatus() {
      setStatusLoading(true)
      setStatusError('')
      try {
        const s = await api.sessionStatusFast()
        if (!active) return
        setStatus(s)
        // Abre WS apenas no fluxo QR. Em pairing, o usuário acompanha a
        // conexão pelo polling de status (não há QR para receber via WS).
        if (s.running && s.status === 'connecting' && connectMethod === 'qr') {
          openWS().catch(() => setSocketState('error'))
        }
      } catch (err) {
        if (active) setStatusError(err.message || STATUS_ERROR_MESSAGE)
      } finally {
        if (active) setStatusLoading(false)
      }
    }

    loadInitialStatus()

    return () => {
      active = false
      if (wsQrTimeoutRef.current) clearTimeout(wsQrTimeoutRef.current)
      if (qrPollingRef.current) clearInterval(qrPollingRef.current)
      wsRef.current?.close()
    }
  }, [openWS, connectMethod])

  useEffect(() => {
    if (!status?.running) return
    const interval = setInterval(async () => {
      const latest = await api.sessionStatusFast().catch(() => null)
      if (!latest) return
      setStatus(latest)
      if (latest.status === 'connected') {
        setQr(null)
        setPairingCode('')
        setSocketState('idle')
        setStatusError('')
        setWsErrorMessage('')
        setFeedback('Bot online ✅ Conexão concluída.')
      }
    }, 8000)
    return () => clearInterval(interval)
  }, [status?.running])

  useEffect(() => {
    // Polling acelerado (5s) enquanto o bot está conectando OU enquanto há
    // código de pareamento ativo e status 'disconnected' (janela transitória
    // normal do handshake pós-515: WA fecha o socket, bot reinicia ~500ms
    // depois). Sem este caso, o polling pararia exatamente quando o celular
    // mostra "Conectando..." e a UI nunca detectaria o 'connected' final.
    const shouldPoll = status?.running && (
      status?.status === 'connecting' ||
      (status?.status === 'disconnected' && pairingCode)
    )
    if (!shouldPoll) return
    const interval = setInterval(async () => {
      const latest = await api.sessionStatusFast().catch(() => null)
      if (!latest) return
      setStatus(latest)
      if (latest.status === 'connected') {
        setQr(null)
        setPairingCode('')
        setSocketState('idle')
        setStatusError('')
        setWsErrorMessage('')
        setFeedback('Bot online ✅ Conexão concluída.')
        wsRef.current?.close()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [status?.running, status?.status, pairingCode])

  useEffect(() => {
    if (!(status?.running && status?.status !== 'connected') || qr || pairingCode) return
    const interval = setInterval(() => setQrWaitElapsed((prev) => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [status?.running, status?.status, qr, pairingCode])

  useEffect(() => {
    if (!qr) return
    const interval = setInterval(() => setQrWaitElapsed((prev) => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [qr])

  async function handleQRConnect(mode = 'connect') {
    if (loading) return
    setError('')
    setFeedback('')
    setStatusError('')
    setWsErrorMessage('')
    setConnectMethod('qr')
    setPairingCode('')
    setQrWaitElapsed(0)
    setQrRetrying(mode === 'retry')
    setStatus((prev) => ({ ...(prev || {}), running: true, status: 'connecting' }))
    setLoading(true)
    setActionLoading(mode === 'retry' ? 'retry_qr' : 'connect')
    trackTelemetry({ stage: 'initializing', event: mode === 'retry' ? 'retry_click' : 'connect_click' })
    if (mode !== 'retry') trackTelemetry({ stage: 'initializing', event: 'connect_clicked' })
    try {
      await api.sessionStart().catch(async (err) => {
        if (err?.status === 409) return
        throw err
      })
      trackTelemetry({ stage: 'initializing', event: 'service_start_ok' })
      trackTelemetry({ stage: 'authenticating', event: 'qr_requested' })
      // no fluxo de pairing, evitamos abrir WS de QR imediatamente para não disputar handshake
      const s = await fetchStatus()
      const shouldOpenWsNow = s?.running && s?.status === 'connecting' && !qrRef.current && !pairingCodeRef.current
      if (shouldOpenWsNow) {
        await openWS().catch(() => setSocketState('error'))
        trackTelemetry({ stage: 'authenticating', event: mode === 'retry' ? 'waiting_qr_after_retry_click' : 'waiting_qr_after_connect_click' })
      }
      const runningStatus = s?.running ? s : await waitForRunningSession(12000)
      const wsIsOpen = wsRef.current && wsRef.current.readyState === 1
      if (runningStatus?.running && !wsIsOpen && !qrRef.current && !pairingCodeRef.current) {
        await openWS().catch(() => setSocketState('error'))
        const fallbackQr = await api.sessionQRLatest().catch(() => null)
        if (fallbackQr?.qr) {
          setQr(fallbackQr.qr)
          setQrStartElapsed(qrWaitElapsedRef.current)
          setWsErrorMessage('')
          trackTelemetry({ stage: 'authenticating', event: 'qr_received_polling_fallback' })
          trackTelemetry({ stage: 'authenticating', event: 'qr_rendered' })
        }
      }
      setTimeout(async () => {
        const s = await api.sessionStatusFast().catch(() => null)
        if (s && !s.running && s.status === 'disconnected') {
          setQr(null)
          setStatus(s)
        }
      }, 6000)
    } catch (err) {
      setError(err.message)
      toast.error(err.message, 'Falha na conexão')
      trackTelemetry({ stage: 'initializing', event: mode === 'retry' ? 'retry_failed' : 'connect_failed', detail: err.message })
    } finally {
      setQrRetrying(false)
      setLoading(false)
      setActionLoading('')
    }
  }

  function handlePairingPhoneChange(e) {
    setPairingPhone(e.target.value.replace(/\D/g, '').slice(0, 13))
  }

  async function handlePairingSubmit(e) {
    e.preventDefault()
    if (loading) return
    if (!pairingPhone.trim()) return
    setError('')
    setFeedback('')
    setStatusError('')
    setWsErrorMessage('')
    setLoading(true)
    setActionLoading('pairing')
    setConnectMethod('pairing')
    setQr(null)
    setQrWaitElapsed(0)
    trackTelemetry({ stage: 'authenticating', event: 'pairing_request' })
    try {
      // Backend (POST /api/session/pairing-code) faz o fluxo atômico:
      //   auto-start worker se necessário → tear-down socket → rm AUTH_DIR
      //   → setActive(pairing) → sock.requestPairingCode(phone).
      // Frontend não precisa orquestrar sessionStart/waitForRunning aqui.
      // Também NÃO abrimos WS de QR — pairing usa o status polling de 5s
      // (useEffect de status?.status === 'connecting') pra detectar 'connected'.
      const { code } = await api.sessionPairingCode(pairingPhone.trim())
      setPairingCode(code)
      setFeedback('Código gerado. Digite-o no WhatsApp: Configurações → Dispositivos vinculados → Vincular pelo número.')
      trackTelemetry({ stage: 'authenticating', event: 'pairing_code_received' })
      // Força refresh do status pra UI saber que o worker subiu.
      await fetchStatus()
    } catch (err) {
      setError(err.message)
      toast.error(err.message, 'Falha ao gerar código')
      trackTelemetry({ stage: 'authenticating', event: 'pairing_failed', detail: err.message })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function handleStop() {
    if (loading) return
    setError('')
    setFeedback('')
    setStatusError('')
    setLoading(true)
    setActionLoading('stop')
    try {
      await api.sessionStop()
      setQr(null)
      setPairingCode('')
      wsRef.current?.close()
      await fetchStatus()
      refreshSessionRef.current?.()
      setFeedback('Bot desligado. Para voltar, gere um novo QR Code ou código de pareamento.')
    } catch (err) {
      setError(err.message)
      toast.error(err.message, 'Falha na conexão')
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function handleRestart() {
    if (loading) return
    setError('')
    setFeedback('')
    setStatusError('')
    setWsErrorMessage('')
    setLoading(true)
    setActionLoading('restart')
    trackTelemetry({ stage: 'initializing', event: 'restart_click' })
    try {
      await api.sessionStop().catch(() => {})
      await api.sessionStart()
      setQr(null)
      setPairingCode('')
      setQrWaitElapsed(0)
      const latest = await waitForRunningSession()
      if (latest?.running) {
        trackTelemetry({ stage: 'initializing', event: 'service_start_ok' })
        trackTelemetry({ stage: 'authenticating', event: 'qr_requested' })
        await openWS()
        const fallbackQr = await api.sessionQRLatest().catch(() => null)
        if (fallbackQr?.qr) setQr(fallbackQr.qr)
      }
      await fetchStatus()
      setFeedback('Reinício solicitado. Aguarde o novo QR Code.')
      trackTelemetry({ stage: 'initializing', event: 'restart_requested' })
    } catch (err) {
      setError(err.message)
      toast.error(err.message, 'Falha na conexão')
      trackTelemetry({ stage: 'initializing', event: 'restart_failed', detail: err.message })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function handleForget() {
    if (loading) return
    setError('')
    setFeedback('')
    setStatusError('')
    setLoading(true)
    setActionLoading('forget')
    try {
      await api.sessionForget()
      setQr(null)
      setPairingCode('')
      wsRef.current?.close()
      await fetchStatus()
      setFeedback('Sessão removida com sucesso. Conecte novamente por QR Code ou código de pareamento para usar o bot.')
    } catch (err) {
      setError(err.message)
      toast.error(err.message, 'Falha na conexão')
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function handleResetInstance() {
    if (loading) return
    setError('')
    setFeedback('')
    setStatusError('')
    setWsErrorMessage('')
    setQr(null)
    setPairingCode('')
    setShowResetConfirm(false)
    setLoading(true)
    setActionLoading('reset')
    trackTelemetry({ stage: 'authenticating', event: 'reset_instance_click' })
    try {
      wsRef.current?.close()
      await api.sessionStop().catch(() => null)
      await api.sessionForget().catch(() => null)
      await fetchStatus({ showLoading: true, recoverable: true })
      setFeedback('Tentativas anteriores foram limpas. Gerando uma nova conexão segura...')
      setLoading(false)
      setActionLoading('')
      await handleQRConnect('retry')
    } catch (err) {
      setError(err.message)
      toast.error(err.message, 'Falha ao resetar instância')
      trackTelemetry({ stage: 'authenticating', event: 'reset_instance_failed', detail: err.message })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function copyPairingCode() {
    try {
      await navigator.clipboard.writeText(pairingCode)
      setFeedback('Código copiado para a área de transferência.')
    } catch {
      const msg = 'Não foi possível copiar o código. Copie manualmente.'
      setError(msg)
      toast.error(msg, 'Falha ao copiar')
    }
  }

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return
      if (status?.running && status?.status === 'connecting' && !qr) {
        trackTelemetry({ stage: 'authenticating', event: 'possible_abandon', elapsedSec: qrWaitElapsed })
        trackTelemetry({ stage: 'authenticating', event: 'connect_abandoned', elapsedSec: qrWaitElapsed })
      }
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [status?.running, status?.status, qr, qrWaitElapsed, trackTelemetry])

  // O banner global "Reconectar agora" navega para cá com ?reconnect=1.
  // Dispara uma reconexão (stop+start → novo QR) uma única vez e limpa o
  // parâmetro para que um refresh não re-execute a ação.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (reconnectHandledRef.current || statusLoading) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('reconnect') !== '1') return
    reconnectHandledRef.current = true
    window.history.replaceState({}, '', '/painel/whatsapp')
    // Defere para fora do corpo síncrono do efeito (handleRestart altera
    // estado) — evita cascading renders e satisfaz react-hooks/set-state-in-effect.
    const t = setTimeout(() => { handleRestart() }, 0)
    return () => clearTimeout(t)
    // Só deve disparar quando o status terminar de carregar; handleRestart é
    // estável o bastante para este uso único guardado por ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusLoading])

  const isConnected = status?.status === 'connected'
  const isConnecting = status?.status === 'connecting'
  const isRunning = status?.running
  const isAwaitingConnectStart = qrRetrying || actionLoading === 'connect' || actionLoading === 'retry_qr'
  const showQrRetry = isRunning && isConnecting && !qr && !pairingCode && qrWaitElapsed >= QR_TIMEOUT_SECONDS
  const qrAgeSeconds = qr ? Math.max(qrWaitElapsed - qrStartElapsed, 0) : 0
  const qrExpiresIn = Math.max(QR_EXPIRY_SECONDS - qrAgeSeconds, 0)
  const showQrExpired = Boolean(qr) && qrExpiresIn === 0
  const showInactivityReset = isRunning && isConnecting && !isConnected && qrWaitElapsed >= INACTIVITY_RESET_SECONDS
  const canSubmitPairing = pairingPhone.trim().length >= 10
  const isValidatingSession = isRunning && isConnecting && !qr && !pairingCode && qrStartElapsed > 0

  // O que a cliente deve ver (decidido no servidor por
  // src/core/clientVisibleSessionState.js): queda que o robô resolve sozinho
  // em poucos minutos não vira aviso; o que exige ação dela nunca espera.
  // Fallback para o comportamento antigo quando a API não mandar o campo.
  const clientState = status?.clientState?.state ?? null
  const isSelfHealing = clientState === 'recovering' || Boolean(status?.clientState?.hiddenByGrace)
  const isNotReceiving = clientState === 'not_receiving'
  const silentMinutes = Math.max(1, Math.round(Number(status?.reception?.silentForMs || 0) / 60000))
  const isQrScanned = isValidatingSession

  const connectionSteps = [
    { key: 'service', label: 'Iniciando serviço', done: isRunning, active: !isRunning && (loading || isAwaitingConnectStart) },
    { key: 'qr', label: 'Gerando QR', done: Boolean(qr) || isQrScanned || isConnected, active: isRunning && isConnecting && !qr && !isQrScanned && !isConnected },
    { key: 'scanned', label: 'QR lido no celular', done: isQrScanned || isConnected, active: isQrScanned && !isConnected },
    { key: 'validating', label: 'Validando sessão', done: isConnected, active: isValidatingSession && !isConnected },
    { key: 'online', label: 'Bot online', done: isConnected, active: isConnected },
  ]

  useEffect(() => {
    if (!isValidatingSession) return
    trackTelemetry({ stage: 'authenticating', event: 'qr_scanned' })
    trackTelemetry({ stage: 'authenticating', event: 'session_validation_started' })
  }, [isValidatingSession, trackTelemetry])

  // Durante a carência a bolinha continua verde: piscar amarelo a cada
  // reconexão automática é exatamente o susto que queremos evitar.
  const statusDotColor = (isConnected || status?.clientState?.hiddenByGrace) ? 'var(--success)' : (isConnecting || clientState === 'recovering') ? 'var(--warn)' : 'var(--line)'

  return (
    <div className="pnl-grid" style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Banner de "conexão instável" (sessionHealth.degraded) removido (2026-06):
          a ação que ele sugeria — reconectar gerando QR novo — PIORA o estado,
          porque logo após reconectar há uma rajada esperada de Bad MAC enquanto
          as sender keys dos grupos re-sincronizam, e re-escanear reinicia esse
          ciclo. Decrypt dessincronizado costuma normalizar sozinho. */}
      <div className="pnl-toolbar" style={{ justifyContent: 'flex-end' }}>
        <HelpLink topic="como-conectar-whatsapp-qr-code">Ajuda para conectar</HelpLink>
      </div>

      {/* Progresso da conexão */}
      <section className="pnl-card">
        <p className="pnl-eyebrow">Progresso da conexão</p>
        <ol style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', marginTop: 12, listStyle: 'none', padding: 0 }}>
          {connectionSteps.map((step) => {
            const color = step.done ? 'var(--accent-strong)' : step.active ? '#8a5a1e' : 'var(--ink-faint)'
            const bg = step.done ? 'var(--accent-strong)' : step.active ? 'color-mix(in oklab, var(--warn) 30%, transparent)' : 'var(--bg-soft)'
            return (
              <li key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                <span style={{ display: 'inline-flex', height: 20, width: 20, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: step.done ? '#fff' : color }}>{step.done ? '✓' : '•'}</span>
                <span style={{ color }}>{step.label}</span>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Alertas */}
      {(statusLoadingTimedOut || statusError || (socketState === 'error') || (socketState === 'closed' && isConnecting && !qr && !pairingCode) || wsErrorMessage || feedback || error) && (
        <div className="pnl-grid" style={{ gap: 8 }}>
          {statusLoadingTimedOut && <NoteBox variant="is-warn" title="Status demorando para carregar" message='Não conseguimos atualizar o status do WhatsApp em 15s. Toque em "Tentar novamente" para continuar.' />}
          {statusError && <NoteBox variant="is-error" title="Falha ao carregar status" message={statusError || STATUS_ERROR_MESSAGE} />}
          {(statusError || statusLoadingTimedOut) && (
            <button type="button" className="pnl-btn" onClick={() => fetchStatus({ showLoading: true, recoverable: true })} disabled={statusLoading} style={{ alignSelf: 'flex-start' }}>
              {statusLoading ? 'Tentando…' : 'Tentar novamente'}
            </button>
          )}
          {socketState === 'error' && <NoteBox variant="is-warn" title="Conexão instável" message="Conexão de pareamento instável. Tentando reconectar..." />}
          {socketState === 'closed' && isConnecting && !qr && !pairingCode && <NoteBox variant="is-warn" title="Conexão perdida" message="Gere novamente o QR ou aguarde reconexão." />}
          {wsErrorMessage && <NoteBox variant="is-warn" title="Não conseguimos gerar seu QR ainda" message={`Estamos com instabilidade para gerar o QR. ${wsErrorMessage}. Tente gerar um novo QR agora.`} />}
          {feedback && <NoteBox variant="is-success" title="Tudo certo" message={feedback} />}
          {error && <NoteBox variant="is-error" title="Falha na conexão" message={`Não foi possível concluir a ação. ${error}`} />}
        </div>
      )}

      {/* Status */}
      <section className="pnl-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ width: 12, height: 12, borderRadius: 999, flexShrink: 0, background: statusDotColor }} className={isConnecting ? 'pnl-pulse' : undefined} />
        <div>
          {statusLoading ? (
            <p className="pnl-card-note">{statusLoadingTimedOut ? 'Status demorando mais do que o esperado…' : 'Carregando status do WhatsApp…'}</p>
          ) : (
            <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{
              statusError ? 'Status indisponível'
                : clientState === 'stopped' ? 'Desligado por você'
                : (isConnected || status?.clientState?.hiddenByGrace) ? 'Conectado'
                : clientState === 'recovering' ? 'Reconectando…'
                : (isConnecting || isAwaitingConnectStart) ? 'Conectando…'
                : clientState === 'action_required' ? 'Desconectado'
                : isConnected ? 'Conectado' : 'Desconectado'
            }</p>
          )}
          {!statusLoading && !statusError && isNotReceiving && (
            <p className="pnl-hint">Conectado, mas sem receber mensagens há {silentMinutes} minutos. O robô está tentando resolver sozinho.</p>
          )}
          {!statusLoading && !statusError && !isNotReceiving && isSelfHealing && (
            <p className="pnl-hint">O robô está resolvendo sozinho — você não precisa fazer nada.</p>
          )}
          {!statusLoading && !isConnected && !isConnecting && !isAwaitingConnectStart && !statusError && !clientState && status?.lifecycle === 'reconnecting' && (
            <p className="pnl-hint">O robô está tentando reconectar sozinho — você não precisa fazer nada.</p>
          )}
          {status?.phone && <p className="pnl-hint">+{status.phone}</p>}
        </div>
      </section>

      {/* Gerando QR (spinner) */}
      {((isRunning && !isConnected && !isSelfHealing && !qr && !pairingCode) || isAwaitingConnectStart) ? (
        <section className="pnl-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 32 }}>
          <svg className="pnl-rotate" width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--accent-strong)' }}>
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <div role="status" aria-live="polite" style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 500, color: 'var(--ink-soft)' }}>Gerando QR Code… ({qrWaitElapsed}s)</p>
            <p className="pnl-hint">É normal levar até 20 segundos para liberar o QR. Mantenha esta tela aberta.</p>
          </div>
          {showQrRetry && (
            <div className="pnl-note-box is-warn" style={{ textAlign: 'center' }}>
              <p>Estamos com lentidão para gerar seu QR.</p>
              <button type="button" className="pnl-link-btn" style={{ marginTop: 8 }} onClick={() => handleQRConnect('retry')} disabled={loading}>
                {actionLoading === 'retry_qr' ? 'Gerando novo QR…' : 'Gerar novo QR agora'}
              </button>
              <p className="pnl-hint" style={{ marginTop: 8, color: '#8a5a1e' }}>No WhatsApp: Configurações → Dispositivos conectados → Conectar um dispositivo.</p>
            </div>
          )}
          {showQrRetry && (
            <button type="button" className="pnl-link-btn" style={{ color: '#8a5a1e', textDecoration: 'underline' }} onClick={() => setShowResetConfirm(true)} disabled={loading}>
              {actionLoading === 'reset' ? 'Resetando instância…' : 'Resetar instância (seguro)'}
            </button>
          )}
        </section>
      ) : null}

      {/* QR Code */}
      {qr && (
        <section className="pnl-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p className="pnl-card-note">Escaneie o QR Code com o WhatsApp</p>
          {isQrScanned && <span className="pnl-tag is-success">QR lido ✅</span>}
          <QRCode value={qr} size={240} />
          <p style={{ fontSize: 12, fontWeight: 500, color: showQrExpired ? 'var(--danger)' : 'var(--ink-soft)' }}>
            {showQrExpired ? 'QR expirado. Gere um novo QR para continuar.' : `QR expira em ${qrExpiresIn}s`}
          </p>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
            <p>No WhatsApp: <strong>Configurações → Dispositivos conectados → Conectar um dispositivo.</strong></p>
            <p>Mantenha esta tela aberta até a conexão ser concluída. O QR atualiza automaticamente.</p>
            {isValidatingSession && <p style={{ fontWeight: 500, color: '#8a5a1e' }}>Validando sessão no servidor… (até 10s)</p>}
          </div>
          {showQrExpired && (
            <button type="button" className="pnl-link-btn" onClick={handleQRConnect} disabled={loading}>Gerar novo QR</button>
          )}
        </section>
      )}

      {/* Código de pareamento */}
      {pairingCode && !isConnected && (
        <section className="pnl-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p className="pnl-label">Seu código de pareamento</p>
          <p style={{ fontSize: 36, fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", fontWeight: 700, letterSpacing: '0.2em', color: 'var(--accent-strong)' }} aria-label={`Código: ${pairingCode.split('').join(' ')}`}>{pairingCode}</p>
          <button type="button" className="pnl-link-btn" onClick={copyPairingCode}>Copiar código</button>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
            <p>No WhatsApp: <strong>Configurações → Dispositivos vinculados → Vincular pelo número</strong></p>
            <p style={{ marginTop: 4 }}>O código expira em ~60s. Se não conseguir, gere um novo abaixo.</p>
          </div>
          <div className="pnl-toolbar" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="pnl-btn is-primary" onClick={() => handlePairingSubmit({ preventDefault: () => {} })} disabled={loading || !pairingPhone}>
              {actionLoading === 'pairing' ? 'Gerando…' : 'Gerar novo código'}
            </button>
            <button type="button" className="pnl-btn" onClick={() => { setPairingCode(''); setConnectMethod('qr'); setError('') }} disabled={loading}>
              Voltar para QR Code
            </button>
          </div>
        </section>
      )}

      {/* Segurança: o que o robô faz (e não faz) com o WhatsApp dela. Aparece
          ANTES do formulário, e só para quem ainda não conectou — é aí que a
          dúvida existe. Metade de quem não paga nunca chegou a pedir a conexão
          (funil, 2026-09) e esta tela não dizia nada sobre isso.
          Texto único, compartilhado com o e-mail de "cadastrou e não conectou":
          src/domain/painel/whatsappSafety.js — inclusive a regra de nunca
          prometer que não recebemos as mensagens. */}
      {!isRunning && !statusLoading && !isAwaitingConnectStart && !pairingCode && (
        <section className="pnl-card" style={{ marginBottom: 16 }}>
          <div className="pnl-card-title">🔒 {WHATSAPP_SAFETY_HEADLINE}</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 10 }}>
            {WHATSAPP_SAFETY_POINTS.map((p) => (
              <li key={p.chave} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ color: 'var(--accent-strong)', fontWeight: 700, lineHeight: 1.5 }}>✓</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                  <strong style={{ fontWeight: 600 }}>{p.titulo}.</strong> {p.texto}
                </span>
              </li>
            ))}
          </ul>
          <p className="pnl-card-note" style={{ marginTop: 12 }}>
            <a href={VIDEO_ATIVACAO_ROBO_URL} target="_blank" rel="noreferrer" style={{ fontWeight: 600, textDecoration: 'underline' }}>
              🎥 Ver no vídeo como conectar, do começo ao fim
            </a>
          </p>
        </section>
      )}

      {/* Formulário de conexão (QR / pareamento) */}
      {!isRunning && !statusLoading && !isAwaitingConnectStart && !pairingCode && (
        <div className="pnl-grid">
          <section className="pnl-card">
            <div role="tablist" aria-label="Método de conexão" style={{ display: 'flex', gap: 4, background: 'var(--bg-soft)', borderRadius: 'var(--pnl-radius-sm)', padding: 4, marginBottom: 16 }}>
              <button
                role="tab"
                aria-selected={connectMethod === 'pairing'}
                onClick={() => { setConnectMethod('pairing'); setError('') }}
                disabled={loading}
                className="pnl-btn"
                style={{ flex: 1, justifyContent: 'center', background: connectMethod === 'pairing' ? 'var(--surface)' : 'transparent', border: 0, color: connectMethod === 'pairing' ? 'var(--accent-strong)' : 'var(--ink-soft)', boxShadow: connectMethod === 'pairing' ? 'var(--pnl-shadow)' : 'none' }}
              >
                📱 Número de celular
              </button>
              <button
                role="tab"
                aria-selected={connectMethod === 'qr'}
                onClick={() => { setConnectMethod('qr'); setError('') }}
                disabled={loading}
                className="pnl-btn"
                style={{ flex: 1, justifyContent: 'center', background: connectMethod === 'qr' ? 'var(--surface)' : 'transparent', border: 0, color: connectMethod === 'qr' ? 'var(--ink)' : 'var(--ink-soft)', boxShadow: connectMethod === 'qr' ? 'var(--pnl-shadow)' : 'none' }}
              >
                📷 QR Code
              </button>
            </div>

            {connectMethod === 'qr' ? (
              <div style={{ textAlign: 'center' }}>
                <div className="pnl-card-title">Escaneie o QR Code para conectar seu WhatsApp</div>
                <p className="pnl-card-note" style={{ marginTop: 4 }}>Abra o WhatsApp no celular e mantenha esta tela aberta até finalizar.</p>
                <button type="button" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => handleQRConnect('connect')} disabled={loading}>
                  📷 {actionLoading === 'connect' ? 'Conectando…' : 'Gerar QR Code'}
                </button>
              </div>
            ) : (
              <form onSubmit={handlePairingSubmit} className="pnl-grid">
                <div className="pnl-card-title">Conectar pelo número do WhatsApp</div>
                <p className="pnl-card-note">Informaremos um código de 8 caracteres para você digitar no app — sem precisar escanear.</p>
                <div>
                  <label htmlFor="pairing-phone" className="pnl-label">Número (com DDI + DDD)</label>
                  <input
                    id="pairing-phone"
                    className="pnl-input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={pairingPhone}
                    onChange={handlePairingPhoneChange}
                    placeholder="Ex: 5511999999999"
                    disabled={loading}
                  />
                  <p className="pnl-hint" style={{ marginTop: 6 }}>Padrão internacional (55 = Brasil + DDD + número). Pode colar com +, espaços ou parênteses.</p>
                </div>
                <button type="submit" className="pnl-btn is-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading || !canSubmitPairing}>
                  {actionLoading === 'pairing' ? 'Gerando código…' : 'Obter código de pareamento'}
                </button>
              </form>
            )}
          </section>

          <div className="pnl-note-box is-warn">
            <strong style={{ fontWeight: 600, display: 'block' }}>Ações avançadas</strong>
            <p style={{ marginTop: 4 }}>Use “Esquecer número salvo” apenas se quiser remover a sessão deste painel e conectar novamente por QR Code ou código.</p>
            <button type="button" className="pnl-btn" style={{ marginTop: 12 }} onClick={() => setShowForgetConfirm(true)} disabled={loading}>Esquecer número salvo</button>
          </div>
        </div>
      )}

      {/* Ações com sessão rodando */}
      {isRunning && (
        <div className="pnl-grid">
          {showInactivityReset && (
            <div className="pnl-note-box is-warn">
              <strong style={{ fontWeight: 600, display: 'block' }}>Conexão sem progresso</strong>
              <p style={{ marginTop: 4 }}>Detectamos inatividade no pareamento. Resetar instância limpará tentativas anteriores e abrirá um novo caminho seguro.</p>
              <button type="button" className="pnl-btn is-primary" style={{ marginTop: 12 }} onClick={handleRestart} disabled={loading}>
                {actionLoading === 'restart' ? 'Resetando…' : 'Resetar instância'}
              </button>
            </div>
          )}
          <section className="pnl-card">
            <div className="pnl-card-title">Ação operacional</div>
            <p className="pnl-card-note" style={{ marginBottom: 10 }}>Desliga o bot agora, mas mantém a sessão salva para reconectar depois.</p>
            <div className="pnl-toolbar" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="pnl-btn is-danger" onClick={handleStop} disabled={loading}>{actionLoading === 'stop' ? 'Desconectando…' : 'Desligar bot'}</button>
              <button type="button" className="pnl-btn" onClick={handleRestart} disabled={loading}>{actionLoading === 'restart' ? 'Reiniciando…' : 'Reiniciar conexão'}</button>
            </div>
          </section>
          <div className="pnl-note-box is-warn">
            <strong style={{ fontWeight: 600, display: 'block' }}>Ações avançadas</strong>
            <p style={{ marginTop: 4 }}>Esquecer número desconecta o WhatsApp e remove a sessão salva neste painel. Para usar novamente, você precisará conectar por QR Code ou código.</p>
            <button type="button" className="pnl-btn" style={{ marginTop: 12 }} onClick={() => setShowForgetConfirm(true)} disabled={loading}>Esquecer número</button>
          </div>
        </div>
      )}

      <ConfirmDialog open={showForgetConfirm} title="Esquecer número" message="Isso vai desconectar o WhatsApp e remover a sessão salva neste painel. Para usar novamente, você precisará conectar por QR Code ou código." confirmLabel="Esquecer sessão" danger onCancel={() => setShowForgetConfirm(false)} onConfirm={async () => { setShowForgetConfirm(false); await handleForget() }} />
      <ConfirmDialog
        open={showResetConfirm}
        title="Resetar instância"
        message='Isso limpará tentativas anteriores e abrirá um novo caminho seguro para conexão do WhatsApp.'
        confirmLabel="Resetar e continuar"
        danger
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={handleResetInstance}
      />
    </div>
  )
}
